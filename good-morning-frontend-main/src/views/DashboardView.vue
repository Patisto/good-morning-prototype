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
].map(section => ({ ...section, available: auth.canSee(section.id) })));
function openSection(section: typeof sections.value[number]) {
    if (section.available) void router.push(`/${section.id === 'users' ? 'team' : section.id}`);
}
</script>
<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <header>
      <p class="text-sm font-medium uppercase tracking-wide text-primary">Good Morning workspace</p>
      <h2 class="mt-1 text-2xl font-semibold">Welcome, {{ auth.name }}</h2>
      <p class="mt-1 text-sm text-ink-muted">Choose a section to get started.</p>
    </header>
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <button v-for="section in sections" :key="section.id" type="button" class="group relative min-h-44 rounded-xl border bg-surface p-5 text-left transition" :class="section.available ? 'border-line hover:-translate-y-0.5 hover:border-primary hover:shadow-md' : 'cursor-not-allowed border-line/70 bg-paper text-ink-muted'" :aria-disabled="!section.available" @click="openSection(section)">
        <span class="flex h-11 w-11 items-center justify-center rounded-xl text-2xl" :class="section.available ? 'bg-primary-light text-primary-dark' : 'bg-paper text-ink-muted'">{{ section.icon }}</span>
        <span class="mt-5 flex items-center justify-between gap-3 text-lg font-semibold" :class="section.available ? 'text-ink' : 'text-ink-muted'">
          {{ section.title }}
          <span v-if="section.available" class="text-primary transition group-hover:translate-x-1">→</span>
          <span v-else class="text-xs font-medium">🔒 Locked</span>
        </span>
        <span class="mt-1 block text-sm text-ink-muted">{{ section.detail }}</span>
      </button>
    </div>
  </div>
</template>
