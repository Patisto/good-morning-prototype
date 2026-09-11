import { defineStore } from 'pinia'
import { api, ApiError } from '@/lib/api'
import type { Role } from '@/types'

const STORAGE_KEY = 'good-morning-auth'

interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
}

interface StoredSession {
  token: string
  user: AuthUser
}

function loadStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredSession
  } catch {
    return null
  }
}

const initial = loadStoredSession()

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
    canSee: (state) => (section: 'hostel' | 'restaurant' | 'grocery' | 'expenses') => {
      const role = state.user?.role
      if (!role) return false
      const full = ['OWNER', 'ADMINISTRATOR']
      if (full.includes(role)) return true
      if (section === 'hostel') return role === 'HOSTEL_MANAGER' || role === 'ACCOUNTANT'
      if (section === 'restaurant') return ['RESTAURANT_MANAGER', 'RESTAURANT_CASHIER', 'ACCOUNTANT'].includes(role)
      if (section === 'grocery') return ['GROCERY_MANAGER', 'GROCERY_CASHIER', 'ACCOUNTANT'].includes(role)
      if (section === 'expenses') return role === 'ACCOUNTANT'
      return false
    },
  },
  actions: {
    async login(email: string, password: string) {
      this.status = 'loading'
      this.error = null
      try {
        const data = await api.post<{ token: string; user: AuthUser }>('/auth/login', { email, password })
        this.token = data.token
        this.user = data.user
        this.status = 'idle'
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        return true
      } catch (err) {
        this.status = 'error'
        this.error = err instanceof ApiError ? err.message : 'Could not reach the server.'
        return false
      }
    },
    logout() {
      this.token = null
      this.user = null
      this.error = null
      localStorage.removeItem(STORAGE_KEY)
    },
  },
})
