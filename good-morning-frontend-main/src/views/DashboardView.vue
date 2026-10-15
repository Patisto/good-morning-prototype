<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useTask } from '@/composables/useTask';
import { businessName, formatMWK, today } from '@/types';
const auth = useAuthStore(), { busy, error, run } = useTask();
const from = ref(today().slice(0, 7) + '-01'), to = ref(today());
const report = ref<{
    rows: {
        business: string;
        revenue: number;
        expenses: number;
    }[];
    outstanding: number;
    credit: number;
}>({ rows: [], outstanding: 0, credit: 0 });
const totalRevenue = computed(() => report.value.rows.reduce((s, r) => s + r.revenue, 0));
const totalExpenses = computed(() => report.value.rows.reduce((s, r) => s + r.expenses, 0));
async function load() { report.value = await api.get(`/reports?from=${from.value}&to=${to.value}`, auth.token); }
onMounted(() => { if (auth.canReport)
    void run(load); });
</script>
<template>
  <div class="space-y-5">
    <header>
      <h2 class="text-2xl font-semibold">
        {{ auth.canReport ? 'Business overview' : `Welcome, ${auth.name}` }}
      </h2>
      <p class="mt-1 text-sm text-ink-muted">
        {{ auth.canReport ? 'Revenue and expenses across Hostel, Restaurant A, Restaurant B, and Grocery.' : 'Open your workspace to manage today’s operations.' }}
      </p>
    </header>
    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>
    <template v-if="auth.canReport">
      <form class="panel flex flex-wrap items-end gap-3" @submit.prevent="run(load)">
        <label class="field">
          From
          <input v-model="from" class="input" type="date" required />
        </label>
        <label class="field">
          To
          <input v-model="to" class="input" type="date" required />
        </label>
        <button class="btn" :disabled="busy">
          {{ busy ? 'Loading…' : 'Update report' }}
        </button>
      </form>
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="panel">
          <p class="text-sm text-ink-muted">
            Total revenue received
          </p>
          <p class="mt-2 text-2xl font-semibold">
            {{ formatMWK(totalRevenue) }}
          </p>
        </div>
        <div class="panel">
          <p class="text-sm text-ink-muted">
            Recorded expenses
          </p>
          <p class="mt-2 text-2xl font-semibold">
            {{ formatMWK(totalExpenses) }}
          </p>
        </div>
        <div class="panel">
          <p class="text-sm text-ink-muted">
            Revenue less expenses
          </p>
          <p class="mt-2 text-2xl font-semibold">
            {{ formatMWK(totalRevenue-totalExpenses) }}
          </p>
        </div>
      </div>
      <div class="panel overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>
                Business
              </th>
              <th>
                Revenue
              </th>
              <th>
                Expenses
              </th>
              <th>
                Net cash
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in report.rows" :key="r.business">
              <td>
                {{ businessName(r.business) }}
              </td>
              <td>
                {{ formatMWK(r.revenue) }}
              </td>
              <td>
                {{ formatMWK(r.expenses) }}
              </td>
              <td>
                {{ formatMWK(r.revenue-r.expenses) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-sm text-ink-muted">
        Cash report: hostel receipts use their payment date, sales use their sale date, and expenses use their recorded date. Inventory purchases must be recorded in Expenses. Legacy restaurant records remain separate because their A/B location is unknown.
      </p>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="panel">
          <p class="text-sm text-ink-muted">
            Outstanding hostel rent · all generated months
          </p>
          <p class="mt-2 text-xl font-semibold">
            {{ formatMWK(report.outstanding) }}
          </p>
        </div>
        <div class="panel">
          <p class="text-sm text-ink-muted">
            Hostel credits · all generated months
          </p>
          <p class="mt-2 text-xl font-semibold">
            {{ formatMWK(report.credit) }}
          </p>
        </div>
      </div>
    </template>
    <div class="grid gap-4 sm:grid-cols-3">
      <router-link v-for="section in ['hostel','restaurant','grocery','finance'].filter(s=>auth.canSee(s))" :key="section" :to="`/${section}`" class="panel font-semibold capitalize hover:border-primary">
        Open {{ section }} →
      </router-link>
    </div>
  </div>
</template>
