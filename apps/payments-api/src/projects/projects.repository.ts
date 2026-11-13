import { and, asc, desc, eq } from 'drizzle-orm';
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

	async update(
		id: string,
		values: Partial<typeof projects.$inferInsert>,
	): Promise<Project | null> {
		if (Object.keys(values).length === 0) {
			return this.find({ id });
		}
		const [row] = await this.db
			.update(projects)
			.set(values)
			.where(eq(projects.id, id))
			.returning();
		return row ?? null;
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

	list(): Promise<Project[]> {
		return this.db.select().from(projects).orderBy(desc(projects.createdAt));
	}

	listProviders(): Promise<Provider[]> {
		return this.db.select().from(providers).orderBy(asc(providers.code));
	}

	listProjectProviders(projectId: string) {
		return this.db
			.select({
				providerCode: providers.code,
				providerName: providers.name,
				isEnabled: projectProviders.isEnabled,
				sortOrder: projectProviders.sortOrder,
				supportedMethods: projectProviders.supportedMethods,
				currencies: projectProviders.currencies,
			})
			.from(projectProviders)
			.innerJoin(providers, eq(providers.id, projectProviders.providerId))
			.where(eq(projectProviders.projectId, projectId))
			.orderBy(asc(projectProviders.sortOrder));
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
