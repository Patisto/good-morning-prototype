<script setup lang="ts">
import { computed } from 'vue'
import StatCard from '@/components/ui/StatCard.vue'
import { useHostelStore } from '@/stores/hostel'
import { useRestaurantStore } from '@/stores/restaurant'
import { useGroceryStore } from '@/stores/grocery'
import { formatMWK } from '@/types'

const hostel = useHostelStore()
const restaurant = useRestaurantStore()
const grocery = useGroceryStore()

const lowStockNames = computed(() => grocery.lowStock.map((p) => p.name).join(', ') || 'None')
</script>

<template>
  <div class="space-y-6">
    <section>
      <h2 class="mb-3 text-sm font-medium text-ink-muted">Today</h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Restaurant sales" :value="formatMWK(restaurant.todaysRevenue)" />
        <StatCard label="Grocery sales" :value="formatMWK(grocery.todaysRevenue)" />
        <StatCard label="Hostel payments received" :value="formatMWK(hostel.paymentsReceivedThisMonth)" />
      </div>
    </section>

    <section>
      <h2 class="mb-3 text-sm font-medium text-ink-muted">Restaurant</h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Food costs today" :value="formatMWK(restaurant.todaysFoodCost)" />
        <StatCard label="Estimated gross" :value="formatMWK(restaurant.todaysRevenue - restaurant.todaysFoodCost)" tone="success" />
        <StatCard label="Best-selling item" :value="restaurant.bestSeller" />
      </div>
    </section>

    <section>
      <h2 class="mb-3 text-sm font-medium text-ink-muted">Hostel</h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Outstanding balances" :value="formatMWK(hostel.outstandingBalance)" tone="pending" />
        <StatCard label="Occupied rooms" :value="`${hostel.occupiedCount} / ${hostel.rooms.length}`" />
        <StatCard label="Vacant rooms" :value="String(hostel.vacantCount)" />
      </div>
    </section>

    <section>
      <h2 class="mb-3 text-sm font-medium text-ink-muted">Grocery</h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Low stock products" :value="String(grocery.lowStock.length)" :tone="grocery.lowStock.length ? 'danger' : 'default'" />
        <StatCard label="Which items" :value="lowStockNames" />
      </div>
    </section>
  </div>
</template>
