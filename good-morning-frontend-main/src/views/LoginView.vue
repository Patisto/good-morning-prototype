<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import logo from '@/goodmorniglogo.png'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const submitting = ref(false)
const showPassword = ref(false)

async function submit() {
  submitting.value = true
  const ok = await auth.login(email.value.trim(), password.value)
  submitting.value = false
  if (ok) {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.replace(redirect)
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-paper px-4 py-8">
    <main class="w-full max-w-md rounded-2xl border border-line bg-surface p-7 shadow-lg sm:p-8">
      <header class="mb-7">
        <div class="flex items-center justify-center gap-3 text-center">
          <img :src="logo" alt="Good Morning" class="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-sm" />
          <div class="text-left">
            <p class="text-2xl font-extrabold leading-none text-primary">GOOD MORNING</p>
            <p class="mt-1 text-xs font-bold tracking-wide text-ink">BUSINESS MANAGEMENT</p>
            <p class="text-xs font-bold tracking-wide text-ink">SYSTEM</p>
          </div>
        </div>
        <p class="mt-5 text-center text-sm text-ink-muted">Sign in to start your session</p>
      </header>

      <form class="space-y-5" @submit.prevent="submit">

        <div class="space-y-1">
          <label class="text-sm font-medium text-ink-muted" for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="username"
            required
            placeholder="you@goodmorning.mw"
            class="w-full rounded border border-primary px-4 py-2.5 text-sm"
          />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-ink-muted" for="password">Password</label>
          <div class="flex items-center rounded border border-primary bg-surface px-4 py-2.5">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
              placeholder="Enter your password"
              class="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <button
              type="button"
              class="ml-3 text-ink-muted hover:text-primary"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <svg v-if="showPassword" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5"><path stroke-linecap="round" stroke-linejoin="round" d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.9 10.9 0 0 1 12 4c5 0 8.3 4.2 9 6-.3.8-1.1 2.2-2.5 3.5M6.2 6.2C4.4 7.5 3.3 9.4 3 10c.7 1.8 4 6 9 6 1.4 0 2.7-.3 3.8-.8" /></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>
            </button>
          </div>
        </div>

        <div v-if="auth.error" role="alert" class="flex items-center gap-2 rounded-lg bg-danger-light p-3 text-sm text-danger">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5 shrink-0"><circle cx="12" cy="12" r="9" /><path stroke-linecap="round" d="M12 8v4m0 4h.01" /></svg>
          {{ auth.error }}
        </div>

        <button
          type="submit"
          :disabled="submitting"
          class="flex w-full items-center justify-center gap-2 rounded bg-primary py-3 font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg v-if="submitting" class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="9" class="opacity-25" /><path d="M21 12a9 9 0 0 0-9-9" stroke-linecap="round" /></svg>
          {{ submitting ? 'Signing in…' : 'Login' }}
        </button>
      </form>

      <p class="mt-5 text-center text-sm text-ink-muted">Use the account provided by your administrator.</p>
    </main>
  </div>
</template>
