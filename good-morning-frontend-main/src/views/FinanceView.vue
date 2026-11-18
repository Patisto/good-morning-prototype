<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api, fromApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useTask } from '@/composables/useTask';
import ExpenseModal from '@/components/management/ExpenseModal.vue';
import ReceivePaymentModal from '@/components/management/ReceivePaymentModal.vue';
import FormModal from '@/components/ui/FormModal.vue';
import { businessName, formatMWK, formatDisplayDate, today, type Business } from '@/types';
interface Summary {
    business: Business;
    income: number;
    expenses: number;
    credit: number;
    count: number;
}
interface Entry {
    id: string;
    business: Business;
    date: string;
    kind: 'INCOME' | 'EXPENSE' | 'CREDIT';
    amount: number;
    description: string;
    paymentMethod: string;
    notes: string;
}
const auth = useAuthStore(), route = useRoute(), { busy, error, run } = useTask();
const from = ref(today().slice(0, 7) + '-01'), to = ref(today());
const business = ref(typeof route.query.business === 'string' ? route.query.business : '');
const businesses = ref<Business[]>([]), summary = ref<Summary[]>([]), entries = ref<Entry[]>([]);
const kind = ref<'ALL' | 'INCOME' | 'EXPENSE' | 'CREDIT'>('ALL'), expenseOpen = ref(false), paymentOpen = ref(false);
const transactionSearch = ref(''), transactionSort = ref<'date-newest' | 'date-oldest' | 'amount-high' | 'amount-low'>('date-newest');
const eraseOpen = ref(false), erasePhrase = ref(''), eraseKey = ref('');
const filterValidation = ref('');
const totals = computed(() => summary.value.reduce((total, row) => ({ income: total.income + row.income, expenses: total.expenses + row.expenses, credit: total.credit + row.credit, count: total.count + row.count }), { income: 0, expenses: 0, credit: 0, count: 0 }));
const canEraseTransactions = computed(() => auth.canManage('hostel') || auth.canManage('restaurant') || auth.canManage('grocery'));
function printReport() { window.print(); }
const visible = computed(() => entries.value
    .filter(entry => (kind.value === 'ALL' || entry.kind === kind.value)
        && `${entry.date} ${businessName(entry.business)} ${entry.kind} ${entry.description} ${entry.paymentMethod} ${entry.notes}`.toLowerCase().includes(transactionSearch.value.trim().toLowerCase()))
    .sort((a, b) => {
        if (transactionSort.value === 'date-oldest') return a.date.localeCompare(b.date) || a.description.localeCompare(b.description);
        if (transactionSort.value === 'amount-high') return b.amount - a.amount || b.date.localeCompare(a.date);
        if (transactionSort.value === 'amount-low') return a.amount - b.amount || b.date.localeCompare(a.date);
        return b.date.localeCompare(a.date) || b.description.localeCompare(a.description);
    }));
const expenseBusiness = computed(() => businesses.value.find(b => b === business.value && b !== 'RESTAURANT'));
async function eraseFilteredTransactions() {
    const previewTotal = totals.value.income + totals.value.expenses + totals.value.credit;
    const phrase = `ERASE ${totals.value.count}`;
    if (totals.value.count === 0 || erasePhrase.value !== phrase || !eraseKey.value.trim()) return;
    await run(async () => {
        await api.post('/finance/transactions/erase', { key: eraseKey.value, from: from.value, to: to.value, business: business.value || undefined }, auth.token);
        eraseOpen.value = false;
        erasePhrase.value = '';
        eraseKey.value = '';
        await load();
    });
}
function openEraseConfirmation() {
    erasePhrase.value = '';
    eraseKey.value = '';
    eraseOpen.value = true;
}
function applyFilters() {
    filterValidation.value = from.value > to.value ? 'The start date must be on or before the end date.' : '';
    if (!filterValidation.value)
        void run(load);
}
function setPeriod(period: 'today' | '7days' | 'month') {
    const now = today();
    to.value = now;
    if (period === 'today') from.value = now;
    else if (period === '7days') { const date = new Date(`${now}T12:00:00`); date.setDate(date.getDate() - 6); from.value = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Blantyre' }).format(date); }
    else from.value = now.slice(0, 7) + '-01';
    applyFilters();
}
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
          Income received, expenses recorded, credit sales to follow up, and net cash for your businesses.
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
    <form class="panel flex flex-wrap items-end gap-3" @submit.prevent="applyFilters">
      <label class="field">
        From
        <input v-model="from" class="input" type="date" required :max="to" :disabled="busy" />
      </label>
      <label class="field">
        To
        <input v-model="to" class="input" type="date" required :min="from" :disabled="busy" />
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
      <div class="flex gap-2" role="group" aria-label="Date presets"><button type="button" class="btn-secondary" :disabled="busy" @click="setPeriod('today')">Today</button><button type="button" class="btn-secondary" :disabled="busy" @click="setPeriod('7days')">Last 7 days</button><button type="button" class="btn-secondary" :disabled="busy" @click="setPeriod('month')">This month</button></div>
      <button type="button" class="btn-secondary" @click="printReport">Print filtered report</button>
      <p v-if="filterValidation" class="w-full text-sm text-danger" role="alert">{{ filterValidation }}</p>
    </form>
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div class="panel">
        <p class="text-sm text-ink-muted">Credit sales to follow up</p>
        <p class="mt-2 text-2xl font-semibold">{{ formatMWK(totals.credit) }}</p>
      </div>
      <p class="text-sm text-ink-muted">Scope: {{ business ? businessName(business) : 'all businesses you can access' }} · {{ formatDisplayDate(from) }}–{{ formatDisplayDate(to) }}. Net cash is money collected minus expenses; credit sales are tracked separately until paid.</p>
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
            <th>Credit</th>
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
            <td>{{ formatMWK(row.credit) }}</td>
            <td>
              {{ formatMWK(row.income-row.expenses) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <section class="panel space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div><h3 class="font-semibold">Transactions</h3><p class="text-xs text-ink-muted">{{ visible.length }} shown from the current result set</p></div>
        <label class="field">
          Show
          <select v-model="kind" class="input">
            <option value="ALL">
              Income, expenses and credit
            </option>
            <option value="INCOME">
              Income only
            </option>
            <option value="EXPENSE">
              Expenses only
            </option>
            <option value="CREDIT">Credit sales only</option>
          </select>
        </label>
      </div>
      <div class="grid gap-3 sm:grid-cols-[minmax(14rem,1fr)_auto]">
        <label class="field">Search transactions
          <input v-model="transactionSearch" class="input" type="search" placeholder="Description, business, payment method…" />
        </label>
        <label class="field">Sort by
          <select v-model="transactionSort" class="input">
            <option value="date-newest">Date · newest first</option>
            <option value="date-oldest">Date · oldest first</option>
            <option value="amount-high">Amount · highest first</option>
            <option value="amount-low">Amount · lowest first</option>
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
                {{ formatDisplayDate(entry.date) }}
              </td>
              <td>
                {{ businessName(entry.business) }}
              </td>
              <td>
                {{ entry.kind==='INCOME' ? 'Income' : entry.kind === 'CREDIT' ? 'Credit' : 'Expense' }}
              </td>
              <td>
                {{ entry.description }}
              </td>
              <td :class="entry.kind==='INCOME' ? 'text-success' : entry.kind==='CREDIT' ? 'text-pending' : 'text-danger'">
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
        No transactions match the current filters.
      </p>
    </section>
    <details v-if="canEraseTransactions" class="rounded-lg border border-danger/30 bg-surface">
      <summary class="cursor-pointer px-4 py-3 text-sm font-medium text-danger">Danger zone · permanently erase transactions</summary>
      <div class="border-t border-line p-4">
        <p class="text-sm text-ink-muted">This removes transactions for the currently selected date range and business. The operation cannot be undone.</p>
        <p class="mt-2 text-sm">Affected records: <strong>{{ totals.count }}</strong> · Aggregate amount: <strong class="tabular">{{ formatMWK(totals.income + totals.expenses + totals.credit) }}</strong></p>
        <button type="button" class="btn-destructive mt-3" :disabled="busy || totals.count===0" @click="openEraseConfirmation">Review permanent erasure…</button>
      </div>
    </details>
    <p class="text-sm text-ink-muted">
      Hostel income appears on the payment date, even when rent is for another month. Stock purchases are recorded as expenses here; receiving stock does not create an expense.
    </p>
    <ExpenseModal v-if="expenseOpen" :businesses="businesses" :business="expenseBusiness" @close="expenseOpen=false" @saved="run(load)" />
    <ReceivePaymentModal v-if="paymentOpen" @close="paymentOpen=false" @saved="run(load)" />
    <FormModal v-if="eraseOpen" title="Confirm permanent erasure" :busy="busy" @close="eraseOpen=false">
      <form class="space-y-4" @submit.prevent="eraseFilteredTransactions">
        <p class="rounded border border-danger/30 bg-danger-light p-3 text-sm text-danger">This action cannot be undone. It affects {{ totals.count }} transactions totaling {{ formatMWK(totals.income + totals.expenses + totals.credit) }} for {{ business ? businessName(business) : 'all permitted businesses' }} from {{ formatDisplayDate(from) }} through {{ formatDisplayDate(to) }}.</p>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <label class="field">Type <strong>ERASE {{ totals.count }}</strong> to continue
          <input v-model="erasePhrase" class="input" autocomplete="off" required />
        </label>
        <label class="field">Manager erase key
          <input v-model="eraseKey" class="input" type="password" autocomplete="current-password" required />
        </label>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" :disabled="busy" @click="eraseOpen=false">Cancel</button>
          <button class="btn-destructive" :disabled="busy || erasePhrase !== `ERASE ${totals.count}` || !eraseKey.trim()">Permanently erase</button>
        </div>
      </form>
    </FormModal>
  </div>
</template>
