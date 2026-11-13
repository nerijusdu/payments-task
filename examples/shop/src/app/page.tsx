'use client';

import { useState } from 'react';
import { formatMoney, plans, products } from '@/lib/products';

export default function Home() {
	const [email, setEmail] = useState('');
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function buy(productId: string, kind: 'pay' | 'subscribe' = 'pay') {
		setBusy(productId);
		setError(null);
		const res = await fetch(`/api/${kind}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(kind === 'pay' ? { productId, email } : { planCode: productId, email }),
		});
		const body = await res.json();
		if (!res.ok || !body.redirectUrl) {
			setError(body.error ?? 'Could not start payment');
			setBusy(null);
			return;
		}
		window.location.href = body.redirectUrl;
	}

	return (
		<>
			<h1 className="text-3xl font-bold">Test Shop</h1>
			<p className="mt-1 text-slate-600">Tiny demo store paying through the payments service.</p>

			<input
				type="email"
				value={email}
				onChange={(e) => setEmail(e.target.value)}
				placeholder="Email (optional)"
				className="mt-6 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
			/>

			<ul className="mt-6 space-y-3">
				{products.map((p) => (
					<li key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
						<div>
							<div className="font-medium">{p.name}</div>
							<div className="text-sm text-slate-500">{formatMoney(p.price, p.currency)}</div>
						</div>
						<button
							onClick={() => buy(p.id)}
							disabled={busy !== null}
							className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
						>
							{busy === p.id ? 'Redirecting…' : 'Buy'}
						</button>
					</li>
				))}
			</ul>

			<h2 className="mt-8 text-xl font-semibold">Subscriptions</h2>
			<ul className="mt-3 space-y-3">
				{plans.map((p) => (
					<li key={p.code} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
						<div>
							<div className="font-medium">{p.name}</div>
							<div className="text-sm text-slate-500">{formatMoney(p.price, p.currency)} / {p.interval}</div>
						</div>
						<button
							onClick={() => buy(p.code, 'subscribe')}
							disabled={busy !== null}
							className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
						>
							{busy === p.code ? 'Redirecting…' : 'Subscribe'}
						</button>
					</li>
				))}
			</ul>

			{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
		</>
	);
}
