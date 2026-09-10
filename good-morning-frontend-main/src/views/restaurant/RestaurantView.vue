<script setup lang="ts">
import { ref } from 'vue'
import { useRestaurantStore } from '@/stores/restaurant'
import PosItemTile from '@/components/pos/PosItemTile.vue'
import CartPanel from '@/components/pos/CartPanel.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { formatMWK } from '@/types'
import type { SaleLineItem, PaymentMethod } from '@/types'

const restaurant = useRestaurantStore()
const tab = ref<'sell' | 'menu' | 'food'>('sell')
const cart = ref<SaleLineItem[]>([])

function addToCart(itemId: string, name: string, unitPrice: number) {
  const existing = cart.value.find((i) => i.itemId === itemId)
  if (existing) existing.quantity += 1
  else cart.value.push({ itemId, name, quantity: 1, unitPrice })
}

function updateQuantity(itemId: string, quantity: number) {
  if (quantity <= 0) {
    cart.value = cart.value.filter((i) => i.itemId !== itemId)
    return
  }
  const item = cart.value.find((i) => i.itemId === itemId)
  if (item) item.quantity = quantity
}

function checkout(paymentMethod: PaymentMethod) {
  restaurant.completeSale(cart.value, paymentMethod, 'Grace M.')
  cart.value = []
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex gap-1 border-b border-line">
      <button
        v-for="t in ['sell', 'menu', 'food'] as const"
        :key="t"
        type="button"
        class="border-b-2 px-4 py-2 text-sm font-medium capitalize"
        :class="tab === t ? 'border-primary text-primary-dark' : 'border-transparent text-ink-muted hover:text-ink'"
        @click="tab = t"
      >
        {{ t === 'food' ? 'Food records' : t }}
      </button>
    </div>

    <!-- SELL -->
    <div v-if="tab === 'sell'" class="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div class="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
        <PosItemTile
          v-for="item in restaurant.menuItems.filter((m) => m.available)"
          :key="item.id"
          :name="item.name"
          :price="item.sellingPrice"
          :sublabel="item.category"
          @tap="addToCart(item.id, item.name, item.sellingPrice)"
        />
      </div>
      <CartPanel :items="cart" @update-quantity="updateQuantity" @checkout="checkout" />
    </div>

    <!-- MENU -->
    <div v-else-if="tab === 'menu'" class="overflow-x-auto rounded border border-line bg-surface">
      <table class="w-full min-w-[520px] text-sm">
        <thead class="border-b border-line bg-paper text-left text-ink-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Item</th>
            <th class="px-4 py-2 font-medium">Category</th>
            <th class="px-4 py-2 font-medium">Price</th>
            <th class="px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in restaurant.menuItems" :key="item.id" class="border-b border-line last:border-0">
            <td class="px-4 py-2 font-medium">{{ item.name }}</td>
            <td class="px-4 py-2 text-ink-muted">{{ item.category }}</td>
            <td class="tabular px-4 py-2">{{ formatMWK(item.sellingPrice) }}</td>
            <td class="px-4 py-2">
              <StatusPill :tone="item.available ? 'success' : 'neutral'" :label="item.available ? 'Available' : 'Unavailable'" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- FOOD RECORDS -->
    <div v-else class="space-y-3">
      <div class="rounded border border-line bg-surface p-4">
        <p class="text-sm text-ink-muted">Today's food cost</p>
        <p class="tabular text-2xl font-semibold">{{ formatMWK(restaurant.todaysFoodCost) }}</p>
      </div>
      <div class="overflow-x-auto rounded border border-line bg-surface">
        <table class="w-full min-w-[560px] text-sm">
          <thead class="border-b border-line bg-paper text-left text-ink-muted">
            <tr>
              <th class="px-4 py-2 font-medium">Item</th>
              <th class="px-4 py-2 font-medium">Quantity</th>
              <th class="px-4 py-2 font-medium">Cost</th>
              <th class="px-4 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in restaurant.dailyFoodRecords" :key="record.id" class="border-b border-line last:border-0">
              <td class="px-4 py-2 font-medium">
                {{ restaurant.foodItems.find((f) => f.id === record.foodItemId)?.name }}
              </td>
              <td class="tabular px-4 py-2">
                {{ record.quantity }} {{ restaurant.foodItems.find((f) => f.id === record.foodItemId)?.unit }}
              </td>
              <td class="tabular px-4 py-2">{{ formatMWK(record.cost) }}</td>
              <td class="px-4 py-2 text-ink-muted">{{ record.date }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
