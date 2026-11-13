import { NextResponse } from 'next/server';
import { PaymentsApiError, cancelSubscription } from '@/lib/payments';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
	const { atPeriodEnd } = await req.json().catch(() => ({}));
	try {
		return NextResponse.json(await cancelSubscription((await params).id, atPeriodEnd !== false));
	} catch (e) {
		const status = e instanceof PaymentsApiError ? e.status : 500;
		return NextResponse.json({ error: (e as Error).message }, { status });
	}
}
