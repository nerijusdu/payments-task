import type {
	AdminListSubscriptionsQuery, CancelSubscriptionDto, CreateSubscriptionDto, NormalizedWebhookEvent, PaymentResponseDto,
	SubscriptionResponseDto, SubscriptionStatus,
} from '@payments/contracts';
import { AppError } from '@payments/http';
import type { CustomersService } from '../customers/customers.service.js';
import type { OutboundWebhooksService } from '../outbound-webhooks/outbound-webhooks.service.js';
import type { PaymentsService } from '../payments/payments.service.js';
import type { PlansService } from '../plans/plans.service.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { AdapterClient } from '../shared/adapter-client/adapter-client.js';
import type { Subscription, SubscriptionsRepository } from './subscriptions.repository.js';

type Action = PaymentResponseDto['action'];

export class SubscriptionsService {
	constructor(
		private readonly repo: SubscriptionsRepository,
		private readonly projects: ProjectsService,
		private readonly customers: CustomersService,
		private readonly plans: PlansService,
		private readonly payments: PaymentsService,
		private readonly adapter: AdapterClient,
		private readonly outbound: OutboundWebhooksService,
	) { }

	async create(
		projectId: string,
		idempotencyKey: string,
		dto: CreateSubscriptionDto,
		correlationId?: string,
	): Promise<SubscriptionResponseDto> {
		const provider = await this.projects.findProvider({ code: dto.providerCode });
		const config = provider?.isActive
			? await this.projects.findProjectProvider(projectId, provider.id)
			: null;
		if (!provider || !config?.isEnabled) {
			throw new AppError(
				'PROVIDER_NOT_ENABLED',
				422,
				`Provider not enabled: ${dto.providerCode}`,
			);
		}
		const plan = await this.plans.find({ projectId, code: dto.planCode });
		if (!plan) {
			throw AppError.notFound(`Plan not found: ${dto.planCode}`);
		}
		if (config.currencies.length > 0 && !config.currencies.includes(plan.currency)) {
			throw new AppError(
				'VALIDATION_ERROR',
				422,
				`${dto.providerCode} does not support ${plan.currency}`,
			);
		}
		const providerPriceId = await this.plans.findProviderPriceId(plan.id, provider.id);
		if (!providerPriceId) {
			throw new AppError(
				'VALIDATION_ERROR',
				422,
				`Plan ${plan.code} is not available on ${dto.providerCode}`,
			);
		}

		let subscription = await this.repo.find({ projectId, idempotencyKey });
		if (!subscription) {
			const customer = await this.customers.findOrCreate(projectId, dto.customer);
			subscription = await this.repo.insertIfAbsent({
				projectId,
				customerId: customer.id,
				planId: plan.id,
				providerId: provider.id,
				// Price terms are snapshotted so later plan edits do not change this subscription.
				amount: plan.amount,
				currency: plan.currency,
				idempotencyKey,
			}) ?? await this.repo.find({ projectId, idempotencyKey });
		}
		if (!subscription) {
			throw new AppError('INTERNAL_ERROR', 500, 'Subscription could not be created');
		}
		if (subscription.planId !== plan.id || subscription.providerId !== provider.id) {
			throw new AppError(
				'IDEMPOTENCY_CONFLICT',
				409,
				'Idempotency-Key was already used with different parameters',
			);
		}

		// No provider id means an earlier attempt never reached the PSP; the forwarded
		// idempotency key makes calling again safe.
		if (subscription.providerSubscriptionId === null && subscription.status === 'pending') {
			const providerCustomerId = await this.customers.findProviderCustomerId(
				subscription.customerId,
				provider.id,
			);
			const result = await this.adapter.createSubscription(
				dto.providerCode,
				{
					projectId,
					subscriptionId: subscription.id,
					providerPriceId,
					amount: subscription.amount,
					currency: subscription.currency,
					customer: { ...dto.customer, providerCustomerId: providerCustomerId ?? undefined },
					returnUrl: dto.returnUrl,
					trialDays: dto.trialDays ?? plan.trialDays,
				},
				{ idempotencyKey: `${projectId}:${idempotencyKey}`, correlationId },
			);
			if (result.providerCustomerId) {
				await this.customers.saveProviderCustomerId(
					subscription.customerId,
					provider.id,
					result.providerCustomerId,
				);
			}
			const updated = await this.apply(subscription, {
				status: result.status,
				providerSubscriptionId: result.providerSubscriptionId,
				currentPeriodStart: result.currentPeriodStart,
				currentPeriodEnd: result.currentPeriodEnd,
			});
			return this.toResponse(updated, plan.code, dto.providerCode, result.action);
		}
		return this.toResponse(subscription, plan.code, dto.providerCode);
	}

	async listForAdmin(query: AdminListSubscriptionsQuery) {
		const rows = await this.repo.list(query);
		return rows.map((r) => ({
			...r,
			currentPeriodStart: r.currentPeriodStart?.toISOString() ?? null,
			currentPeriodEnd: r.currentPeriodEnd?.toISOString() ?? null,
			canceledAt: r.canceledAt?.toISOString() ?? null,
			createdAt: r.createdAt.toISOString(),
		}));
	}

	async get(projectId: string, id: string): Promise<SubscriptionResponseDto> {
		const subscription = await this.repo.find({ projectId, id });
		if (!subscription) {
			throw AppError.notFound('Subscription not found');
		}
		return this.describe(subscription);
	}

	async cancel(
		projectId: string,
		id: string,
		dto: CancelSubscriptionDto,
		correlationId?: string,
	): Promise<SubscriptionResponseDto> {
		const subscription = await this.repo.find({ projectId, id });
		if (!subscription) {
			throw AppError.notFound('Subscription not found');
		}
		if (subscription.status === 'canceled') {
			return this.describe(subscription);
		}
		if (!subscription.providerSubscriptionId) {
			throw new AppError(
				'INVALID_STATE_TRANSITION',
				409,
				'Subscription has not been created at the provider yet',
			);
		}
		const provider = await this.projects.findProvider({ id: subscription.providerId });
		if (!provider) {
			throw AppError.notFound('Provider not found');
		}
		const result = await this.adapter.cancelSubscription(
			provider.code,
			subscription.providerSubscriptionId,
			{ projectId, atPeriodEnd: dto.atPeriodEnd },
			{ idempotencyKey: `${projectId}:${id}:cancel:${dto.atPeriodEnd}`, correlationId },
		);
		const immediate = result.status === 'canceled';
		const updated = await this.apply(subscription, {
			status: result.status,
			cancelAtPeriodEnd: !immediate && dto.atPeriodEnd,
			canceledAt: immediate ? new Date().toISOString() : undefined,
			currentPeriodStart: result.currentPeriodStart,
			currentPeriodEnd: result.currentPeriodEnd,
		});
		return this.describe(updated);
	}

	/** Applies a subscription.updated / subscription.renewed webhook. Replays are no-ops. */
	async applyProviderEvent(providerId: string, event: NormalizedWebhookEvent): Promise<void> {
		const providerSubscriptionId = event.type === 'subscription.renewed'
			? event.providerSubscriptionId
			: event.providerObjectId;
		if (!providerSubscriptionId) {
			throw AppError.validation({ providerSubscriptionId: ['missing on renewal event'] });
		}
		const subscription = await this.repo.find({
			projectId: event.projectId,
			providerId,
			providerSubscriptionId,
		});
		if (!subscription) {
			throw AppError.notFound(`Subscription not found: ${providerSubscriptionId}`);
		}

		if (event.type === 'subscription.renewed') {
			await this.payments.recordRenewal({
				projectId: subscription.projectId,
				customerId: subscription.customerId,
				providerId,
				subscriptionId: subscription.id,
				amount: event.amount ?? subscription.amount,
				currency: event.currency ?? subscription.currency,
				idempotencyKey: `renewal:${event.providerEventId}`,
				providerPaymentId: event.providerObjectId,
				status: event.status === 'past_due' || event.status === 'canceled'
					? 'failed'
					: 'succeeded',
			});
		}
		await this.apply(subscription, {
			status: event.status as SubscriptionStatus,
			currentPeriodStart: event.currentPeriodStart,
			currentPeriodEnd: event.currentPeriodEnd,
		});
	}

	private async apply(
		subscription: Subscription,
		change: {
			status: SubscriptionStatus;
			providerSubscriptionId?: string;
			currentPeriodStart?: string;
			currentPeriodEnd?: string;
			cancelAtPeriodEnd?: boolean;
			canceledAt?: string;
		},
	): Promise<Subscription> {
		// Canceled is terminal: stale or out-of-order events cannot revive a subscription.
		const status = subscription.status === 'canceled' ? 'canceled' : change.status;
		const updated = await this.repo.update(subscription.id, {
			status,
			providerSubscriptionId: change.providerSubscriptionId ?? undefined,
			currentPeriodStart: change.currentPeriodStart
				? new Date(change.currentPeriodStart)
				: undefined,
			currentPeriodEnd: change.currentPeriodEnd ? new Date(change.currentPeriodEnd) : undefined,
			cancelAtPeriodEnd: change.cancelAtPeriodEnd,
			canceledAt: change.canceledAt ? new Date(change.canceledAt) : undefined,
		});
		if (updated.status !== subscription.status
			|| updated.cancelAtPeriodEnd !== subscription.cancelAtPeriodEnd) {
			await this.outbound.enqueue(updated.projectId, 'subscription.updated', {
				subscription: await this.describe(updated),
			});
		}
		return updated;
	}

	private async describe(subscription: Subscription): Promise<SubscriptionResponseDto> {
		const [plan, provider] = await Promise.all([
			this.plans.find({ projectId: subscription.projectId, id: subscription.planId }),
			this.projects.findProvider({ id: subscription.providerId }),
		]);
		return this.toResponse(subscription, plan?.code ?? 'unknown', provider?.code ?? 'unknown');
	}

	private toResponse(
		s: Subscription,
		planCode: string,
		providerCode: string,
		action?: Action,
	): SubscriptionResponseDto {
		return {
			id: s.id,
			status: s.status,
			planCode,
			providerCode,
			amount: s.amount,
			currency: s.currency,
			currentPeriodStart: s.currentPeriodStart?.toISOString(),
			currentPeriodEnd: s.currentPeriodEnd?.toISOString(),
			cancelAtPeriodEnd: s.cancelAtPeriodEnd,
			canceledAt: s.canceledAt?.toISOString(),
			action,
		};
	}
}
