import type {
	ConfigureProviderDto, CreateProjectDto, CreateProjectResponseDto,
} from '@payments/contracts';
import { AppError } from '@payments/http';
import type { AdapterClient } from '../shared/adapter-client/adapter-client.js';
import { generateApiKey, generateWebhookSecret, hashApiKey } from '../shared/auth/api-keys.js';
import type {
	Project, ProjectProviderConfig, ProjectsRepository, Provider, ProviderQuery,
} from './projects.repository.js';

export class ProjectsService {
	constructor(
		private readonly repo: ProjectsRepository,
		private readonly adapter: AdapterClient,
	) { }

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
		if (!await this.repo.find({ id: projectId })) {
			throw AppError.notFound('Project not found');
		}
		const provider = await this.repo.findProvider({ code: providerCode });
		if (!provider?.isActive) {
			throw AppError.notFound(`Unknown provider: ${providerCode}`);
		}
		return this.repo.upsertProjectProvider(projectId, provider.id, config);
	}

	/**
	 * Two steps: the adapter stores the credentials first, then the business config is saved.
	 * Both are upserts, so a failed second step is fixed by repeating the call.
	 * Secrets only live in this request's memory and are never persisted here.
	 */
	async configureProvider(projectId: string, providerCode: string, dto: ConfigureProviderDto) {
		const { credentials, webhookSecret, ...config } = dto;
		if (!await this.repo.find({ id: projectId })) {
			throw AppError.notFound('Project not found');
		}
		const provider = await this.repo.findProvider({ code: providerCode });
		if (!provider?.isActive) {
			throw AppError.notFound(`Unknown provider: ${providerCode}`);
		}
		await this.adapter.saveCredentials(projectId, providerCode, { credentials, webhookSecret });
		return this.repo.upsertProjectProvider(projectId, provider.id, config);
	}

	async removeProvider(projectId: string, providerCode: string): Promise<void> {
		if (!await this.repo.find({ id: projectId })) {
			throw AppError.notFound('Project not found');
		}
		const provider = await this.repo.findProvider({ code: providerCode });
		if (!provider) {
			throw AppError.notFound(`Unknown provider: ${providerCode}`);
		}
		await this.repo.deleteProjectProvider(projectId, provider.id);
		await this.adapter.deleteCredentials(projectId, providerCode);
	}

	findProjectProvider(projectId: string, providerId: string) {
		return this.repo.findProjectProvider(projectId, providerId);
	}
}
