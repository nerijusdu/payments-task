import { createHash, randomBytes } from 'node:crypto';

export const generateApiKey = () => `pk_${randomBytes(24).toString('hex')}`;
export const generateWebhookSecret = () => `whsec_${randomBytes(24).toString('hex')}`;
export const hashApiKey = (key: string) => createHash('sha256').update(key).digest('hex');
