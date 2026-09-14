<script setup lang="ts">
import { ref } from 'vue'
import { useRestaurantStore } from '@/stores/restaurant'
import PosItemTile from '@/components/pos/PosItemTile.vue'
import CartPanel from '@/components/pos/CartPanel.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { formatMWK } from '@/types'
import type { SaleLineItem, PaymentMethod, MenuItem } from '@/types'
import { useAuthStore } from '@/stores/auth'

const restaurant = useRestaurantStore()
const auth = useAuthStore()
const tab = ref<'sell' | 'menu' | 'food'>('sell')
const cart = ref<SaleLineItem[]>([])
const canManageMenu = ['OWNER', 'ADMINISTRATOR', 'RESTAURANT_MANAGER'].includes(auth.role ?? '')
const menuForm = ref<Omit<MenuItem, 'id'>>({ name: '', category: '', sellingPrice: 0, available: true, currentStock: 0, lowStockLevel: 0 })
const editingMenuId = ref<string | null>(null)
const foodForm = ref({ foodItemId: '', quantity: 0, cost: 0, date: new Date().toISOString().slice(0, 10) })

function addToCart(itemId: string, name: string, unitPrice: number) {
  const existing = cart.value.find((i) => i.itemId === itemId)
  const stock = restaurant.menuItems.find((item) => item.id === itemId)?.currentStock ?? 0
  if (existing) {
    if (existing.quantity < stock) existing.quantity += 1
  } else if (stock > 0) cart.value.push({ itemId, name, quantity: 1, unitPrice })
}

function updateQuantity(itemId: string, quantity: number) {
  if (quantity <= 0) {
    cart.value = cart.value.filter((i) => i.itemId !== itemId)
    return
  }
  const item = cart.value.find((i) => i.itemId === itemId)
  const stock = restaurant.menuItems.find((menuItem) => menuItem.id === itemId)?.currentStock ?? 0
  if (item) item.quantity = Math.min(quantity, stock)
}

function checkout(paymentMethod: PaymentMethod) {
  const sale = restaurant.completeSale(cart.value, paymentMethod, 'Grace M.')
  if (sale) cart.value = []
}

function addMenuItem() {
  if (!menuForm.value.name.trim() || !menuForm.value.category.trim() || menuForm.value.sellingPrice <= 0) return
  const item = { ...menuForm.value, name: menuForm.value.name.trim(), category: menuForm.value.category.trim() }
  if (editingMenuId.value) restaurant.updateMenuItem({ ...item, id: editingMenuId.value })
  else restaurant.addMenuItem(item)
  clearMenuForm()
}
function editMenuItem(item: MenuItem) { editingMenuId.value = item.id; menuForm.value = { ...item } }
function clearMenuForm() { editingMenuId.value = null; menuForm.value = { name: '', category: '', sellingPrice: 0, available: true, currentStock: 0, lowStockLevel: 0 } }
function addFoodRecord() { if (!foodForm.value.foodItemId || foodForm.value.quantity <= 0 || foodForm.value.cost < 0) return; restaurant.addFoodRecord(foodForm.value.foodItemId, foodForm.value.quantity, foodForm.value.cost, foodForm.value.date); foodForm.value.quantity = 0; foodForm.value.cost = 0 }
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
          v-for="item in restaurant.menuItems.filter((m) => m.available && m.currentStock > 0)"
          :key="item.id"
          :name="item.name"
          :price="item.sellingPrice"
          :sublabel="`${item.category} · ${item.currentStock} left`"
          @tap="addToCart(item.id, item.name, item.sellingPrice)"
        />
      </div>
      <CartPanel :items="cart" @update-quantity="updateQuantity" @checkout="checkout" />
    </div>

    <!-- MENU -->
    <div v-else-if="tab === 'menu'" class="space-y-3">
      <form v-if="canManageMenu" class="grid grid-cols-2 gap-2 rounded border border-line bg-surface p-3 sm:grid-cols-4" @submit.prevent="addMenuItem">
        <input v-model="menuForm.name" required placeholder="Menu item name" class="rounded border border-line px-3 py-2 text-sm" />
        <input v-model="menuForm.category" required placeholder="Category" class="rounded border border-line px-3 py-2 text-sm" />
        <input v-model.number="menuForm.sellingPrice" required min="1" type="number" placeholder="Selling price" class="rounded border border-line px-3 py-2 text-sm" />
        <input v-model.number="menuForm.currentStock" required min="0" type="number" placeholder="Quantity in stock" class="rounded border border-line px-3 py-2 text-sm" />
        <input v-model.number="menuForm.lowStockLevel" required min="0" type="number" placeholder="Low-stock level" class="rounded border border-line px-3 py-2 text-sm" />
        <label class="flex items-center gap-2 rounded border border-line px-3 py-2 text-sm"><input v-model="menuForm.available" type="checkbox" /> Available</label>
        <button type="submit" class="rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark">{{ editingMenuId ? 'Save changes' : 'Add menu item' }}</button>
        <button v-if="editingMenuId" type="button" class="rounded border border-line px-3 py-2 text-sm" @click="clearMenuForm">Cancel</button>
      </form>
      <div class="overflow-x-auto rounded border border-line bg-surface">
      <table class="w-full min-w-[520px] text-sm">
        <thead class="border-b border-line bg-paper text-left text-ink-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Item</th>
            <th class="px-4 py-2 font-medium">Category</th>
            <th class="px-4 py-2 font-medium">Price</th>
            <th class="px-4 py-2 font-medium">Status</th>
            <th class="px-4 py-2 font-medium">Stock</th>
            <th v-if="canManageMenu" class="px-4 py-2 font-medium">Edit</th>
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
            <td class="px-4 py-2">{{ item.currentStock }} <span v-if="item.currentStock <= item.lowStockLevel" class="text-danger">Low</span></td>
            <td v-if="canManageMenu" class="px-4 py-2"><button type="button" class="text-primary hover:underline" @click="editMenuItem(item)">Edit</button></td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <!-- FOOD RECORDS -->
    <div v-else class="space-y-3">
      <div class="rounded border border-line bg-surface p-4">
        <p class="text-sm text-ink-muted">Today's food cost</p>
        <p class="tabular text-2xl font-semibold">{{ formatMWK(restaurant.todaysFoodCost) }}</p>
      </div>
      <form v-if="canManageMenu" class="grid grid-cols-2 gap-2 rounded border border-line bg-surface p-3 sm:grid-cols-5" @submit.prevent="addFoodRecord">
        <select v-model="foodForm.foodItemId" required class="rounded border border-line px-3 py-2 text-sm"><option disabled value="">Food item</option><option v-for="item in restaurant.foodItems" :key="item.id" :value="item.id">{{ item.name }}</option></select>
        <input v-model="foodForm.date" required type="date" class="rounded border border-line px-3 py-2 text-sm" />
        <input v-model.number="foodForm.quantity" required min="0.01" type="number" placeholder="Quantity" class="rounded border border-line px-3 py-2 text-sm" />
        <input v-model.number="foodForm.cost" required min="0" type="number" placeholder="Cost" class="rounded border border-line px-3 py-2 text-sm" />
        <button type="submit" class="rounded bg-primary px-3 py-2 text-sm font-medium text-white">Record food</button>
      </form>
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
