import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/shared/db/schema.ts',
	out: './drizzle',
	schemaFilter: ['adapter'],
	migrations: { schema: 'adapter', table: '__drizzle_migrations' },
	dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
