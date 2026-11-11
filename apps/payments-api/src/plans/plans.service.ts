import type { CreatePlanDto } from '@payments/contracts';
import { AppError } from '../shared/errors/errors.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { Plan, PlansRepository } from './plans.repository.js';

export class PlansService {
	constructor(
		private readonly repo: PlansRepository,
		private readonly projects: ProjectsService,
	) { }

	async create(projectId: string, dto: CreatePlanDto): Promise<Plan> {
		if (!await this.projects.find({ id: projectId })) {
			throw AppError.notFound('Project not found');
		}
		if (await this.repo.find({ projectId, code: dto.code })) {
			throw new AppError('VALIDATION_ERROR', 409, `Plan code already exists: ${dto.code}`);
		}
		const mappings = await Promise.all(
			dto.providerMappings.map(async (m) => {
				const provider = await this.projects.findProvider({ code: m.providerCode });
				if (!provider?.isActive) {
					throw AppError.notFound(`Unknown provider: ${m.providerCode}`);
				}
				return { providerId: provider.id, providerPriceId: m.providerPriceId };
			}),
		);
		return this.repo.insert(
			{
				projectId,
				code: dto.code,
				name: dto.name,
				amount: dto.amount,
				currency: dto.currency,
				interval: dto.interval,
				intervalCount: dto.intervalCount,
				trialDays: dto.trialDays,
			},
			mappings,
		);
	}

	find(query: { projectId: string; id?: string; code?: string }): Promise<Plan | null> {
		return this.repo.find(query);
	}

	findProviderPriceId(planId: string, providerId: string): Promise<string | null> {
		return this.repo.findProviderPriceId(planId, providerId);
	}
}
