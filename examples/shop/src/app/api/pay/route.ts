import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { PaymentsApiError, createPayment } from '@/lib/payments';
import { products } from '@/lib/products';

export async function POST(req: Request) {
	const { productId, email } = await req.json();
	const product = products.find((p) => p.id === productId);
	if (!product) {
		return NextResponse.json({ error: 'Unknown product' }, { status: 400 });
	}
	const shopUrl = process.env.SHOP_URL ?? 'http://localhost:3002';
	try {
		const payment = await createPayment({
			idempotencyKey: randomUUID(),
			amount: product.price,
			currency: product.currency,
			customerRef: email || 'guest',
			email: email || undefined,
			returnUrl: `${shopUrl}/return`,
			metadata: { productId: product.id },
		});
		// Mock PSP redirects straight to returnUrl with ?mock_object=<providerPaymentId>;
		// remember our payment id by appending it so the return page can look it up.
		const url = payment.action?.url ? new URL(payment.action.url) : null;
		url?.searchParams.set('payment_id', payment.id);
		return NextResponse.json({ paymentId: payment.id, redirectUrl: url?.toString() ?? null });
	} catch (e) {
		const status = e instanceof PaymentsApiError ? e.status : 500;
		return NextResponse.json({ error: (e as Error).message }, { status });
	}
}
