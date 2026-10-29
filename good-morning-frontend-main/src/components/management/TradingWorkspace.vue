<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useTrading } from '@/composables/useTrading';
import { useAuthStore } from '@/stores/auth';
import { businessName, formatMWK, paymentMethods, today, type Product, type PaymentMethod, type Sale } from '@/types';
import ProductEditorModal from './ProductEditorModal.vue';
import { api } from '@/lib/api';
const props = defineProps<{
    section: 'restaurant' | 'grocery';
}>();
const auth = useAuthStore();
const { business, date, products, sales, entries, canManage, revenue, busy, error, run, load, save, remove, sell } = useTrading(props.section);
const tab = ref('sales'), search = ref(''), paymentMethod = ref<PaymentMethod>('CASH');
const cart = ref<{
    itemId: string;
    quantity: number;
}[]>([]);
const productEditorOpen = ref(false);
const editedProduct = ref<Product | undefined>();
const stock = ref({ productId: '', quantity: 0, notes: '' });
const calculator = ref({ paid: 0 });
const salesReceiptsOpen = ref(false), stockReceiptsOpen = ref(false);
const filtered = computed(() => products.value.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(search.value.toLowerCase())));
const lineProduct = (id: string) => products.value.find(p => p.id === id);
const cartTotal = computed(() => cart.value.reduce((sum, line) => sum + Math.round((lineProduct(line.itemId)?.sellingPrice ?? 0) * line.quantity * 100) / 100, 0));
const changeDue = computed(() => Math.max(0, Number(calculator.value.paid || 0) - cartTotal.value));
const canSell = computed(() => auth.role !== 'ACCOUNTANT' && date.value === today());
const tabs = computed(() => canManage.value ? ['sales', 'stock', 'configuration'] : ['sales', 'stock']);
watch([business, date], () => { cart.value = []; productEditorOpen.value = false; stock.value = { productId: '', quantity: 0, notes: '' }; salesReceiptsOpen.value = false; stockReceiptsOpen.value = false; });
watch([tab, date], async ([activeTab]) => { if (activeTab === 'stock') { await run(load); await nextTick(); await promptNewStock(); } });
function add(product: Product) {
    const line = cart.value.find(l => l.itemId === product.id);
    if (line) {
        if (line.quantity + 1 <= product.currentStock)
            line.quantity += 1;
    }
    else
        cart.value.push({ itemId: product.id, quantity: Math.min(1, product.currentStock) });
}
async function checkout() { await run(async () => { await sell(cart.value, paymentMethod.value); cart.value = []; await load(); }); }
async function receive() { await run(async () => { await save('/stock', { ...stock.value, date: date.value }); stock.value.quantity = 0; stock.value.notes = ''; await load(); }); }
async function promptNewStock() {
    if (entries.value.length) return;
    if (confirm(`No stock receipts are recorded for ${date.value}. Would you like to record a new stock receipt for this date?`)) {
        stock.value.productId = products.value[0]?.id ?? '';
        document.querySelector('select[aria-label="Stock item"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
function edit(product?: Product) { editedProduct.value = product; productEditorOpen.value = true; }
async function deleteProduct(product: Product) {
    if (confirm(`Delete ${product.name} from the active catalogue? Historical sales will be retained.`))
        await run(() => remove(product.id));
}
async function eraseSale(sale: Sale) {
    const key = prompt('Enter the manager erase key to remove this sale and restore stock:');
    if (!key) return;
    if (!confirm(`Permanently erase this ${formatMWK(sale.total)} sale? Its stock will be restored.`)) return;
    await run(async () => { await api.delete(`/${props.section}/sales/${sale.id}?business=${business.value}&key=${encodeURIComponent(key)}`, auth.token); await load(); });
}
function printReport(title: string) {
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(`<html><head><title>${title} · ${date.value}</title><style>body{font:14px Arial;margin:32px}h1{color:#1f5b4c}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd}</style></head><body><h1>Good Morning · ${businessName(business.value)}</h1><h2>${title} · ${date.value}</h2>${document.querySelector('[data-print-report]')?.innerHTML ?? ''}</body></html>`); w.document.close(); w.focus(); w.print();
}
const soldToday = (id: string) => sales.value.filter(s => s.status === 'COMPLETED').flatMap(s => s.items).filter(i => i.itemId === id).reduce((n, i) => n + i.quantity, 0);
</script>
<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold">
          {{ businessName(business) }}
        </h2>
        <p class="mt-1 text-sm text-ink-muted">
          {{ section==='restaurant' ? 'Receive the day’s sellable items, then track quantities sold and remaining.' : 'Configure products, receive stock, and record sales.' }}
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <router-link v-if="auth.canSee('finance')" class="btn-secondary self-end" :to="{ path:'/finance',query:{ business } }">
          View finances
        </router-link>
        <label v-if="section==='restaurant'" class="field">
          Restaurant
          <select v-model="business" class="input" :disabled="busy">
            <option value="RESTAURANT_A">
              UPPER RESTAURANT
            </option>
            <option value="RESTAURANT_B">
              LOWER RESTAURANT
            </option>
          </select>
        </label>
        <label class="field">
          Trading date
          <input v-model="date" class="input" type="date" :max="today()" :disabled="busy" />
        </label>
        <button class="btn-secondary self-end" :disabled="busy" @click="run(load)">
          Refresh
        </button>
      </div>
    </div>
    <p v-if="error" role="alert" class="error">
      {{ error }}
    </p>
    <p v-if="busy" role="status" class="text-sm text-ink-muted">
      Saving / loading…
    </p>
    <div class="grid gap-3 sm:grid-cols-3">
      <div class="panel">
        <p class="text-sm text-ink-muted">
          Sales revenue · {{ date }}
        </p>
        <p class="mt-2 text-2xl font-semibold">
          {{ formatMWK(revenue) }}
        </p>
      </div>
      <div class="panel">
        <p class="text-sm text-ink-muted">
          Transactions
        </p>
        <p class="mt-2 text-2xl font-semibold">
          {{ sales.length }}
        </p>
      </div>
      <div class="panel">
        <p class="text-sm text-ink-muted">
          Configured items
        </p>
        <p class="mt-2 text-2xl font-semibold">
          {{ products.length }}
        </p>
      </div>
    </div>
    <nav class="tabs" aria-label="Business workspace">
      <button v-for="item in tabs" :key="item" :class="tab===item ? 'btn' : 'btn-secondary'" :disabled="busy" @click="tab=item">
        {{ item.charAt(0).toUpperCase()+item.slice(1) }}
      </button>
    </nav>
    <template v-if="tab==='sales'">
      <section v-if="section==='grocery'" class="panel flex flex-wrap items-end gap-3">
        <h3 class="w-full font-semibold">Change calculator</h3>
        <label class="field">Amount due (MWK)<input :value="cartTotal" class="input" type="number" readonly aria-readonly="true"></label>
        <label class="field">Customer paid (MWK)<input v-model.number="calculator.paid" class="input" type="number" min="0" step="0.01"></label>
        <p class="text-lg font-semibold">Change: {{ formatMWK(changeDue) }}</p>
      </section>
      <p v-if="!canSell" class="text-sm text-ink-muted">
        Viewing sales history. New sales can be recorded for today by managers and cashiers.
      </p>
      <div v-if="canSell" class="grid gap-4 xl:grid-cols-2">
        <section class="panel space-y-3">
          <label class="field">
            Find item
            <input v-model="search" class="input" placeholder="Search configured products" />
          </label>
          <div class="grid gap-2 sm:grid-cols-2">
            <button v-for="product in filtered" :key="product.id" class="btn-secondary text-left" :disabled="busy || product.currentStock<=0" @click="add(product)">
              <span class="block font-semibold">
                {{ product.name }}
              </span>
              <span class="block">
                {{ formatMWK(product.sellingPrice) }} / {{ product.unit }}
              </span>
              <span class="text-xs text-ink-muted">
                {{ product.currentStock }} available
              </span>
            </button>
          </div>
          <p v-if="!products.length" class="text-sm text-ink-muted">
            Add sellable items in Configuration, then receive quantities in Stock.
          </p>
        </section>
        <form class="panel space-y-3" @submit.prevent="checkout">
          <h3 class="font-semibold">
            Current sale
          </h3>
          <div v-for="(line,index) in cart" :key="line.itemId" class="flex items-end gap-2">
            <label class="field flex-1">
              {{ lineProduct(line.itemId)?.name }}
              <input v-model.number="line.quantity" class="input" type="number" min="0.01" step="0.01" :max="lineProduct(line.itemId)?.currentStock" required />
            </label>
            <button type="button" class="btn-secondary" :disabled="busy" @click="cart.splice(index,1)">
              Remove
            </button>
          </div>
          <p v-if="!cart.length" class="text-sm text-ink-muted">
            Select an item to start a sale.
          </p>
          <label class="field">
            Payment method
            <select v-model="paymentMethod" class="input">
              <option v-for="m in paymentMethods" :key="m" :value="m">
                {{ m.replaceAll('_',' ') }}
              </option>
            </select>
          </label>
          <p class="text-xl font-semibold">
            {{ formatMWK(cartTotal) }}
          </p>
          <button class="btn" :disabled="busy || !cart.length">
            Record sale
          </button>
        </form>
      </div>
      <section class="panel space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2"><h3 class="font-semibold">Sale receipts · {{ date }} ({{ sales.length }})</h3><button type="button" class="btn-secondary" :aria-expanded="salesReceiptsOpen" @click="salesReceiptsOpen=!salesReceiptsOpen">{{ salesReceiptsOpen ? 'Hide sale receipts' : 'View sale receipts' }}</button></div>
        <div v-if="salesReceiptsOpen" class="space-y-3">
        <div class="flex justify-end"><button type="button" class="btn-secondary" @click="printReport('Daily sales')">Print receipts</button></div>
        <div class="overflow-x-auto" data-print-report>
          <table class="data-table">
            <thead>
              <tr>
                <th>
                  Time
                </th>
                <th>
                  Items
                </th>
                <th>
                  Total
                </th>
                <th>
                  Payment
                </th>
                <th>
                  Cashier
                </th>
                <th v-if="canManage">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="sale in sales" :key="sale.id">
                <td>
                  {{ sale.time }}
                </td>
                <td>
                  {{ sale.items.map(i=>`${i.name} × ${i.quantity}`).join(', ') }}
                </td>
                <td>
                  {{ formatMWK(sale.total) }}
                </td>
                <td>
                  {{ sale.paymentMethod.replaceAll('_',' ') }}
                </td>
                <td>
                  {{ sale.cashier }}
                </td>
                <td v-if="canManage"><button class="btn-secondary text-danger" :disabled="busy" @click="eraseSale(sale)">Erase</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!sales.length" class="text-sm text-ink-muted">
          No sales for this date.
        </p>
        </div>
      </section>
    </template>
    <template v-else-if="tab==='stock'">
      <label class="field w-fit">Inventory date
        <input v-model="date" class="input" type="date" :max="today()" :disabled="busy" />
      </label>
      <p class="text-sm text-ink-muted">
        {{ section==='restaurant' ? 'Enter portions available to sell, for example 20 chicken wings and 10 chicken thighs. Stock starts fresh each date; additional receipts increase that day’s quantity.' : 'Grocery stock carries forward. Record each delivery once.' }}
      </p>
      <form v-if="canManage" class="panel flex flex-wrap items-end gap-3" @submit.prevent="receive">
        <label class="field">
          Item
          <select v-model="stock.productId" class="input" aria-label="Stock item" required>
            <option disabled value="">
              Select item
            </option>
            <option v-for="p in products" :key="p.id" :value="p.id">
              {{ p.name }} ({{ p.unit }})
            </option>
          </select>
        </label>
        <label class="field">
          Quantity received
          <input v-model.number="stock.quantity" class="input" type="number" min="0.01" step="0.01" required />
        </label>
        <label class="field">
          Notes / Transaction Details
          <input v-model="stock.notes" class="input" maxlength="2000" />
        </label>
        <button class="btn" :disabled="busy">
          Receive stock · {{ date }}
        </button>
      </form>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>
                Item
              </th>
              <th>
                Unit
              </th>
              <th>
                {{ section==='restaurant' ? 'Received today' : 'Total received to date' }}
              </th>
              <th>
                Sold on date
              </th>
              <th>
                Remaining
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in products" :key="p.id">
              <td>
                {{ p.name }}
              </td>
              <td>
                {{ p.unit }}
              </td>
              <td>
                {{ p.received }}
              </td>
              <td>
                {{ soldToday(p.id) }}
              </td>
              <td :class="p.currentStock<=p.lowStockLevel ? 'text-danger' : ''">
                {{ p.currentStock }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <section class="panel">
        <div class="flex flex-wrap items-center justify-between gap-2"><h3 class="font-semibold">Stock receipts · {{ date }} ({{ entries.length }})</h3><button type="button" class="btn-secondary" :aria-expanded="stockReceiptsOpen" @click="stockReceiptsOpen=!stockReceiptsOpen">{{ stockReceiptsOpen ? 'Hide receipts' : 'View stock receipts' }}</button></div>
        <div v-if="stockReceiptsOpen" class="mt-3 space-y-3">
        <div class="flex justify-end"><button type="button" class="btn-secondary" @click="printReport('Stock receipts')">Print receipts</button></div>
        <p v-for="e in entries" :key="e.id" class="mb-2 text-sm">
          {{ e.name }} · {{ e.quantity }} · {{ e.notes }}
        </p>
        <p v-if="!entries.length" class="text-sm text-ink-muted">
          No stock received for this date.
        </p>
        </div>
      </section>
    </template>
    <template v-else-if="tab==='configuration' && canManage">
      <div class="flex items-center justify-between gap-3">
        <h3 class="font-semibold">
          Configured items
        </h3>
        <button class="btn" :disabled="busy" @click="edit()">
          Add item
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>
                Name
              </th>
              <th>
                Category
              </th>
              <th>
                Unit
              </th>
              <th>
                Selling price
              </th>
              <th>
                Buying price
              </th>
              <th>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in products" :key="p.id">
              <td>
                {{ p.name }}
              </td>
              <td>
                {{ p.category }}
              </td>
              <td>
                {{ p.unit }}
              </td>
              <td>
                {{ formatMWK(p.sellingPrice) }}
              </td>
              <td>
                {{ formatMWK(p.buyingPrice) }}
              </td>
              <td class="space-x-2">
                <button class="btn-secondary" :disabled="busy" @click="edit(p)">
                  Edit
                </button>
                <button class="btn-secondary" :disabled="busy" @click="deleteProduct(p)">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <ProductEditorModal v-if="productEditorOpen" :product="editedProduct" :section="section" :business="business" @close="productEditorOpen=false" @saved="run(load)" />
  </div>
</template>
