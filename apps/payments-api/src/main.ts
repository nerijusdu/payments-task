import express from 'express';
import { z } from 'zod';
import { baseConfigShape, env, loadConfig } from '@payments/config';
import { correlationMiddleware, createLogger, errorHandler, tokenAuth } from '@payments/http';
import { createDb } from './shared/db/client.js';
import { ProjectsRepository } from './projects/projects.repository.js';
import { ProjectsService } from './projects/projects.service.js';
import { projectsExternalController } from './projects/projects.external-controller.js';
import { CustomersRepository } from './customers/customers.repository.js';
import { CustomersService } from './customers/customers.service.js';
import { PaymentsRepository } from './payments/payments.repository.js';
import { PaymentsService } from './payments/payments.service.js';
import { paymentsExternalController } from './payments/payments.external-controller.js';
import { AdapterClient } from './shared/adapter-client/adapter-client.js';
import { apiKeyAuth } from './shared/auth/api-key.middleware.js';
import { PlansRepository } from './plans/plans.repository.js';
import { PlansService } from './plans/plans.service.js';
import { plansExternalController } from './plans/plans.external-controller.js';

const config = loadConfig(z.object({
	...baseConfigShape,
	PORT: env.port(3000),
	DATABASE_URL: env.databaseUrl,
	ADMIN_TOKEN: env.secret(),
	ADAPTER_URL: env.url,
	SERVICE_TOKEN: env.secret(),
}));

const logger = createLogger(config.LOG_LEVEL);
const { db, pool } = createDb(config.DATABASE_URL);

const adapterClient = new AdapterClient({
	baseUrl: config.ADAPTER_URL,
	serviceToken: config.SERVICE_TOKEN,
});
const projectsService = new ProjectsService(new ProjectsRepository(db), adapterClient);
const customersService = new CustomersService(new CustomersRepository(db));
const paymentsService = new PaymentsService(
	new PaymentsRepository(db),
	projectsService,
	customersService,
	adapterClient,
);
const plansService = new PlansService(new PlansRepository(db), projectsService);

const app = express();
app.use(express.json());
app.use(correlationMiddleware(logger));
app.get('/health', (_req, res) => {
	res.json({ status: 'ok' });
});

const admin = express.Router();
admin.use(tokenAuth('x-admin-token', config.ADMIN_TOKEN));
admin.use('/projects', projectsExternalController(projectsService));
admin.use('/projects/:projectId/plans', plansExternalController(plansService));
app.use('/v1/admin', admin);

app.use('/v1/payments', apiKeyAuth(projectsService), paymentsExternalController(paymentsService));

app.use(errorHandler(logger));

const server = app.listen(config.PORT, () => logger.info({ port: config.PORT }, 'payments-api up'));

const shutdown = () => {
	server.close(() => void pool.end());
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
