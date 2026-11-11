import { AppError } from '@payments/http';
import type { PaymentProvider } from './payment-provider.js';

export class ProviderRegistry {
	private readonly providers = new Map<string, PaymentProvider>();

	constructor(providers: PaymentProvider[]) {
		for (const p of providers) this.providers.set(p.code, p);
	}

	get(code: string): PaymentProvider {
		const provider = this.providers.get(code);
		if (!provider) throw AppError.notFound(`Unknown provider: ${code}`);
		return provider;
	}
}
