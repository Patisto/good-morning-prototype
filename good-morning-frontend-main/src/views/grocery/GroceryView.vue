<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGroceryStore } from '@/stores/grocery'
import PosItemTile from '@/components/pos/PosItemTile.vue'
import CartPanel from '@/components/pos/CartPanel.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { formatMWK } from '@/types'
import type { SaleLineItem, PaymentMethod } from '@/types'
import type { GroceryProduct } from '@/types'
import { useAuthStore } from '@/stores/auth'

const grocery = useGroceryStore()
const auth = useAuthStore()
const tab = ref<'sell' | 'products'>('sell')
const cart = ref<SaleLineItem[]>([])
const search = ref('')
const canManageProducts = ['OWNER', 'ADMINISTRATOR', 'GROCERY_MANAGER'].includes(auth.role ?? '')
const productForm = ref<Omit<GroceryProduct, 'id'>>({
  name: '', category: '', sellingPrice: 0, buyingPrice: 0, currentStock: 0, lowStockLevel: 0, unit: 'piece',
})

const filteredProducts = computed(() =>
  grocery.products.filter((p) => p.name.toLowerCase().includes(search.value.toLowerCase()))
)

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
  grocery.completeSale(cart.value, paymentMethod, 'Yamikani C.')
  cart.value = []
}

const stockInput = ref<Record<string, number>>({})
function addStock(productId: string) {
  const qty = stockInput.value[productId]
  if (!qty || qty <= 0) return
  grocery.addStock(productId, qty)
  stockInput.value[productId] = 0
}

function addProduct() {
  const product = productForm.value
  if (!product.name.trim() || !product.category.trim() || product.sellingPrice <= 0 || product.buyingPrice < 0) return
  grocery.addProduct({ ...product, name: product.name.trim(), category: product.category.trim() })
  productForm.value = { name: '', category: '', sellingPrice: 0, buyingPrice: 0, currentStock: 0, lowStockLevel: 0, unit: 'piece' }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex gap-1 border-b border-line">
      <button
        v-for="t in ['sell', 'products'] as const"
        :key="t"
        type="button"
        class="border-b-2 px-4 py-2 text-sm font-medium capitalize"
        :class="tab === t ? 'border-primary text-primary-dark' : 'border-transparent text-ink-muted hover:text-ink'"
        @click="tab = t"
      >
        {{ t }}
      </button>
    </div>

    <!-- SELL -->
    <div v-if="tab === 'sell'" class="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div class="min-w-0 flex-1 space-y-3">
        <SearchInput v-model="search" placeholder="Search products…" />
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <PosItemTile
            v-for="p in filteredProducts"
            :key="p.id"
            :name="p.name"
            :price="p.sellingPrice"
            :sublabel="`${p.currentStock} in stock`"
            :disabled="p.currentStock <= 0"
            @tap="addToCart(p.id, p.name, p.sellingPrice)"
          />
        </div>
      </div>
      <CartPanel :items="cart" :show-change-calculator="true" @update-quantity="updateQuantity" @checkout="checkout" />
    </div>

    <!-- PRODUCTS -->
    <div v-else class="space-y-3">
      <form v-if="canManageProducts" class="grid grid-cols-2 gap-2 rounded border border-line bg-surface p-3 sm:grid-cols-4" @submit.prevent="addProduct">
        <input v-model="productForm.name" required placeholder="Product name" class="rounded border border-line px-3 py-2 text-sm" />
        <input v-model="productForm.category" required placeholder="Category" class="rounded border border-line px-3 py-2 text-sm" />
        <input v-model.number="productForm.sellingPrice" required min="1" type="number" placeholder="Selling price" class="rounded border border-line px-3 py-2 text-sm" />
        <input v-model.number="productForm.buyingPrice" required min="0" type="number" placeholder="Buying price" class="rounded border border-line px-3 py-2 text-sm" />
        <input v-model.number="productForm.currentStock" required min="0" type="number" placeholder="Opening stock" class="rounded border border-line px-3 py-2 text-sm" />
        <input v-model.number="productForm.lowStockLevel" required min="0" type="number" placeholder="Low-stock level" class="rounded border border-line px-3 py-2 text-sm" />
        <input v-model="productForm.unit" required placeholder="Unit (piece, kg…)" class="rounded border border-line px-3 py-2 text-sm" />
        <button type="submit" class="rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark">Add product</button>
      </form>
      <div class="overflow-x-auto rounded border border-line bg-surface">
      <table class="w-full min-w-[720px] text-sm">
        <thead class="border-b border-line bg-paper text-left text-ink-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Product</th>
            <th class="px-4 py-2 font-medium">Category</th>
            <th class="px-4 py-2 font-medium">Price</th>
            <th class="px-4 py-2 font-medium">Stock</th>
            <th class="px-4 py-2 font-medium">Status</th>
            <th class="px-4 py-2 font-medium">Add stock</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in grocery.products" :key="p.id" class="border-b border-line last:border-0">
            <td class="px-4 py-2 font-medium">{{ p.name }}</td>
            <td class="px-4 py-2 text-ink-muted">{{ p.category }}</td>
            <td class="tabular px-4 py-2">{{ formatMWK(p.sellingPrice) }}</td>
            <td class="tabular px-4 py-2">{{ p.currentStock }} {{ p.unit }}</td>
            <td class="px-4 py-2">
              <StatusPill
                :tone="p.currentStock <= p.lowStockLevel ? 'danger' : 'success'"
                :label="p.currentStock <= p.lowStockLevel ? 'Low stock' : 'In stock'"
              />
            </td>
            <td class="px-4 py-2">
              <div class="flex items-center gap-2">
                <input
                  v-model.number="stockInput[p.id]"
                  type="number"
                  placeholder="Qty"
                  class="w-20 rounded border border-line px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  class="rounded bg-primary px-3 py-1 text-sm font-medium text-white hover:bg-primary-dark"
                  @click="addStock(p.id)"
                >
                  Add
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  </div>
</template>
