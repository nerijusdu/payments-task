import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadConfig, env } from '@payments/config';
import { z } from 'zod';
import { createDb } from './client.js';

const { DATABASE_URL } = loadConfig(z.object({ DATABASE_URL: env.databaseUrl }));
const { db, pool } = createDb(DATABASE_URL);
await migrate(db, {
	migrationsFolder: fileURLToPath(new URL('../../../drizzle', import.meta.url)),
	migrationsSchema: 'payments',
});
await pool.end();
console.log('migrations applied');
