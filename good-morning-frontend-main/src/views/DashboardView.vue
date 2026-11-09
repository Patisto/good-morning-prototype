<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
const auth = useAuthStore();
const router = useRouter();
const sections = computed(() => [
    { id: 'hostel', access: 'hostel', path: '/hostel', title: 'Hostel', detail: 'Rooms, tenants and rent payments', icon: '⌂' },
    { id: 'restaurant-upper', access: 'restaurant', path: '/restaurant?business=RESTAURANT_A', title: 'Upper restaurant', detail: 'Sales, stock and meal cards', icon: '♨' },
    { id: 'restaurant-lower', access: 'restaurant', path: '/restaurant?business=RESTAURANT_B', title: 'Lower restaurant', detail: 'Sales, stock and meal cards', icon: '♨' },
    { id: 'grocery', access: 'grocery', path: '/grocery', title: 'Grocery', detail: 'Sales, products and stock', icon: '▤' },
    { id: 'finance', access: 'finance', path: '/finance', title: 'Finance', detail: 'Revenue, expenses and reports', icon: '₭' },
    { id: 'users', access: 'users', path: '/team', title: 'Team & roles', detail: 'Manage staff access', icon: '♙' },
].filter(section => auth.canSee(section.access)));
function openSection(section: typeof sections.value[number]) {
    void router.push(section.path);
}
</script>
<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <header>
      <p class="text-sm font-medium uppercase tracking-wide text-primary">Good Morning workspace</p>
      <h2 class="mt-1 text-2xl font-semibold">Welcome, {{ auth.name }}</h2>
      <p class="mt-1 text-sm text-ink-muted">Choose one of the sections available to your role.</p>
    </header>
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <button v-for="section in sections" :key="section.id" type="button" class="group relative min-h-44 rounded-xl border border-line bg-surface p-5 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md" @click="openSection(section)">
        <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-2xl text-primary-dark">{{ section.icon }}</span>
        <span class="mt-5 flex items-center justify-between gap-3 text-lg font-semibold text-ink">
          {{ section.title }}
          <span class="text-primary transition group-hover:translate-x-1">→</span>
        </span>
        <span class="mt-1 block text-sm text-ink-muted">{{ section.detail }}</span>
      </button>
    </div>
    <p v-if="!sections.length" class="rounded-lg border border-line bg-surface p-5 text-sm text-ink-muted">Your account does not have access to any sections. Contact your system manager.</p>
  </div>
</template>
