import type {
	ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes,
} from 'react';

export const inputClass
	= 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm '
		+ 'focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<div className="relative">
			<select {...props} className={`${inputClass} appearance-none pr-9 ${className}`}>
				{children}
			</select>
			<svg
				className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06z" />
			</svg>
		</div>
	);
}

export function Button({
	variant = 'primary', className = '', ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
	const styles = {
		primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
		secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
		danger: 'bg-red-600 text-white hover:bg-red-700',
	}[variant];
	return (
		<button
			{...props}
			className={`rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${styles} ${className}`}
		/>
	);
}

export function Field({ label, hint, children }: {
	label: string;
	hint?: string;
	children: ReactNode;
}) {
	return (
		<label className="block space-y-1">
			<span className="text-sm font-medium text-slate-700">{label}</span>
			{children}
			{hint && <span className="block text-xs text-slate-500">{hint}</span>}
		</label>
	);
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
	return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function ErrorMessage({ error }: { error: unknown }) {
	if (!error) {
		return null;
	}
	const message = error instanceof Error ? error.message : String(error);
	return (
		<div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
			{message}
		</div>
	);
}

export function Modal({ title, onClose, children }: {
	title: string;
	onClose: () => void;
	children: ReactNode;
}) {
	return (
		<div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
			<div className="max-h-full w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-lg font-semibold">{title}</h2>
					<button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
						✕
					</button>
				</div>
				{children}
			</div>
		</div>
	);
}

const STATUS_COLORS: Record<string, string> = {
	succeeded: 'bg-green-100 text-green-800',
	pending: 'bg-slate-100 text-slate-700',
	requires_action: 'bg-amber-100 text-amber-800',
	failed: 'bg-red-100 text-red-800',
	canceled: 'bg-slate-200 text-slate-600',
	refunded: 'bg-blue-100 text-blue-800',
	active: 'bg-green-100 text-green-800',
	trialing: 'bg-blue-100 text-blue-800',
	past_due: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status }: { status: string }) {
	return (
		<span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? ''}`}>
			{status}
		</span>
	);
}

export const Card = ({ children }: { children: ReactNode }) => (
	<div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
		{children}
	</div>
);

export const th = 'px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500';
export const td = 'px-4 py-3 text-sm';

export function Secret({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<div className="text-sm font-medium text-slate-700">{label}</div>
			<code className="block break-all rounded bg-slate-100 p-2 text-xs">{value}</code>
		</div>
	);
}
