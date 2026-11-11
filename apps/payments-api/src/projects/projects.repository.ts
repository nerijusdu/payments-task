import { and, eq } from 'drizzle-orm';
import type { Db } from '../shared/db/client.js';
import { projectProviders, projects, providers } from '../shared/db/schema.js';

export type Project = typeof projects.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type ProjectProvider = typeof projectProviders.$inferSelect;

export type ProjectQuery = { id?: string; name?: string; apiKeyHash?: string };
export type ProviderQuery = { id?: string; code?: string };

export type ProjectProviderConfig = Omit<ProjectProvider, 'id' | 'projectId' | 'providerId'>;

export class ProjectsRepository {
	constructor(private readonly db: Db) { }

	async insert(values: typeof projects.$inferInsert): Promise<Project> {
		const [row] = await this.db.insert(projects).values(values).returning();
		return row!;
	}

	async find(query: ProjectQuery): Promise<Project | null> {
		const [row] = await this.db
			.select()
			.from(projects)
			.where(and(
				query.id === undefined ? undefined : eq(projects.id, query.id),
				query.name === undefined ? undefined : eq(projects.name, query.name),
				query.apiKeyHash === undefined
					? undefined
					: eq(projects.apiKeyHash, query.apiKeyHash),
			))
			.limit(1);
		return row ?? null;
	}

	async upsertProvider(code: string, name: string): Promise<Provider> {
		const [row] = await this.db
			.insert(providers)
			.values({ code, name })
			.onConflictDoUpdate({ target: providers.code, set: { name } })
			.returning();
		return row!;
	}

	async findProvider(query: ProviderQuery): Promise<Provider | null> {
		const [row] = await this.db
			.select()
			.from(providers)
			.where(and(
				query.id === undefined ? undefined : eq(providers.id, query.id),
				query.code === undefined ? undefined : eq(providers.code, query.code),
			))
			.limit(1);
		return row ?? null;
	}

	async findProjectProvider(
		projectId: string,
		providerId: string,
	): Promise<ProjectProvider | null> {
		const [row] = await this.db
			.select()
			.from(projectProviders)
			.where(and(
				eq(projectProviders.projectId, projectId),
				eq(projectProviders.providerId, providerId),
			))
			.limit(1);
		return row ?? null;
	}

	async upsertProjectProvider(
		projectId: string,
		providerId: string,
		config: ProjectProviderConfig,
	): Promise<ProjectProvider> {
		const [row] = await this.db
			.insert(projectProviders)
			.values({ projectId, providerId, ...config })
			.onConflictDoUpdate({
				target: [projectProviders.projectId, projectProviders.providerId],
				set: config,
			})
			.returning();
		return row!;
	}

	async deleteProjectProvider(projectId: string, providerId: string): Promise<void> {
		await this.db
			.delete(projectProviders)
			.where(and(
				eq(projectProviders.projectId, projectId),
				eq(projectProviders.providerId, providerId),
			));
	}
}
