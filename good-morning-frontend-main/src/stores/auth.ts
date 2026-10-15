import { defineStore } from 'pinia';
import { api, ApiError } from '@/lib/api';
import type { Role } from '@/types';
const STORAGE_KEY = 'good-morning-auth';
interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: Role;
}
interface StoredSession {
    token: string;
    user: AuthUser;
}
function loadStoredSession(): StoredSession | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return null;
        return JSON.parse(raw) as StoredSession;
    }
    catch {
        return null;
    }
}
const initial = loadStoredSession();
export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: initial?.token ?? (null as string | null),
        user: initial?.user ?? (null as AuthUser | null),
        status: 'idle' as 'idle' | 'loading' | 'error',
        error: null as string | null,
    }),
    getters: {
        isAuthenticated: (state) => !!state.token && !!state.user,
        name: (state) => state.user?.name ?? '',
        role: (state) => state.user?.role ?? null,
        canManageUsers: state => ['OWNER', 'ADMINISTRATOR', 'SYSTEM_ADMINISTRATOR'].includes(state.user?.role ?? ''),
        canReport: state => ['OWNER', 'ADMINISTRATOR', 'SUPER_MANAGER', 'ACCOUNTANT'].includes(state.user?.role ?? ''),
        canManage: state => (section: string) => ['OWNER', 'ADMINISTRATOR', 'SUPER_MANAGER', `${section.toUpperCase()}_MANAGER`].includes(state.user?.role ?? ''),
        canSee: (state) => (section: string) => {
            const role = state.user?.role;
            if (!role)
                return false;
            if (section === 'users')
                return ['OWNER', 'ADMINISTRATOR', 'SYSTEM_ADMINISTRATOR'].includes(role);
            if (['OWNER', 'ADMINISTRATOR', 'SUPER_MANAGER'].includes(role))
                return true;
            if (section === 'reports')
                return role === 'ACCOUNTANT';
            if (section === 'expenses' || section === 'finance')
                return ['HOSTEL_MANAGER', 'RESTAURANT_MANAGER', 'GROCERY_MANAGER', 'ACCOUNTANT'].includes(role);
            return role === 'ACCOUNTANT' || role.startsWith(section.toUpperCase() + '_');
        },
    },
    actions: {
        async login(email: string, password: string) {
            this.status = 'loading';
            this.error = null;
            try {
                const data = await api.post<{
                    token: string;
                    user: AuthUser;
                }>('/auth/login', { email, password });
                this.token = data.token;
                this.user = data.user;
                this.status = 'idle';
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                return true;
            }
            catch (err) {
                this.status = 'error';
                this.error = err instanceof ApiError ? err.message : 'Could not reach the server.';
                return false;
            }
        },
        logout() {
            this.token = null;
            this.user = null;
            this.error = null;
            localStorage.removeItem(STORAGE_KEY);
        },
    },
});
