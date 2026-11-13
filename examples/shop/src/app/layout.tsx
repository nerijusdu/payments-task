import type { ReactNode } from 'react';
import './globals.css';

export const metadata = { title: 'Test Shop' };

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body className="min-h-screen bg-slate-50 text-slate-900">
				<main className="mx-auto max-w-2xl px-4 py-12">{children}</main>
			</body>
		</html>
	);
}
