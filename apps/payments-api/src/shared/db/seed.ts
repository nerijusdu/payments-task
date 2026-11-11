import { loadConfig, env } from '@payments/config';
import { z } from 'zod';
import { createDb } from './client.js';
import { ProjectsRepository } from '../../projects/projects.repository.js';
import { ProjectsService } from '../../projects/projects.service.js';
import { AdapterClient } from '../adapter-client/adapter-client.js';
import { PlansRepository } from '../../plans/plans.repository.js';
import { PlansService } from '../../plans/plans.service.js';

const { DATABASE_URL, ADAPTER_URL, SERVICE_TOKEN } = loadConfig(z.object({
	DATABASE_URL: env.databaseUrl,
	ADAPTER_URL: env.url,
	SERVICE_TOKEN: env.secret(),
}));
const { db, pool } = createDb(DATABASE_URL);

const projects = new ProjectsService(
	new ProjectsRepository(db),
	new AdapterClient({ baseUrl: ADAPTER_URL, serviceToken: SERVICE_TOKEN }),
);
const plans = new PlansService(new PlansRepository(db), projects);

await projects.registerProvider('mock', 'Mock PSP');

const NAME = 'Demo project';
const existing = await projects.find({ name: NAME });
if (existing) {
	console.log(`"${NAME}" already seeded (id ${existing.id}); API key is only shown at creation.`);
} else {
	const created = await projects.create({ name: NAME });
	await projects.configureProvider(created.id, 'mock', {
		isEnabled: true,
		sortOrder: 0,
		supportedMethods: ['card'],
		currencies: ['EUR', 'USD'],
		credentials: {},
	});
	await plans.create(created.id, {
		code: 'basic-monthly',
		name: 'Basic monthly',
		amount: 999,
		currency: 'EUR',
		interval: 'month',
		intervalCount: 1,
		trialDays: 0,
		providerMappings: [{ providerCode: 'mock', providerPriceId: 'mock_price_basic' }],
	});
	console.log('Seeded project', created.id);
	console.log('API key (save it):', created.apiKey);
}
await pool.end();
