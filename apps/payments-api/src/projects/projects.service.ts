import type { CreateProjectDto, CreateProjectResponseDto } from '@payments/contracts';
import { AppError } from '@payments/http';
import { generateApiKey, generateWebhookSecret, hashApiKey } from '../shared/auth/api-keys.js';
import type {
	Project, ProjectProviderConfig, ProjectsRepository, Provider, ProviderQuery,
} from './projects.repository.js';

export class ProjectsService {
	constructor(private readonly repo: ProjectsRepository) { }

	async create(dto: CreateProjectDto): Promise<CreateProjectResponseDto> {
		const apiKey = generateApiKey();
		const webhookSecret = generateWebhookSecret();
		const project = await this.repo.insert({
			name: dto.name,
			webhookUrl: dto.webhookUrl,
			apiKeyHash: hashApiKey(apiKey),
			webhookSecret,
		});
		return { id: project.id, name: project.name, apiKey, webhookSecret };
	}

	find(query: { id?: string; name?: string; apiKey?: string }): Promise<Project | null> {
		const { apiKey, ...rest } = query;
		return this.repo.find({
			...rest,
			apiKeyHash: apiKey === undefined ? undefined : hashApiKey(apiKey),
		});
	}

	registerProvider(code: string, name: string): Promise<Provider> {
		return this.repo.upsertProvider(code, name);
	}

	findProvider(query: ProviderQuery): Promise<Provider | null> {
		return this.repo.findProvider(query);
	}

	async setProviderConfig(
		projectId: string,
		providerCode: string,
		config: ProjectProviderConfig,
	) {
		if (!await this.repo.find({ id: projectId })) throw AppError.notFound('Project not found');
		const provider = await this.repo.findProvider({ code: providerCode });
		if (!provider?.isActive) throw AppError.notFound(`Unknown provider: ${providerCode}`);
		return this.repo.upsertProjectProvider(projectId, provider.id, config);
	}
}
