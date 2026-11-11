import express from 'express';
import { z } from 'zod';
import { baseConfigShape, env, loadConfig } from '@payments/config';
import { correlationMiddleware, createLogger, errorHandler, tokenAuth } from '@payments/http';
import { CredentialsRepository } from './credentials/credentials.repository.js';
import { CredentialsService } from './credentials/credentials.service.js';
import { credentialsInternalController } from './credentials/credentials.internal-controller.js';
import { PaymentsService } from './payments/payments.service.js';
import { paymentsInternalController } from './payments/payments.internal-controller.js';
import { MockProvider } from './providers/mock/mock.provider.js';
import { ProviderRegistry } from './providers/provider-registry.js';
import { RefundsService } from './refunds/refunds.service.js';
import { refundsInternalController } from './refunds/refunds.internal-controller.js';
import { SubscriptionsService } from './subscriptions/subscriptions.service.js';
import { subscriptionsInternalController } from './subscriptions/subscriptions.internal-controller.js';
import { CredentialCipher } from './shared/crypto/credential-cipher.js';
import { createDb } from './shared/db/client.js';

const config = loadConfig(z.object({
	...baseConfigShape,
	PORT: env.port(3001),
	DATABASE_URL: env.databaseUrl,
	SERVICE_TOKEN: env.secret(),
	/** Base64-encoded 32-byte AES key. */
	CREDENTIALS_ENC_KEY: z.string().min(1),
	CREDENTIALS_ENC_KEY_VERSION: z.coerce.number().int().positive().default(1),
}));

const logger = createLogger(config.LOG_LEVEL);
const { db, pool } = createDb(config.DATABASE_URL);

const cipher = new CredentialCipher(
	{ [config.CREDENTIALS_ENC_KEY_VERSION]: config.CREDENTIALS_ENC_KEY },
	config.CREDENTIALS_ENC_KEY_VERSION,
);
const registry = new ProviderRegistry([new MockProvider()]);
const credentialsService = new CredentialsService(new CredentialsRepository(db), cipher);
const paymentsService = new PaymentsService(registry, credentialsService);
const subscriptionsService = new SubscriptionsService(registry, credentialsService);
const refundsService = new RefundsService(registry, credentialsService);

const app = express();
app.use(express.json());
app.use(correlationMiddleware(logger));
app.get('/health', (_req, res) => {
	res.json({ status: 'ok' });
});

const internal = express.Router();
internal.use(tokenAuth('x-service-token', config.SERVICE_TOKEN));
internal.use(
	'/internal/projects/:projectId/providers/:providerCode',
	credentialsInternalController(credentialsService),
);
internal.use('/v1/:providerCode/payments', paymentsInternalController(paymentsService));
internal.use('/v1/:providerCode/payments', refundsInternalController(refundsService));
internal.use('/v1/:providerCode/subscriptions', subscriptionsInternalController(subscriptionsService));
app.use(internal);

app.use(errorHandler(logger));

const server = app.listen(config.PORT, () => logger.info({ port: config.PORT }, 'psp-adapter up'));

const shutdown = () => {
	server.close(() => void pool.end());
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
