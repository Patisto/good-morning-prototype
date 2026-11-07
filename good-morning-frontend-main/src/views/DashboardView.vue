<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
const auth = useAuthStore();
const router = useRouter();
const sections = computed(() => [
    { id: 'hostel', title: 'Hostel', detail: 'Rooms, tenants and rent payments', icon: '⌂' },
    { id: 'restaurant', title: 'Restaurant', detail: 'Upper and lower restaurant operations', icon: '♨' },
    { id: 'grocery', title: 'Grocery', detail: 'Sales, products and stock', icon: '▤' },
    { id: 'finance', title: 'Finance', detail: 'Revenue, expenses and reports', icon: '₭' },
    { id: 'users', title: 'Team & roles', detail: 'Manage staff access', icon: '♙' },
].filter(section => auth.canSee(section.id)));
function openSection(section: typeof sections.value[number]) {
    void router.push(`/${section.id === 'users' ? 'team' : section.id}`);
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
