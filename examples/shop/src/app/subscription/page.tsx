'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatMoney } from '@/lib/products';
import type { Subscription } from '@/lib/payments';

function SubscriptionContent() {
	const id = useSearchParams().get('subscription_id');
	const [sub, setSub] = useState<Subscription | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		const res = await fetch(`/api/subscriptions/${id}`);
		const body = await res.json();
		if (!res.ok) {
			setError(body.error ?? 'Failed to load subscription');
			return null;
		}
		setSub(body);
		return body as Subscription;
	}, [id]);

	useEffect(() => {
		if (!id) {
			return;
		}
		let stop = false;
		const tick = async () => {
			const s = await load();
			if (!stop && s && s.status === 'pending') {
				setTimeout(tick, 2000);
			}
		};
		void tick();
		return () => {
			stop = true;
		};
	}, [id, load]);

	async function cancel(atPeriodEnd: boolean) {
		setBusy(true);
		setError(null);
		const res = await fetch(`/api/subscriptions/${id}/cancel`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ atPeriodEnd }),
		});
		const body = await res.json();
		if (res.ok) {
			setSub(body);
		} else {
			setError(body.error ?? 'Could not cancel');
		}
		setBusy(false);
	}

	if (!id) {
		return <p>Missing subscription id.</p>;
	}

	return (
		<div className="rounded-lg border border-slate-200 bg-white p-6">
			<h1 className="text-2xl font-bold">Subscription status</h1>
			{error && <p className="mt-3 text-red-700">{error}</p>}
			{sub && (
				<dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
					<dt className="text-slate-500">Status</dt>
					<dd className="font-medium">{sub.status}{sub.cancelAtPeriodEnd ? ' (cancels at period end)' : ''}</dd>
					<dt className="text-slate-500">Plan</dt>
					<dd>{sub.planCode}</dd>
					<dt className="text-slate-500">Price</dt>
					<dd>{formatMoney(sub.amount, sub.currency)}</dd>
					{sub.currentPeriodEnd && (
						<>
							<dt className="text-slate-500">Current period ends</dt>
							<dd>{new Date(sub.currentPeriodEnd).toLocaleDateString()}</dd>
						</>
					)}
					<dt className="text-slate-500">Subscription ID</dt>
					<dd className="break-all font-mono">{sub.id}</dd>
				</dl>
			)}
			{!sub && !error && <p className="mt-3 text-slate-500">Loading…</p>}
			{sub?.status === 'pending' && (
				<p className="mt-4 text-sm text-slate-500">
					Waiting for the PSP confirmation webhook. The mock provider sends it automatically
					after a couple of seconds.
				</p>
			)}
			{sub && sub.status !== 'canceled' && !sub.cancelAtPeriodEnd && (
				<div className="mt-4 flex gap-2">
					<button
						onClick={() => cancel(true)}
						disabled={busy}
						className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
					>
						Cancel at period end
					</button>
					<button
						onClick={() => cancel(false)}
						disabled={busy}
						className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50"
					>
						Cancel now
					</button>
				</div>
			)}
			<Link href="/" className="mt-6 inline-block text-sm text-indigo-600 hover:underline">← Back to shop</Link>
		</div>
	);
}

export default function SubscriptionPage() {
	return (
		<Suspense>
			<SubscriptionContent />
		</Suspense>
	);
}
