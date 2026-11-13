import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SUBSCRIPTION_STATUSES, api, formatMoney } from '../api';
import type { AdminSubscription } from '../api';
import { Button, Card, ErrorMessage, Modal, Select, StatusBadge, td, th } from '../ui';

const PAGE_SIZE = 25;
const date = (s: string | null) => (s ? new Date(s).toLocaleString() : '—');

function SubscriptionModal({ sub, onClose }: { sub: AdminSubscription; onClose: () => void }) {
	const rows: [string, string][] = [
		['ID', sub.id],
		['Project', sub.projectName],
		['Plan', `${sub.planName} (${sub.planCode})`],
		['Provider', sub.providerCode],
		['Provider subscription ID', sub.providerSubscriptionId ?? '—'],
		['Price', formatMoney(sub.amount, sub.currency)],
		['Customer', sub.customerRef],
		['Email', sub.customerEmail ?? '—'],
		['Period start', date(sub.currentPeriodStart)],
		['Period end', date(sub.currentPeriodEnd)],
		['Cancels at period end', sub.cancelAtPeriodEnd ? 'Yes' : 'No'],
		['Canceled at', date(sub.canceledAt)],
		['Created', date(sub.createdAt)],
	];
	return (
		<Modal title="Subscription" onClose={onClose}>
			<div className="mb-3"><StatusBadge status={sub.status} /></div>
			<dl className="space-y-2 text-sm">
				{rows.map(([k, v]) => (
					<div key={k} className="grid grid-cols-3 gap-2">
						<dt className="text-slate-500">{k}</dt>
						<dd className="col-span-2 break-all">{v}</dd>
					</div>
				))}
			</dl>
		</Modal>
	);
}

export function SubscriptionsPage() {
	const [params, setParams] = useSearchParams();
	const [page, setPage] = useState(0);
	const [selected, setSelected] = useState<AdminSubscription | null>(null);
	const projectId = params.get('projectId') ?? '';
	const status = params.get('status') ?? '';

	const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects });
	const subs = useQuery({
		queryKey: ['subscriptions', projectId, status, page],
		queryFn: () => api.subscriptions({
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
			<h1 className="text-xl font-semibold">Subscriptions</h1>
			<div className="flex flex-wrap gap-3">
				<div className="w-48">
					<Select value={projectId} onChange={(e) => setFilter('projectId', e.target.value)}>
						<option value="">All projects</option>
						{projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
					</Select>
				</div>
				<div className="w-48">
					<Select value={status} onChange={(e) => setFilter('status', e.target.value)}>
						<option value="">All statuses</option>
						{SUBSCRIPTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
					</Select>
				</div>
			</div>
			<ErrorMessage error={subs.error} />
			<Card>
				<table className="w-full divide-y divide-slate-200">
					<thead>
						<tr>
							<th className={th}>Created</th>
							<th className={th}>Project</th>
							<th className={th}>Customer</th>
							<th className={th}>Plan</th>
							<th className={th}>Provider</th>
							<th className={th}>Price</th>
							<th className={th}>Renews / ends</th>
							<th className={th}>Status</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{subs.isLoading && <tr><td className={td} colSpan={8}>Loading…</td></tr>}
						{subs.data?.length === 0 && (
							<tr><td className={`${td} text-slate-500`} colSpan={8}>No subscriptions found.</td></tr>
						)}
						{subs.data?.map((s) => (
							<tr key={s.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(s)}>
								<td className={td}>{date(s.createdAt)}</td>
								<td className={td}>{s.projectName}</td>
								<td className={td}>{s.customerRef}</td>
								<td className={td}>{s.planName}</td>
								<td className={td}>{s.providerCode}</td>
								<td className={td}>{formatMoney(s.amount, s.currency)}</td>
								<td className={td}>{date(s.currentPeriodEnd)}</td>
								<td className={td}>
									<StatusBadge status={s.status} />
									{s.cancelAtPeriodEnd && s.status !== 'canceled' && (
										<span className="ml-1 text-xs text-slate-500">cancels</span>
									)}
								</td>
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
					disabled={(subs.data?.length ?? 0) < PAGE_SIZE}
					onClick={() => setPage(page + 1)}
				>
					Next
				</Button>
			</div>
			{selected && <SubscriptionModal sub={selected} onClose={() => setSelected(null)} />}
		</>
	);
}
