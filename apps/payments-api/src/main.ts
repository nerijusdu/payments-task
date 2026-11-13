import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AdminLoginDto } from '@payments/contracts';
import { baseConfigShape, env, loadConfig, queueConfigShape } from '@payments/config';
import {
	AppError, asyncHandler, correlationMiddleware, createLogger, errorHandler, parseBody, tokenAuth,
} from '@payments/http';
import { createEventQueue } from '@payments/queue';
import { WebhookEventsRepository } from './webhook-events/webhook-events.repository.js';
import { WebhookEventsService } from './webhook-events/webhook-events.service.js';
import { startWebhookEventsWorker } from './webhook-events/webhook-events.worker.js';
import { createDb } from './shared/db/client.js';
import { ProjectsRepository } from './projects/projects.repository.js';
import { ProjectsService } from './projects/projects.service.js';
import { projectsAdminController } from './projects/projects.admin-controller.js';
import { CustomersRepository } from './customers/customers.repository.js';
import { CustomersService } from './customers/customers.service.js';
import { PaymentsRepository } from './payments/payments.repository.js';
import { PaymentsService } from './payments/payments.service.js';
import { paymentsExternalController } from './payments/payments.external-controller.js';
import { AdapterClient } from './shared/adapter-client/adapter-client.js';
import { apiKeyAuth } from './shared/auth/api-key.middleware.js';
import { PlansRepository } from './plans/plans.repository.js';
import { PlansService } from './plans/plans.service.js';
import { paymentsAdminController } from './payments/payments.admin-controller.js';
import { plansAdminController } from './plans/plans.admin-controller.js';

const config = loadConfig(z.object({
	...baseConfigShape,
	PORT: env.port(3000),
	DATABASE_URL: env.databaseUrl,
	...queueConfigShape,
	ADMIN_TOKEN: env.secret(),
	ADMIN_USERNAME: z.string().default('admin'),
	ADMIN_PASSWORD: z.string().default('admin'),
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
const queue = createEventQueue({
	driver: config.QUEUE_DRIVER,
	connectionString: config.QUEUE_DATABASE_URL ?? config.DATABASE_URL,
	schema: config.QUEUE_SCHEMA,
	manageSchema: true,
});
const webhookEventsService = new WebhookEventsService(
	new WebhookEventsRepository(db),
	projectsService,
	paymentsService,
	logger,
);
await queue.start();
await startWebhookEventsWorker(queue, webhookEventsService);
const plansService = new PlansService(new PlansRepository(db), projectsService);

const app = express();
app.use(express.json());
app.use(correlationMiddleware(logger));
app.get('/health', (_req, res) => {
	res.json({ status: 'ok' });
});

const safeEqual = (a: string, b: string) => {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
};

// Admin routes
const admin = express.Router();
admin.post('/login', asyncHandler(async (req, res) => {
	const { username, password } = parseBody(AdminLoginDto, req.body);
	const valid = safeEqual(username, config.ADMIN_USERNAME)
		&& safeEqual(password, config.ADMIN_PASSWORD);
	if (!valid) {
		throw AppError.unauthorized();
	}
	res.json({ token: config.ADMIN_TOKEN });
}));
admin.use(tokenAuth('x-admin-token', config.ADMIN_TOKEN));
admin.get('/providers', asyncHandler(async (_req, res) => {
	res.json(await projectsService.listAvailableProviders());
}));
admin.use('/projects', projectsAdminController(projectsService));
admin.use('/payments', paymentsAdminController(paymentsService));
admin.use('/projects/:projectId/plans', plansAdminController(plansService));
app.use('/v1/admin', admin);

// External routes
app.use('/v1/payments', apiKeyAuth(projectsService), paymentsExternalController(paymentsService));

app.use(errorHandler(logger));

const server = app.listen(config.PORT, () => logger.info({ port: config.PORT }, 'payments-api up'));

const shutdown = () => {
	server.close(() => void queue.stop().then(() => pool.end()));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
