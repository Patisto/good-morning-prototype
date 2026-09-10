<script setup lang="ts">
import { ref } from 'vue'
import { useExpensesStore } from '@/stores/expenses'
import StatCard from '@/components/ui/StatCard.vue'
import { formatMWK } from '@/types'
import type { Expense } from '@/types'

const expenses = useExpensesStore()

const form = ref<Omit<Expense, 'id'>>({
  description: '',
  amount: 0,
  business: 'GENERAL',
  date: '2026-09-10',
  paymentMethod: 'CASH',
})

function submit() {
  if (!form.value.description || form.value.amount <= 0) return
  expenses.add({ ...form.value })
  form.value.description = ''
  form.value.amount = 0
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard label="Hostel" :value="formatMWK(expenses.byBusiness('HOSTEL'))" />
      <StatCard label="Restaurant" :value="formatMWK(expenses.byBusiness('RESTAURANT'))" />
      <StatCard label="Grocery" :value="formatMWK(expenses.byBusiness('GROCERY'))" />
      <StatCard label="General" :value="formatMWK(expenses.byBusiness('GENERAL'))" />
    </div>

    <form class="grid grid-cols-1 gap-3 rounded border border-line bg-surface p-4 sm:grid-cols-5" @submit.prevent="submit">
      <input v-model="form.description" placeholder="Description" class="rounded border border-line px-3 py-2 text-sm sm:col-span-2" />
      <input v-model.number="form.amount" type="number" placeholder="Amount" class="rounded border border-line px-3 py-2 text-sm" />
      <select v-model="form.business" class="rounded border border-line px-3 py-2 text-sm">
        <option value="HOSTEL">Hostel</option>
        <option value="RESTAURANT">Restaurant</option>
        <option value="GROCERY">Grocery</option>
        <option value="GENERAL">General</option>
      </select>
      <button type="submit" class="rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark">
        Record expense
      </button>
    </form>

    <div class="overflow-x-auto rounded border border-line bg-surface">
      <table class="w-full min-w-[560px] text-sm">
        <thead class="border-b border-line bg-paper text-left text-ink-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Description</th>
            <th class="px-4 py-2 font-medium">Business</th>
            <th class="px-4 py-2 font-medium">Amount</th>
            <th class="px-4 py-2 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in expenses.items" :key="e.id" class="border-b border-line last:border-0">
            <td class="px-4 py-2 font-medium">{{ e.description }}</td>
            <td class="px-4 py-2 text-ink-muted capitalize">{{ e.business.toLowerCase() }}</td>
            <td class="tabular px-4 py-2">{{ formatMWK(e.amount) }}</td>
            <td class="px-4 py-2 text-ink-muted">{{ e.date }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
