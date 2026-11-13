import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from './api';

interface AuthContextValue {
	isAuthenticated: boolean;
	login: (username: string, password: string) => Promise<void>;
	logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [token, setToken] = useState(tokenStore.get());

	const logout = useCallback(() => {
		tokenStore.clear();
		setToken(null);
	}, []);

	const login = useCallback(async (username: string, password: string) => {
		const res = await api.login(username, password);
		tokenStore.set(res.token);
		setToken(res.token);
	}, []);

	useEffect(() => setUnauthorizedHandler(logout), [logout]);

	const value = useMemo(
		() => ({ isAuthenticated: token !== null, login, logout }),
		[token, login, logout],
	);
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error('useAuth must be used inside AuthProvider');
	}
	return ctx;
}
