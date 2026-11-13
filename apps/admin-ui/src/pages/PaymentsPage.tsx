import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PAYMENT_STATUSES, api, formatMoney } from '../api';
import type { AdminPayment } from '../api';
import { Button, Card, ErrorMessage, Modal, Select, StatusBadge, td, th } from '../ui';

const PAGE_SIZE = 25;

function PaymentModal({ payment, onClose }: { payment: AdminPayment; onClose: () => void }) {
	const rows: [string, string][] = [
		['ID', payment.id],
		['Project', payment.projectName],
		['Provider', payment.providerCode],
		['Provider payment ID', payment.providerPaymentId ?? '—'],
		['Amount', formatMoney(payment.amount, payment.currency)],
		['Subscription', payment.subscriptionId ?? '—'],
		['Customer', payment.customerRef],
		['Email', payment.customerEmail ?? '—'],
		['Created', new Date(payment.createdAt).toLocaleString()],
	];
	return (
		<Modal title="Payment" onClose={onClose}>
			<div className="mb-3"><StatusBadge status={payment.status} /></div>
			<dl className="space-y-2 text-sm">
				{rows.map(([k, v]) => (
					<div key={k} className="grid grid-cols-3 gap-2">
						<dt className="text-slate-500">{k}</dt>
						<dd className="col-span-2 break-all">{v}</dd>
					</div>
				))}
				<div>
					<dt className="mb-1 text-slate-500">Metadata</dt>
					<dd>
						<pre className="overflow-x-auto rounded bg-slate-100 p-2 text-xs">
							{JSON.stringify(payment.metadata ?? {}, null, 2)}
						</pre>
					</dd>
				</div>
			</dl>
		</Modal>
	);
}

export function PaymentsPage() {
	const [params, setParams] = useSearchParams();
	const [page, setPage] = useState(0);
	const [selected, setSelected] = useState<AdminPayment | null>(null);
	const projectId = params.get('projectId') ?? '';
	const status = params.get('status') ?? '';

	const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects });
	const payments = useQuery({
		queryKey: ['payments', projectId, status, page],
		queryFn: () => api.payments({
			projectId: projectId || undefined,
			status: status || undefined,
			limit: PAGE_SIZE,
			offset: page * PAGE_SIZE,
		}),
	});

	const setFilter = (key: string, value: string) => {
		const next = new URLSearchParams(params);
		if (value) {
			next.set(key, value);
		} else {
			next.delete(key);
		}
		setParams(next);
		setPage(0);
	};

	return (
		<>
			<h1 className="text-xl font-semibold">Payments</h1>
			<div className="flex flex-wrap gap-3">
				<div className="w-48">
					<Select
						value={projectId}
						onChange={(e) => setFilter('projectId', e.target.value)}
					>
						<option value="">All projects</option>
						{projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
					</Select>
				</div>
				<div className="w-48">
					<Select
						value={status}
						onChange={(e) => setFilter('status', e.target.value)}
					>
						<option value="">All statuses</option>
						{PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
					</Select>
				</div>
			</div>
			<ErrorMessage error={payments.error} />
			<Card>
				<table className="w-full divide-y divide-slate-200">
					<thead>
						<tr>
							<th className={th}>Created</th>
							<th className={th}>Project</th>
							<th className={th}>Customer</th>
							<th className={th}>Provider</th>
							<th className={th}>Type</th>
							<th className={th}>Amount</th>
							<th className={th}>Status</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{payments.isLoading && <tr><td className={td} colSpan={7}>Loading…</td></tr>}
						{payments.data?.length === 0 && (
							<tr><td className={`${td} text-slate-500`} colSpan={7}>No payments found.</td></tr>
						)}
						{payments.data?.map((p) => (
							<tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(p)}>
								<td className={td}>{new Date(p.createdAt).toLocaleString()}</td>
								<td className={td}>{p.projectName}</td>
								<td className={td}>{p.customerRef}</td>
								<td className={td}>{p.providerCode}</td>
								<td className={td}>{p.subscriptionId ? 'Subscription' : 'One-time'}</td>
								<td className={td}>{formatMoney(p.amount, p.currency)}</td>
								<td className={td}><StatusBadge status={p.status} /></td>
							</tr>
						))}
					</tbody>
				</table>
			</Card>
			<div className="flex items-center justify-end gap-2">
				<Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
					Previous
				</Button>
				<span className="text-sm text-slate-500">Page {page + 1}</span>
				<Button
					variant="secondary"
					disabled={(payments.data?.length ?? 0) < PAGE_SIZE}
					onClick={() => setPage(page + 1)}
				>
					Next
				</Button>
			</div>
			{selected && <PaymentModal payment={selected} onClose={() => setSelected(null)} />}
		</>
	);
}
