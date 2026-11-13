const TOKEN_KEY = 'admin-token';

export const tokenStore = {
	get: () => sessionStorage.getItem(TOKEN_KEY),
	set: (token: string) => sessionStorage.setItem(TOKEN_KEY, token),
	clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
	constructor(readonly status: number, message: string, readonly details?: unknown) {
		super(message);
	}
}

let onUnauthorized: () => void = () => { };
export const setUnauthorizedHandler = (fn: () => void) => {
	onUnauthorized = fn;
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const headers: Record<string, string> = {};
	const token = tokenStore.get();
	if (token) {
		headers['x-admin-token'] = token;
	}
	if (body !== undefined) {
		headers['content-type'] = 'application/json';
	}
	const res = await fetch(`/v1/admin${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	if (res.status === 204) {
		return undefined as T;
	}
	const json = await res.json().catch(() => null);
	if (!res.ok) {
		if (res.status === 401 && path !== '/login') {
			onUnauthorized();
		}
		throw new ApiError(res.status, json?.error?.message ?? res.statusText, json?.error?.details);
	}
	return json as T;
}

export interface Project {
	id: string;
	name: string;
	webhookUrl: string | null;
	createdAt: string;
}
export interface ProjectProviderConfig {
	providerCode: string;
	providerName: string;
	isEnabled: boolean;
	sortOrder: number;
	supportedMethods: string[];
	currencies: string[];
}
export interface ProjectDetail extends Project {
	providers: ProjectProviderConfig[];
}
export interface Provider {
	code: string;
	name: string;
}
export interface CreatedProject {
	id: string;
	name: string;
	apiKey: string;
	webhookSecret?: string;
}
export const PAYMENT_STATUSES = [
	'pending', 'requires_action', 'succeeded', 'failed', 'canceled', 'refunded',
] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];
export interface AdminPayment {
	id: string;
	projectId: string;
	projectName: string;
	providerCode: string;
	customerRef: string;
	customerEmail: string | null;
	amount: number;
	currency: string;
	status: PaymentStatus;
	providerPaymentId: string | null;
	subscriptionId: string | null;
	metadata: Record<string, string> | null;
	createdAt: string;
}
export interface ConfigureProviderInput {
	isEnabled: boolean;
	sortOrder: number;
	supportedMethods: string[];
	currencies: string[];
	credentials: Record<string, unknown>;
	webhookSecret?: string;
}

export const SUBSCRIPTION_STATUSES = [
	'pending', 'trialing', 'active', 'past_due', 'canceled',
] as const;
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[number];
export interface AdminSubscription {
	id: string;
	projectId: string;
	projectName: string;
	providerCode: string;
	planCode: string;
	planName: string;
	customerRef: string;
	customerEmail: string | null;
	amount: number;
	currency: string;
	status: SubscriptionStatus;
	providerSubscriptionId: string | null;
	currentPeriodStart: string | null;
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: boolean;
	canceledAt: string | null;
	createdAt: string;
}

export interface AdminPlan {
	id: string;
	code: string;
	name: string;
	amount: number;
	currency: string;
	interval: 'day' | 'week' | 'month' | 'year';
	intervalCount: number;
	trialDays: number;
	providerMappings: { providerCode: string; providerPriceId: string }[];
}
export interface CreatePlanInput {
	code: string;
	name: string;
	amount: number;
	currency: string;
	interval: AdminPlan['interval'];
	intervalCount: number;
	trialDays: number;
	providerMappings: { providerCode: string; providerPriceId: string }[];
}

export const api = {
	subscriptions: (params: { projectId?: string; status?: string; limit: number; offset: number }) => {
		const qs = new URLSearchParams();
		for (const [k, v] of Object.entries(params)) {
			if (v !== undefined && v !== '') {
				qs.set(k, String(v));
			}
		}
		return request<AdminSubscription[]>('GET', `/subscriptions?${qs}`);
	},
	plans: (projectId: string) => request<AdminPlan[]>('GET', `/projects/${projectId}/plans`),
	createPlan: (projectId: string, input: CreatePlanInput) =>
		request<AdminPlan>('POST', `/projects/${projectId}/plans`, input),
	login: (username: string, password: string) =>
		request<{ token: string }>('POST', '/login', { username, password }),
	projects: () => request<Project[]>('GET', '/projects'),
	project: (id: string) => request<ProjectDetail>('GET', `/projects/${id}`),
	createProject: (input: { name: string; webhookUrl?: string }) =>
		request<CreatedProject>('POST', '/projects', input),
	updateProject: (id: string, input: { name?: string; webhookUrl?: string | null }) =>
		request<Project>('PATCH', `/projects/${id}`, input),
	rotateApiKey: (id: string) =>
		request<{ apiKey: string }>('POST', `/projects/${id}/rotate-api-key`),
	providers: () => request<Provider[]>('GET', '/providers'),
	configureProvider: (projectId: string, code: string, input: ConfigureProviderInput) =>
		request<ProjectProviderConfig>('PUT', `/projects/${projectId}/providers/${code}`, input),
	removeProvider: (projectId: string, code: string) =>
		request<void>('DELETE', `/projects/${projectId}/providers/${code}`),
	payments: (params: { projectId?: string; status?: string; limit: number; offset: number }) => {
		const qs = new URLSearchParams();
		for (const [k, v] of Object.entries(params)) {
			if (v !== undefined && v !== '') {
				qs.set(k, String(v));
			}
		}
		return request<AdminPayment[]>('GET', `/payments?${qs}`);
	},
};

export const formatMoney = (minor: number, currency: string) => {
	try {
		return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100);
	} catch {
		return `${(minor / 100).toFixed(2)} ${currency}`;
	}
};
