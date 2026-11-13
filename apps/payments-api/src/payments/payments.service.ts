import type {
	AdminListPaymentsQuery, CreatePaymentDto, OutboundEventType, PaymentResponseDto,
} from '@payments/contracts';
import { AppError } from '@payments/http';
import type { OutboundWebhooksService } from '../outbound-webhooks/outbound-webhooks.service.js';
import type { CustomersService } from '../customers/customers.service.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { AdapterClient } from '../shared/adapter-client/adapter-client.js';
import type { Payment, PaymentsRepository } from './payments.repository.js';
import { assertTransition } from './payments.state-machine.js';

const OUTBOUND_EVENT_BY_STATUS: Partial<Record<Payment['status'], OutboundEventType>> = {
	succeeded: 'payment.succeeded',
	failed: 'payment.failed',
	canceled: 'payment.canceled',
	refunded: 'payment.refunded',
};

export class PaymentsService {
	constructor(
		private readonly repo: PaymentsRepository,
		private readonly projects: ProjectsService,
		private readonly customers: CustomersService,
		private readonly adapter: AdapterClient,
		private readonly outbound: OutboundWebhooksService,
	) { }

	async create(
		projectId: string,
		idempotencyKey: string,
		dto: CreatePaymentDto,
		correlationId?: string,
	): Promise<PaymentResponseDto> {
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
		if (config.currencies.length > 0 && !config.currencies.includes(dto.currency)) {
			throw new AppError(
				'VALIDATION_ERROR',
				422,
				`${dto.providerCode} does not support ${dto.currency}`,
			);
		}

		const existing = await this.repo.find({ projectId, idempotencyKey });
		let payment = existing;
		if (!payment) {
			const customer = await this.customers.findOrCreate(projectId, dto.customer);
			payment = await this.repo.insertIfAbsent({
				projectId,
				customerId: customer.id,
				providerId: provider.id,
				amount: dto.amount,
				currency: dto.currency,
				idempotencyKey,
				metadata: dto.metadata,
			}) ?? await this.repo.find({ projectId, idempotencyKey });
		}
		if (!payment) {
			throw new AppError('INTERNAL_ERROR', 500, 'Payment could not be created');
		}

		if (payment.providerId !== provider.id || payment.amount !== dto.amount
			|| payment.currency !== dto.currency) {
			throw new AppError(
				'IDEMPOTENCY_CONFLICT',
				409,
				'Idempotency-Key was already used with different parameters',
			);
		}

		// A row without a provider id means an earlier attempt never reached the PSP (or its
		// answer was lost), so call again; the forwarded idempotency key makes that safe.
		if (payment.providerPaymentId === null && payment.status === 'pending') {
			const submitted = await this.submitToProvider(payment, dto, correlationId);
			return this.toResponse(submitted.payment, dto.providerCode, submitted.action);
		}
		return this.toResponse(payment, dto.providerCode);
	}

	async listForAdmin(query: AdminListPaymentsQuery) {
		const rows = await this.repo.list(query);
		return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
	}

	async get(projectId: string, id: string): Promise<PaymentResponseDto> {
		const payment = await this.repo.find({ projectId, id });
		if (!payment) {
			throw AppError.notFound('Payment not found');
		}
		const provider = await this.projects.findProvider({ id: payment.providerId });
		return this.toResponse(payment, provider?.code ?? 'unknown');
	}

	/** Records a payment created by a subscription renewal. A replayed event is a no-op. */
	async recordRenewal(values: {
		projectId: string;
		customerId: string;
		providerId: string;
		subscriptionId: string;
		amount: number;
		currency: string;
		idempotencyKey: string;
		providerPaymentId: string;
		status: Payment['status'];
	}): Promise<void> {
		const created = await this.repo.insertIfAbsent(values);
		if (created) {
			await this.notifyProject(created);
		}
	}

	/** Moves a payment along the state machine; used by the payment flow and webhook handling. */
	async transition(payment: Payment, to: Payment['status'], providerPaymentId?: string) {
		if (payment.status === to && providerPaymentId === undefined) {
			return payment;
		}
		if (payment.status !== to) {
			assertTransition(payment.status, to);
		}
		const updated = await this.repo.updateStatus(
			payment.id,
			payment.status,
			to,
			providerPaymentId,
		);
		if (!updated) {
			throw new AppError('INVALID_STATE_TRANSITION', 409, 'Payment changed concurrently');
		}
		if (payment.status !== to) {
			await this.notifyProject(updated);
		}
		return updated;
	}

	/**
	 * Applies a status reported by a webhook. Duplicates and replays are no-ops; a payment the
	 * PSP knows but we have not yet stored throws NOT_FOUND so the queue retries later.
	 */
	async applyProviderStatus(
		projectId: string,
		providerId: string,
		providerPaymentId: string,
		status: Payment['status'],
	): Promise<Payment> {
		const payment = await this.repo.find({ projectId, providerId, providerPaymentId });
		if (!payment) {
			throw AppError.notFound(`Payment not found: ${providerPaymentId}`);
		}
		return this.transition(payment, status);
	}

	private async notifyProject(payment: Payment): Promise<void> {
		const type = OUTBOUND_EVENT_BY_STATUS[payment.status];
		if (!type) {
			return;
		}
		const provider = await this.projects.findProvider({ id: payment.providerId });
		await this.outbound.enqueue(payment.projectId, type, {
			payment: this.toResponse(payment, provider?.code ?? 'unknown'),
		});
	}

	private async submitToProvider(
		payment: Payment,
		dto: CreatePaymentDto,
		correlationId?: string,
	): Promise<{ payment: Payment; action: PaymentResponseDto['action'] }> {
		const providerCustomerId = await this.customers.findProviderCustomerId(
			payment.customerId,
			payment.providerId,
		);
		const result = await this.adapter.createPayment(
			dto.providerCode,
			{
				projectId: payment.projectId,
				paymentId: payment.id,
				amount: payment.amount,
				currency: payment.currency,
				customer: { ...dto.customer, providerCustomerId: providerCustomerId ?? undefined },
				returnUrl: dto.returnUrl,
				metadata: dto.metadata,
			},
			{ idempotencyKey: `${payment.projectId}:${payment.idempotencyKey}`, correlationId },
		);
		if (result.providerCustomerId) {
			await this.customers.saveProviderCustomerId(
				payment.customerId,
				payment.providerId,
				result.providerCustomerId,
			);
		}
		const updated = await this.transition(payment, result.status, result.providerPaymentId);
		return { payment: updated, action: result.action };
	}

	private toResponse(
		payment: Payment,
		providerCode: string,
		action?: PaymentResponseDto['action'],
	): PaymentResponseDto {
		return {
			id: payment.id,
			status: payment.status,
			amount: payment.amount,
			currency: payment.currency,
			providerCode,
			action,
		};
	}
}
