import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth';
import { Button, ErrorMessage, Field, TextInput } from '../ui';

export function LoginPage() {
	const { login } = useAuth();
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<unknown>(null);
	const [busy, setBusy] = useState(false);

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			await login(username, password);
		} catch (err) {
			setError(err);
			setBusy(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
				<h1 className="text-xl font-semibold">Payments Admin</h1>
				<ErrorMessage error={error} />
				<Field label="Username">
					<TextInput value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
				</Field>
				<Field label="Password">
					<TextInput
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>
				</Field>
				<Button type="submit" disabled={busy} className="w-full">Sign in</Button>
			</form>
		</div>
	);
}
