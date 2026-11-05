<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import logo from '@/goodmorniglogo.png';
const auth = useAuthStore();
const route = useRoute();
defineProps<{
    open: boolean;
}>();
defineEmits<{
    close: [
    ];
}>();
type NavSection = 'hostel' | 'restaurant' | 'grocery' | 'finance' | 'users';
const sectionTitle = computed(() => ({
    hostel: 'Hostel',
    restaurant: 'Restaurant',
    grocery: 'Grocery',
    finance: 'Finance',
    users: 'Team & roles',
}[String(route.name ?? '') as NavSection] ?? 'Section'));
const currentSubsections = computed(() => {
    if (route.path === '/hostel') return [{ label: 'Rooms', tab: 'rooms' }, { label: 'Tenants', tab: 'tenants' }, ...(auth.canManage('hostel') ? [{ label: 'Registrations', tab: 'registrations' }, { label: 'Bookings', tab: 'bookings' }] : []), { label: 'Monthly rent', tab: 'payments' }, ...(auth.canManage('hostel') ? [{ label: 'Room setup', tab: 'configuration' }] : [])];
    if (route.path === '/restaurant' || route.path === '/grocery') {
        const section = route.path.slice(1);
        return [{ label: 'Sales', tab: 'sales' }, { label: 'Stock', tab: 'stock' }, ...(section === 'restaurant' ? [{ label: 'Meal cards', tab: 'meal-cards' }] : []), ...(auth.canManage(section) ? [{ label: 'Configuration', tab: 'configuration' }] : [])];
    }
    return [];
});
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
      <li>
        <router-link to="/" class="mb-3 block rounded px-3 py-2 text-sm font-medium text-primary-dark hover:bg-primary-light" @click="$emit('close')">
          ← Back to sections
        </router-link>
      </li>
      <li class="border-t border-line px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">{{ sectionTitle }}</li>
      <li v-for="item in currentSubsections" :key="item.tab">
        <router-link :to="{ path: route.path, query: { ...route.query, tab: item.tab } }" class="block rounded px-3 py-2 text-sm text-ink-muted hover:bg-primary-light hover:text-primary-dark" :class="String(route.query.tab || (route.path === '/hostel' ? 'rooms' : 'sales')) === item.tab ? '!bg-primary-light !font-semibold !text-primary-dark' : ''" @click="$emit('close')">
          {{ item.label }}
        </router-link>
      </li>
    </ul>
    <div class="border-t border-line px-5 py-4">
      <p class="text-sm font-medium">{{ auth.name }}</p>
      <p class="text-xs text-ink-muted">{{ auth.role?.replaceAll('_', ' ').toLowerCase() }}</p>
    </div>
  </nav>
</template>
