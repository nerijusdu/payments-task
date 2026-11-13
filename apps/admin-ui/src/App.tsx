import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { LoginPage } from './pages/LoginPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { PaymentsPage } from './pages/PaymentsPage';

function Layout() {
	const { logout } = useAuth();
	const link = ({ isActive }: { isActive: boolean }) =>
		`rounded-md px-3 py-2 text-sm font-medium ${
			isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
		}`;
	return (
		<div className="min-h-screen">
			<header className="border-b border-slate-200 bg-white">
				<div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
					<span className="mr-4 font-semibold">Payments Admin</span>
					<NavLink to="/projects" className={link}>Projects</NavLink>
					<NavLink to="/payments" className={link}>Payments</NavLink>
					<button onClick={logout} className="ml-auto text-sm text-slate-500 hover:text-slate-800">
						Sign out
					</button>
				</div>
			</header>
			<main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
				<Outlet />
			</main>
		</div>
	);
}

export function App() {
	const { isAuthenticated } = useAuth();
	if (!isAuthenticated) {
		return (
			<Routes>
				<Route path="*" element={<LoginPage />} />
			</Routes>
		);
	}
	return (
		<Routes>
			<Route element={<Layout />}>
				<Route path="/projects" element={<ProjectsPage />} />
				<Route path="/projects/:id" element={<ProjectDetailPage />} />
				<Route path="/payments" element={<PaymentsPage />} />
				<Route path="*" element={<Navigate to="/projects" replace />} />
			</Route>
		</Routes>
	);
}
