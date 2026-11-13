import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { PaymentsApiError, createSubscription } from '@/lib/payments';
import { plans } from '@/lib/products';

export async function POST(req: Request) {
	const { planCode, email } = await req.json();
	const plan = plans.find((p) => p.code === planCode);
	if (!plan) {
		return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
	}
	const shopUrl = process.env.SHOP_URL ?? 'http://localhost:3002';
	try {
		const sub = await createSubscription({
			idempotencyKey: randomUUID(),
			planCode: plan.code,
			customerRef: email || 'guest',
			email: email || undefined,
			returnUrl: `${shopUrl}/subscription`,
		});
		const url = sub.action?.url ? new URL(sub.action.url) : null;
		url?.searchParams.set('subscription_id', sub.id);
		return NextResponse.json({ subscriptionId: sub.id, redirectUrl: url?.toString() ?? null });
	} catch (e) {
		const status = e instanceof PaymentsApiError ? e.status : 500;
		return NextResponse.json({ error: (e as Error).message }, { status });
	}
}
