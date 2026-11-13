import { NextResponse } from 'next/server';
import { PaymentsApiError, getSubscription } from '@/lib/payments';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		return NextResponse.json(await getSubscription((await params).id));
	} catch (e) {
		const status = e instanceof PaymentsApiError ? e.status : 500;
		return NextResponse.json({ error: (e as Error).message }, { status });
	}
}
