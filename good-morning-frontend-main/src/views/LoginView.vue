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
  <div class="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <img :src="logo" alt="Good Morning" class="mx-auto mb-3 h-20 w-20 rounded-2xl object-cover shadow-sm" />
        <p class="text-2xl font-semibold leading-tight">Good Morning</p>
        <p class="text-sm text-ink-muted">Hostel · Restaurant · Grocery</p>
      </div>

      <form class="space-y-4 rounded border border-line bg-surface p-6" @submit.prevent="submit">
        <h1 class="text-lg font-semibold">Sign in</h1>

        <div class="space-y-1">
          <label class="text-sm font-medium text-ink-muted" for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="username"
            required
            placeholder="you@goodmorning.mw"
            class="w-full rounded border border-line px-3 py-2 text-sm focus:border-primary"
          />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-ink-muted" for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            placeholder="••••••••"
            class="w-full rounded border border-line px-3 py-2 text-sm focus:border-primary"
          />
        </div>

        <p v-if="auth.error" class="rounded bg-danger-light px-3 py-2 text-sm text-danger">
          {{ auth.error }}
        </p>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full rounded bg-primary py-2.5 font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ submitting ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </div>
  </div>
</template>
