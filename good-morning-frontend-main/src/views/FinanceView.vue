<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api, fromApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useTask } from '@/composables/useTask';
import ExpenseModal from '@/components/management/ExpenseModal.vue';
import ReceivePaymentModal from '@/components/management/ReceivePaymentModal.vue';
import { businessName, formatMWK, today, type Business } from '@/types';
interface Summary {
    business: Business;
    income: number;
    expenses: number;
    count: number;
}
interface Entry {
    id: string;
    business: Business;
    date: string;
    kind: 'INCOME' | 'EXPENSE';
    amount: number;
    description: string;
    paymentMethod: string;
    notes: string;
}
const auth = useAuthStore(), route = useRoute(), { busy, error, run } = useTask();
const from = ref(today().slice(0, 7) + '-01'), to = ref(today());
const business = ref(typeof route.query.business === 'string' ? route.query.business : '');
const businesses = ref<Business[]>([]), summary = ref<Summary[]>([]), entries = ref<Entry[]>([]);
const kind = ref('ALL'), expenseOpen = ref(false), paymentOpen = ref(false);
const totals = computed(() => summary.value.reduce((total, row) => ({ income: total.income + row.income, expenses: total.expenses + row.expenses, count: total.count + row.count }), { income: 0, expenses: 0, count: 0 }));
const visible = computed(() => entries.value.filter(entry => kind.value === 'ALL' || entry.kind === kind.value));
const expenseBusiness = computed(() => businesses.value.find(b => b === business.value && b !== 'RESTAURANT'));
async function load() {
    const query = new URLSearchParams({ from: from.value, to: to.value });
    if (business.value)
        query.set('business', business.value);
    const data = fromApi<{
        businesses: Business[];
        summary: Summary[];
        entries: Entry[];
    }>(await api.get(`/finance?${query}`, auth.token));
    businesses.value = data.businesses;
    summary.value = data.summary;
    entries.value = data.entries;
}
onMounted(() => run(load));
</script>
<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-2xl font-semibold">
          Finance
        </h2>
        <p class="mt-1 text-sm text-ink-muted">
          Income received, expenses recorded, and net cash for your businesses.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button v-if="auth.canManage('hostel')" class="btn-secondary" :disabled="busy" @click="paymentOpen=true">
          Receive hostel payment
        </button>
        <button class="btn" :disabled="busy || !businesses.length" @click="expenseOpen=true">
          Record expense
        </button>
      </div>
    </div>
    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>
    <form class="panel flex flex-wrap items-end gap-3" @submit.prevent="run(load)">
      <label class="field">
        From
        <input v-model="from" class="input" type="date" required :disabled="busy" />
      </label>
      <label class="field">
        To
        <input v-model="to" class="input" type="date" required :disabled="busy" />
      </label>
      <label class="field">
        Business
        <select v-model="business" class="input" :disabled="busy">
          <option value="">
            All permitted businesses
          </option>
          <option v-for="item in businesses" :key="item" :value="item">
            {{ businessName(item) }}
          </option>
        </select>
      </label>
      <button class="btn" :disabled="busy">
        {{ busy ? 'Loading…' : 'View finances' }}
      </button>
    </form>
    <div class="grid gap-3 sm:grid-cols-3">
      <div class="panel">
        <p class="text-sm text-ink-muted">
          Income received
        </p>
        <p class="mt-2 text-2xl font-semibold">
          {{ formatMWK(totals.income) }}
        </p>
      </div>
      <div class="panel">
        <p class="text-sm text-ink-muted">
          Expenses
        </p>
        <p class="mt-2 text-2xl font-semibold">
          {{ formatMWK(totals.expenses) }}
        </p>
      </div>
      <div class="panel">
        <p class="text-sm text-ink-muted">
          Net cash
        </p>
        <p class="mt-2 text-2xl font-semibold">
          {{ formatMWK(totals.income-totals.expenses) }}
        </p>
      </div>
    </div>
    <div v-if="summary.length>1" class="overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>
              Business
            </th>
            <th>
              Income
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
          <tr v-for="row in summary" :key="row.business">
            <td>
              {{ businessName(row.business) }}
            </td>
            <td>
              {{ formatMWK(row.income) }}
            </td>
            <td>
              {{ formatMWK(row.expenses) }}
            </td>
            <td>
              {{ formatMWK(row.income-row.expenses) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <section class="panel space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="font-semibold">
          Transactions
        </h3>
        <label class="field">
          Show
          <select v-model="kind" class="input">
            <option value="ALL">
              Income and expenses
            </option>
            <option value="INCOME">
              Income only
            </option>
            <option value="EXPENSE">
              Expenses only
            </option>
          </select>
        </label>
      </div>
      <p v-if="totals.count>entries.length" class="text-sm text-ink-muted">
        Showing the latest {{ entries.length }} of {{ totals.count }} transactions. Narrow the dates to view earlier entries. Totals include every transaction in the selected period.
      </p>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>
                Date
              </th>
              <th>
                Business
              </th>
              <th>
                Type
              </th>
              <th>
                Description
              </th>
              <th>
                Amount
              </th>
              <th>
                Payment method
              </th>
              <th>
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in visible" :key="`${entry.kind}-${entry.id}`">
              <td>
                {{ entry.date }}
              </td>
              <td>
                {{ businessName(entry.business) }}
              </td>
              <td>
                {{ entry.kind==='INCOME' ? 'Income' : 'Expense' }}
              </td>
              <td>
                {{ entry.description }}
              </td>
              <td :class="entry.kind==='INCOME' ? 'text-success' : 'text-danger'">
                {{ formatMWK(entry.amount) }}
              </td>
              <td>
                {{ entry.paymentMethod.replaceAll('_',' ') }}
              </td>
              <td>
                {{ entry.notes || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!visible.length && !busy" class="text-sm text-ink-muted">
        No transactions for this selection.
      </p>
    </section>
    <p class="text-sm text-ink-muted">
      Hostel income appears on the payment date, even when rent is for another month. Stock purchases are recorded as expenses here; receiving stock does not create an expense.
    </p>
    <ExpenseModal v-if="expenseOpen" :businesses="businesses" :business="expenseBusiness" @close="expenseOpen=false" @saved="run(load)" />
    <ReceivePaymentModal v-if="paymentOpen" @close="paymentOpen=false" @saved="run(load)" />
  </div>
</template>
