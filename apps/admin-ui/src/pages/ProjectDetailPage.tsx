import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Project, ProjectProviderConfig } from '../api';
import { Button, Card, ErrorMessage, Field, Modal, Secret, Select, TextInput, inputClass, td, th } from '../ui';

const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

function ProviderModal({ projectId, providerCode, existing, onClose }: {
	projectId: string;
	providerCode?: string;
	existing?: ProjectProviderConfig;
	onClose: () => void;
}) {
	const qc = useQueryClient();
	const providers = useQuery({ queryKey: ['providers'], queryFn: api.providers });
	const [code, setCode] = useState(providerCode ?? '');
	const [isEnabled, setIsEnabled] = useState(existing?.isEnabled ?? true);
	const [sortOrder, setSortOrder] = useState(String(existing?.sortOrder ?? 0));
	const [methods, setMethods] = useState(existing?.supportedMethods.join(', ') ?? '');
	const [currencies, setCurrencies] = useState(existing?.currencies.join(', ') ?? '');
	const [credentials, setCredentials] = useState('{}');
	const [webhookSecret, setWebhookSecret] = useState('');
	const [localError, setLocalError] = useState<string | null>(null);

	const save = useMutation({
		mutationFn: (input: Parameters<typeof api.configureProvider>[2]) =>
			api.configureProvider(projectId, code, input),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ['project', projectId] });
			onClose();
		},
	});

	const submit = (e: FormEvent) => {
		e.preventDefault();
		setLocalError(null);
		let parsed: unknown;
		try {
			parsed = JSON.parse(credentials);
		} catch {
			setLocalError('Credentials must be valid JSON');
			return;
		}
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			setLocalError('Credentials must be a JSON object');
			return;
		}
		save.mutate({
			isEnabled,
			sortOrder: Number(sortOrder) || 0,
			supportedMethods: splitList(methods),
			currencies: splitList(currencies).map((c) => c.toUpperCase()),
			credentials: parsed as Record<string, unknown>,
			webhookSecret: webhookSecret || undefined,
		});
	};

	return (
		<Modal title={providerCode ? `Configure ${providerCode}` : 'Add provider'} onClose={onClose}>
			<form onSubmit={submit} className="space-y-4">
				<ErrorMessage error={save.error} />
				{localError && <ErrorMessage error={localError} />}
				<Field label="Provider">
					<Select
						value={code}
						onChange={(e) => setCode(e.target.value)}
						disabled={!!providerCode}
						required
					>
						<option value="" disabled>Select…</option>
						{providers.data?.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
					</Select>
				</Field>
				<label className="flex items-center gap-2 text-sm">
					<input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
					Enabled
				</label>
				<Field label="Sort order">
					<TextInput type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
				</Field>
				<Field label="Supported methods" hint="Comma separated, e.g. card, paypal">
					<TextInput value={methods} onChange={(e) => setMethods(e.target.value)} />
				</Field>
				<Field label="Currencies" hint="Comma separated ISO codes. Empty means all.">
					<TextInput value={currencies} onChange={(e) => setCurrencies(e.target.value)} placeholder="EUR, USD" />
				</Field>
				<Field
					label="Provider credentials (JSON)"
					hint="API keys used to call this PSP, e.g. {&quot;secretKey&quot;: &quot;sk_live_...&quot;}. Keys depend on the provider; the Mock PSP needs none, so {} is fine. Stored encrypted by psp-adapter, write-only: saving replaces them and they are never shown again."
				>
					<textarea
						className={`${inputClass} font-mono`}
						rows={4}
						value={credentials}
						onChange={(e) => setCredentials(e.target.value)}
					/>
				</Field>
				<Field
					label="Webhook secret"
					hint={`Optional, write-only. Used to verify webhooks sent by the PSP to POST /webhooks/${code || '{provider}'}/${projectId} on psp-adapter.`}
				>
					<TextInput type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
				</Field>
				<div className="flex justify-end gap-2">
					<Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
					<Button type="submit" disabled={save.isPending}>Save</Button>
				</div>
			</form>
		</Modal>
	);
}

function EditProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
	const qc = useQueryClient();
	const [name, setName] = useState(project.name);
	const [webhookUrl, setWebhookUrl] = useState(project.webhookUrl ?? '');
	const save = useMutation({
		mutationFn: () => api.updateProject(project.id, { name, webhookUrl: webhookUrl || null }),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ['project', project.id] });
			void qc.invalidateQueries({ queryKey: ['projects'] });
			onClose();
		},
	});
	return (
		<Modal title="Edit project" onClose={onClose}>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					save.mutate();
				}}
				className="space-y-4"
			>
				<ErrorMessage error={save.error} />
				<Field label="Name">
					<TextInput value={name} onChange={(e) => setName(e.target.value)} required />
				</Field>
				<Field label="Webhook URL" hint="Your backend endpoint that receives payment events. Leave empty to disable.">
					<TextInput type="url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
				</Field>
				<div className="flex justify-end gap-2">
					<Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
					<Button type="submit" disabled={save.isPending}>Save</Button>
				</div>
			</form>
		</Modal>
	);
}

export function ProjectDetailPage() {
	const { id = '' } = useParams();
	const qc = useQueryClient();
	const { data, error, isLoading } = useQuery({
		queryKey: ['project', id],
		queryFn: () => api.project(id),
	});
	const [editing, setEditing] = useState<{ existing?: ProjectProviderConfig } | null>(null);

	const remove = useMutation({
		mutationFn: (code: string) => api.removeProvider(id, code),
		onSuccess: () => void qc.invalidateQueries({ queryKey: ['project', id] }),
	});

	const [editingProject, setEditingProject] = useState(false);
	const [newKey, setNewKey] = useState<string | null>(null);
	const rotate = useMutation({
		mutationFn: () => api.rotateApiKey(id),
		onSuccess: (res) => setNewKey(res.apiKey),
	});
	const confirmRotate = () => {
		if (window.confirm('Rotate the API key? The current key stops working immediately.')) {
			rotate.mutate();
		}
	};

	if (isLoading) {
		return <p>Loading…</p>;
	}
	if (error || !data) {
		return <ErrorMessage error={error} />;
	}

	return (
		<>
			<div>
				<Link to="/projects" className="text-sm text-slate-500 hover:underline">← Projects</Link>
				<div className="flex items-center gap-3">
					<h1 className="text-xl font-semibold">{data.name}</h1>
					<button className="text-sm text-indigo-600 hover:underline" onClick={() => setEditingProject(true)}>
						Edit
					</button>
				</div>
				<p className="text-sm text-slate-500">{data.id}</p>
				<p className="text-sm text-slate-500">
					API key: hidden.
					<button className="ml-1 text-indigo-600 hover:underline" onClick={confirmRotate}>
						Rotate
					</button>
				</p>
				<ErrorMessage error={rotate.error} />
				<p className="text-sm text-slate-500">
					Webhook URL (project events are sent here): {data.webhookUrl ?? 'not set'}
				</p>
			</div>

			<div className="flex items-center justify-between">
				<h2 className="font-semibold">Payment providers</h2>
				<div className="flex gap-2">
					<Link to={`/payments?projectId=${id}`}>
						<Button variant="secondary">View payments</Button>
					</Link>
					<Button onClick={() => setEditing({})}>Add provider</Button>
				</div>
			</div>
			<ErrorMessage error={remove.error} />
			<Card>
				<table className="w-full divide-y divide-slate-200">
					<thead>
						<tr>
							<th className={th}>Provider</th>
							<th className={th}>Enabled</th>
							<th className={th}>Order</th>
							<th className={th}>Methods</th>
							<th className={th}>Currencies</th>
							<th className={th} />
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{data.providers.length === 0 && (
							<tr><td className={`${td} text-slate-500`} colSpan={6}>No providers configured.</td></tr>
						)}
						{data.providers.map((p) => (
							<tr key={p.providerCode}>
								<td className={`${td} font-medium`}>{p.providerName}</td>
								<td className={td}>{p.isEnabled ? 'Yes' : 'No'}</td>
								<td className={td}>{p.sortOrder}</td>
								<td className={td}>{p.supportedMethods.join(', ') || '—'}</td>
								<td className={td}>{p.currencies.join(', ') || 'All'}</td>
								<td className={`${td} space-x-3 text-right`}>
									<button className="text-indigo-600 hover:underline" onClick={() => setEditing({ existing: p })}>
										Edit
									</button>
									<button
										className="text-red-600 hover:underline"
										onClick={() => {
											if (confirm(`Remove ${p.providerName} and its credentials?`)) {
												remove.mutate(p.providerCode);
											}
										}}
									>
										Remove
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</Card>

			{newKey && (
				<Modal title="API key rotated" onClose={() => setNewKey(null)}>
					<div className="space-y-3">
						<p className="text-sm text-amber-700">Copy it now. It is shown only once.</p>
						<Secret label="API key" value={newKey} />
						<div className="flex justify-end">
							<Button onClick={() => setNewKey(null)}>Done</Button>
						</div>
					</div>
				</Modal>
			)}
			{editingProject && <EditProjectModal project={data} onClose={() => setEditingProject(false)} />}
			{editing && (
				<ProviderModal
					projectId={id}
					providerCode={editing.existing?.providerCode}
					existing={editing.existing}
					onClose={() => setEditing(null)}
				/>
			)}
		</>
	);
}
