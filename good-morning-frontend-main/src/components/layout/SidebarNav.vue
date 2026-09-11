<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import logo from '@/goodmorniglogo.png'

const auth = useAuthStore()

defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()

type NavSection = 'hostel' | 'restaurant' | 'grocery' | 'expenses' | 'settings'

const links: { to: string; label: string; section: NavSection | null }[] = [
  { to: '/', label: 'Dashboard', section: null },
  { to: '/hostel', label: 'Hostel', section: 'hostel' },
  { to: '/restaurant', label: 'Restaurant', section: 'restaurant' },
  { to: '/grocery', label: 'Grocery', section: 'grocery' },
  { to: '/expenses', label: 'Expenses', section: 'expenses' },
  { to: '/settings', label: 'Settings', section: 'settings' },
]
</script>

<template>
  <!-- backdrop, mobile only -->
  <div
    v-if="open"
    class="fixed inset-0 z-30 bg-ink/40 lg:hidden"
    @click="$emit('close')"
  />

  <nav
    class="fixed inset-y-0 left-0 z-40 flex w-64 max-w-[80vw] shrink-0 -translate-x-full flex-col border-r border-line bg-surface transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:w-56 lg:translate-x-0"
    :class="{ 'translate-x-0': open }"
  >
    <div class="flex items-center justify-between px-5 py-6">
      <div class="flex items-center gap-3">
        <img :src="logo" alt="Good Morning" class="h-10 w-10 shrink-0 rounded-xl object-cover" />
        <div>
          <p class="text-lg font-semibold leading-tight">Good Morning</p>
          <p class="text-sm text-ink-muted">Hostel · Restaurant · Grocery</p>
        </div>
      </div>
      <button
        type="button"
        class="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-primary-light hover:text-primary-dark lg:hidden"
        aria-label="Close menu"
        @click="$emit('close')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <ul class="flex-1 space-y-1 px-3">
      <li v-for="link in links" :key="link.to">
        <router-link
          v-if="!link.section || auth.canSee(link.section)"
          :to="link.to"
          class="block rounded px-3 py-2 text-sm font-medium text-ink-muted hover:bg-primary-light hover:text-primary-dark"
          active-class="!bg-primary !text-white"
          @click="$emit('close')"
        >
          {{ link.label }}
        </router-link>
      </li>
    </ul>
    <div class="border-t border-line px-5 py-4">
      <p class="text-sm font-medium">{{ auth.name }}</p>
      <p class="text-xs text-ink-muted">{{ auth.role?.replaceAll('_', ' ').toLowerCase() }}</p>
    </div>
  </nav>
</template>
