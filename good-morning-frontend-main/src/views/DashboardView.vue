<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import { ApiError, api, fromApi } from '@/lib/api';
import { formatMWK, today } from '@/types';
const auth = useAuthStore();
const router = useRouter();
const sections = computed(() => [
    { id: 'hostel', access: 'hostel', group: 'Operations', path: '/hostel', title: 'Hostel', detail: 'Rooms, tenants and rent payments', icon: '⌂' },
    { id: 'restaurant-upper', access: 'restaurant', group: 'Operations', path: '/restaurant?business=RESTAURANT_A', title: 'Upper restaurant', detail: 'Sales, stock and meal cards', icon: '◉' },
    { id: 'restaurant-lower', access: 'restaurant', group: 'Operations', path: '/restaurant?business=RESTAURANT_B', title: 'Lower restaurant', detail: 'Sales, stock and meal cards', icon: '◍' },
    { id: 'grocery', access: 'grocery', group: 'Operations', path: '/grocery', title: 'Grocery', detail: 'Sales, products and stock', icon: '▦' },
    { id: 'finance', access: 'finance', group: 'Operations', path: '/finance', title: 'Finance', detail: 'Revenue, expenses and reports', icon: '₭' },
    { id: 'users', access: 'users', group: 'Administration', path: '/team', title: 'Team & roles', detail: 'Manage staff access', icon: '♙' },
].filter(section => auth.canSee(section.access)));
const operations = computed(() => sections.value.filter(section => section.group === 'Operations'));
const administration = computed(() => sections.value.filter(section => section.group === 'Administration'));
const canCheckOperationalStatus = computed(() => auth.canSee('hostel') || auth.canSee('restaurant') || auth.canSee('grocery'));
const alerts = ref<{ id: string; title: string; detail: string; path: string }[]>([]);
const alertLoading = ref(false), alertError = ref('');
const checkedAreas = ref(0);
type StatusResult = {
    lowStockCount?: number;
    owingCount?: number;
    outstanding?: number;
    missingChargeCount?: number;
};
type StatusTask = {
    id: string;
    title: string;
    path: string;
    statusRequest: Promise<unknown>;
    legacyRequest: () => Promise<unknown>;
};
function openSection(section: typeof sections.value[number]) {
    void router.push(section.path);
}
async function loadStatus(task: StatusTask): Promise<StatusResult> {
    try {
        return fromApi<StatusResult>(await task.statusRequest);
    }
    catch (cause) {
        if (!(cause instanceof ApiError) || cause.status !== 404)
            throw cause;
        const data = fromApi<{
            products?: { currentStock: number; lowStockLevel: number }[];
            charges?: { tenantId: string; expectedAmount: number; amountPaid: number; openingBalance: number }[];
            tenants?: { id: string; moveInDate: string; checkoutDate?: string }[];
        }>(await task.legacyRequest());
        if (data.products) {
            return {
                lowStockCount: data.products.filter(product => product.currentStock <= product.lowStockLevel).length,
            };
        }
        if (data.charges && data.tenants) {
            const month = today().slice(0, 7);
            const owing = data.charges.filter(charge => charge.openingBalance + charge.amountPaid - charge.expectedAmount < 0);
            const chargedTenantIds = new Set(data.charges.map(charge => charge.tenantId));
            const eligibleTenants = data.tenants.filter(tenant => tenant.moveInDate?.slice(0, 7) <= month
                && (!tenant.checkoutDate || tenant.checkoutDate.slice(0, 7) >= month));
            return {
                owingCount: owing.length,
                outstanding: owing.reduce((total, charge) => total + Math.max(0, charge.expectedAmount - charge.openingBalance - charge.amountPaid), 0),
                missingChargeCount: eligibleTenants.filter(tenant => !chargedTenantIds.has(tenant.id)).length,
            };
        }
        return {};
    }
}
async function loadOperationalAlerts() {
    alertLoading.value = true;
    alertError.value = '';
    checkedAreas.value = 0;
    const date = today();
    const tasks: StatusTask[] = [];
    if (auth.canSee('grocery'))
        tasks.push({
            id: 'grocery',
            title: 'Grocery',
            path: '/grocery?tab=stock',
            statusRequest: api.get(`/grocery/status?business=GROCERY&date=${date}`, auth.token),
            legacyRequest: () => api.get(`/grocery?business=GROCERY&date=${date}`, auth.token),
        });
    if (auth.canSee('restaurant')) {
        tasks.push({
            id: 'restaurant-upper',
            title: 'Upper restaurant',
            path: '/restaurant?business=RESTAURANT_A&tab=stock',
            statusRequest: api.get(`/restaurant/status?business=RESTAURANT_A&date=${date}`, auth.token),
            legacyRequest: () => api.get(`/restaurant?business=RESTAURANT_A&date=${date}`, auth.token),
        });
        tasks.push({
            id: 'restaurant-lower',
            title: 'Lower restaurant',
            path: '/restaurant?business=RESTAURANT_B&tab=stock',
            statusRequest: api.get(`/restaurant/status?business=RESTAURANT_B&date=${date}`, auth.token),
            legacyRequest: () => api.get(`/restaurant?business=RESTAURANT_B&date=${date}`, auth.token),
        });
    }
    if (auth.canSee('hostel'))
        tasks.push({
            id: 'hostel',
            title: 'Hostel',
            path: '/hostel?tab=payments',
            statusRequest: api.get(`/hostel/status?month=${date.slice(0, 7)}`, auth.token),
            legacyRequest: () => api.get(`/hostel?month=${date.slice(0, 7)}`, auth.token),
        });
    try {
        const results = await Promise.allSettled(tasks.map(task => loadStatus(task)));
        const nextAlerts: typeof alerts.value = [], failures: string[] = [];
        results.forEach((result, index) => {
            const task = tasks[index];
            if (result.status === 'rejected') {
                failures.push(`${task.title}: ${result.reason instanceof Error ? result.reason.message : 'Could not load live status.'}`);
                return;
            }
            checkedAreas.value += 1;
            const data = result.value;
            if (typeof data.lowStockCount === 'number' && data.lowStockCount > 0)
                nextAlerts.push({ id: task.id, title: `${task.title} stock needs attention`, detail: `${data.lowStockCount} item${data.lowStockCount === 1 ? '' : 's'} at or below its low-stock level.`, path: task.path });
            if (task.id === 'hostel' && typeof data.owingCount === 'number' && data.owingCount > 0)
                nextAlerts.push({ id: 'hostel-rent', title: 'Rent payments outstanding', detail: `${data.owingCount} tenant${data.owingCount === 1 ? '' : 's'} owe ${formatMWK(data.outstanding ?? 0)} this month.`, path: task.path });
            if (task.id === 'hostel' && typeof data.missingChargeCount === 'number' && data.missingChargeCount > 0)
                nextAlerts.push({ id: 'hostel-charges', title: 'Rent charges need completion', detail: `${data.missingChargeCount} active tenant${data.missingChargeCount === 1 ? '' : 's'} not included in this month’s charges.`, path: task.path });
        });
        alerts.value = nextAlerts;
        alertError.value = failures.length
            ? `Could not load live status for ${failures.join(', ')}. Check the API connection and retry.`
            : '';
    }
    finally {
        alertLoading.value = false;
    }
}
onMounted(loadOperationalAlerts);
</script>
<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <header>
      <p class="text-sm font-medium uppercase tracking-wide text-primary">Good Morning workspace</p>
      <h2 class="mt-1 text-2xl font-semibold">Welcome, {{ auth.name }}</h2>
      <p class="mt-1 text-sm text-ink-muted">Open an operation or manage staff access.</p>
    </header>
    <section v-if="canCheckOperationalStatus" class="rounded-lg border border-line bg-surface p-4 sm:p-5" aria-labelledby="operational-status-heading">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="operational-status-heading" class="font-semibold">Operational status</h3>
          <p class="text-sm text-ink-muted">{{ alertLoading ? 'Checking live stock and rent data…' : `Live check · ${checkedAreas} area${checkedAreas === 1 ? '' : 's'} · ${today()}` }}</p>
        </div>
        <button type="button" class="btn-secondary" :disabled="alertLoading" @click="loadOperationalAlerts">{{ alertLoading ? 'Checking…' : 'Refresh status' }}</button>
      </div>
      <p v-if="alertError" class="mt-3 rounded bg-danger-light p-3 text-sm text-danger" role="alert">
        Some live status could not be loaded: {{ alertError }}
        <button type="button" class="ml-1 font-medium underline" @click="loadOperationalAlerts">Retry</button>
      </p>
      <div v-if="!alertLoading && !alertError && !alerts.length" class="mt-3 rounded bg-success-light p-3 text-sm text-success" role="status">No low-stock or outstanding-rent alerts in the checked areas.</div>
      <ul v-if="alerts.length" class="mt-3 grid gap-2 sm:grid-cols-2">
        <li v-for="alert in alerts" :key="alert.id">
          <router-link :to="alert.path" class="flex h-full items-start justify-between gap-3 rounded border border-pending/40 bg-pending-light p-3 text-left hover:border-pending">
            <span>
              <span class="block font-semibold text-ink">{{ alert.title }}</span>
              <span class="mt-1 block text-sm text-ink-muted">{{ alert.detail }}</span>
            </span>
            <span class="text-primary" aria-hidden="true">→</span>
          </router-link>
        </li>
      </ul>
    </section>
    <section v-if="operations.length" class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-ink-muted">Operations</h3>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <button v-for="section in operations" :key="section.id" type="button" class="group min-h-36 rounded-lg border border-line bg-surface p-5 text-left transition hover:border-primary hover:shadow-md" @click="openSection(section)">
          <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-xl font-semibold text-primary-dark">{{ section.icon }}</span>
          <span class="mt-4 flex items-center justify-between gap-3 font-semibold text-ink">
            {{ section.title }}
            <span class="text-primary transition group-hover:translate-x-1" aria-hidden="true">→</span>
          </span>
          <span class="mt-1 block text-sm text-ink-muted">{{ section.detail }}</span>
        </button>
      </div>
    </section>
    <section v-if="administration.length" class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-ink-muted">Administration</h3>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <button v-for="section in administration" :key="section.id" type="button" class="group min-h-36 rounded-lg border border-line bg-surface p-5 text-left transition hover:border-primary hover:shadow-md" @click="openSection(section)">
          <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-paper text-xl font-semibold text-ink-muted">{{ section.icon }}</span>
          <span class="mt-4 flex items-center justify-between gap-3 font-semibold text-ink">
            {{ section.title }}
            <span class="text-primary transition group-hover:translate-x-1" aria-hidden="true">→</span>
          </span>
          <span class="mt-1 block text-sm text-ink-muted">{{ section.detail }}</span>
        </button>
      </div>
    </section>
    <p v-if="!sections.length" class="rounded-lg border border-line bg-surface p-5 text-sm text-ink-muted">Your account does not have access to any sections. Contact your system manager.</p>
  </div>
</template>
