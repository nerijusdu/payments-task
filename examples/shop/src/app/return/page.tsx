'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatMoney } from '@/lib/products';
import type { Payment } from '@/lib/payments';

const FINAL = ['succeeded', 'failed', 'canceled', 'refunded'];

function ReturnContent() {
	const id = useSearchParams().get('payment_id');
	const [payment, setPayment] = useState<Payment | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!id) {
			return;
		}
		let stop = false;
		const tick = async () => {
			const res = await fetch(`/api/payments/${id}`);
			const body = await res.json();
			if (stop) {
				return;
			}
			if (!res.ok) {
				setError(body.error ?? 'Failed to load payment');
				return;
			}
			setPayment(body);
			if (!FINAL.includes(body.status)) {
				setTimeout(tick, 2000);
			}
		};
		void tick();
		return () => {
			stop = true;
		};
	}, [id]);

	if (!id) {
		return <p>Missing payment id.</p>;
	}

	return (
		<div className="rounded-lg border border-slate-200 bg-white p-6">
			<h1 className="text-2xl font-bold">Payment status</h1>
			{error && <p className="mt-3 text-red-700">{error}</p>}
			{payment && (
				<dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
					<dt className="text-slate-500">Status</dt>
					<dd className="font-medium">{payment.status}</dd>
					<dt className="text-slate-500">Amount</dt>
					<dd>{formatMoney(payment.amount, payment.currency)}</dd>
					<dt className="text-slate-500">Provider</dt>
					<dd>{payment.providerCode}</dd>
					<dt className="text-slate-500">Payment ID</dt>
					<dd className="break-all font-mono">{payment.id}</dd>
				</dl>
			)}
			{!payment && !error && <p className="mt-3 text-slate-500">Loading…</p>}
			{payment && !FINAL.includes(payment.status) && (
				<p className="mt-4 text-sm text-slate-500">
					Waiting for the PSP confirmation webhook. With the mock provider, send a signed
					payment.updated webhook to the adapter to finish it.
				</p>
			)}
			<Link href="/" className="mt-6 inline-block text-sm text-indigo-600 hover:underline">← Back to shop</Link>
		</div>
	);
}

export default function ReturnPage() {
	return (
		<Suspense>
			<ReturnContent />
		</Suspense>
	);
}
