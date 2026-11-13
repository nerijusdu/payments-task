import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { CreatedProject } from '../api';
import { Button, Card, ErrorMessage, Field, Modal, TextInput, td, th } from '../ui';

function CreateProjectModal({ onClose }: { onClose: () => void }) {
	const qc = useQueryClient();
	const [name, setName] = useState('');
	const [webhookUrl, setWebhookUrl] = useState('');
	const [created, setCreated] = useState<CreatedProject | null>(null);

	const create = useMutation({
		mutationFn: api.createProject,
		onSuccess: (res) => {
			setCreated(res);
			void qc.invalidateQueries({ queryKey: ['projects'] });
		},
	});

	const submit = (e: FormEvent) => {
		e.preventDefault();
		create.mutate({ name, webhookUrl: webhookUrl || undefined });
	};

	if (created) {
		return (
			<Modal title="Project created" onClose={onClose}>
				<div className="space-y-3">
					<p className="text-sm text-amber-700">
						Copy these now. They are shown only once.
					</p>
					<Secret label="API key" value={created.apiKey} />
					{created.webhookSecret && <Secret label="Webhook secret" value={created.webhookSecret} />}
					<div className="flex justify-end">
						<Button onClick={onClose}>Done</Button>
					</div>
				</div>
			</Modal>
		);
	}

	return (
		<Modal title="New project" onClose={onClose}>
			<form onSubmit={submit} className="space-y-4">
				<ErrorMessage error={create.error} />
				<Field label="Name">
					<TextInput value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
				</Field>
				<Field label="Webhook URL" hint="Optional. Where payment events are delivered.">
					<TextInput
						type="url"
						value={webhookUrl}
						onChange={(e) => setWebhookUrl(e.target.value)}
						placeholder="https://example.com/webhooks"
					/>
				</Field>
				<div className="flex justify-end gap-2">
					<Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
					<Button type="submit" disabled={create.isPending}>Create</Button>
				</div>
			</form>
		</Modal>
	);
}

function Secret({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<div className="text-sm font-medium text-slate-700">{label}</div>
			<code className="block break-all rounded bg-slate-100 p-2 text-xs">{value}</code>
		</div>
	);
}

export function ProjectsPage() {
	const [creating, setCreating] = useState(false);
	const { data, error, isLoading } = useQuery({ queryKey: ['projects'], queryFn: api.projects });

	return (
		<>
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-semibold">Projects</h1>
				<Button onClick={() => setCreating(true)}>New project</Button>
			</div>
			<ErrorMessage error={error} />
			<Card>
				<table className="w-full divide-y divide-slate-200">
					<thead>
						<tr>
							<th className={th}>Name</th>
							<th className={th}>Webhook URL</th>
							<th className={th}>Created</th>
							<th className={th} />
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{isLoading && <tr><td className={td} colSpan={4}>Loading…</td></tr>}
						{data?.length === 0 && (
							<tr><td className={`${td} text-slate-500`} colSpan={4}>No projects yet.</td></tr>
						)}
						{data?.map((p) => (
							<tr key={p.id}>
								<td className={`${td} font-medium`}>
									<Link to={`/projects/${p.id}`} className="text-indigo-600 hover:underline">{p.name}</Link>
								</td>
								<td className={`${td} text-slate-600`}>{p.webhookUrl ?? '—'}</td>
								<td className={`${td} text-slate-600`}>{new Date(p.createdAt).toLocaleString()}</td>
								<td className={`${td} text-right`}>
									<Link to={`/payments?projectId=${p.id}`} className="text-slate-500 hover:underline">
										Payments
									</Link>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</Card>
			{creating && <CreateProjectModal onClose={() => setCreating(false)} />}
		</>
	);
}
