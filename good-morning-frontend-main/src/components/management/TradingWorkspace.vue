<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useTrading } from '@/composables/useTrading';
import { useAuthStore } from '@/stores/auth';
import { businessName, formatMWK, formatDisplayDate, formatDisplayDateTime, today, type Product, type PaymentMethod, type Sale } from '@/types';
import ProductEditorModal from './ProductEditorModal.vue';
import ReasonModal from '@/components/ui/ReasonModal.vue';
import { api, fromApi } from '@/lib/api';
import { useRoute } from 'vue-router';
const props = defineProps<{
    section: 'restaurant' | 'grocery';
}>();
const auth = useAuthStore();
const route = useRoute();
const { business, date, products, sales, entries, canManage, revenue, busy, error, run, load, save, remove, sell } = useTrading(props.section);
const tab = ref(String(route.query.tab || 'sales')), search = ref(''), paymentMethod = ref<PaymentMethod>('CASH'), paymentNetwork = ref<'AIRTEL_MONEY' | 'TNM_MPAMBA'>('AIRTEL_MONEY');
watch(() => route.query.tab, value => { tab.value = String(value || 'sales'); });
const cart = ref<{
    itemId: string;
    quantity: number;
}[]>([]);
const productEditorOpen = ref(false);
const editedProduct = ref<Product | undefined>();
const stock = ref({ productId: '', quantity: 0, notes: '' });
const stockEntryToReverse = ref<(typeof entries.value)[number] | null>(null);
type MealCard = { id: string; customerName: string; phone: string; balance: number; defaultCharge: number; business: string };
const mealCards = ref<MealCard[]>([]), selectedMealCardId = ref(''), chargedTotal = ref<number | null>(null);
const mealCardDraft = ref({ customerName: '', phone: '', balance: 0, defaultCharge: 0 });
const creditCustomer = ref('');
const customerPhone = ref('');
const paymentStatus = ref('');
const calculator = ref({ paid: 0 });
const cashReceived = ref<number | null>(null);
const salesReceiptsOpen = ref(false), stockReceiptsOpen = ref(false);
const filtered = computed(() => products.value.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(search.value.toLowerCase())));
const configurationSearch = ref(''), configurationCategory = ref('');
const configurationSort = ref<'name' | 'category' | 'unit' | 'sellingPrice' | 'buyingPrice'>('name');
const configurationDirection = ref<'asc' | 'desc'>('asc');
const categories = computed(() => [...new Set(products.value.map(product => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
const configuredProducts = computed(() => products.value
    .filter(product => (!configurationCategory.value || product.category === configurationCategory.value)
        && `${product.name} ${product.category} ${product.unit}`.toLowerCase().includes(configurationSearch.value.trim().toLowerCase()))
    .sort((a, b) => {
        const left = a[configurationSort], right = b[configurationSort];
        const comparison = typeof left === 'number' && typeof right === 'number'
            ? left - right
            : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
        return configurationDirection.value === 'asc' ? comparison : -comparison;
    }));
const selectedStockProduct = computed(() => products.value.find(product => product.id === stock.value.productId));
const stockAfterReceipt = computed(() => selectedStockProduct.value
    ? selectedStockProduct.value.currentStock + Math.max(0, Number(stock.value.quantity) || 0)
    : null);
const lineProduct = (id: string) => products.value.find(p => p.id === id);
const cartTotal = computed(() => cart.value.reduce((sum, line) => sum + Math.round((lineProduct(line.itemId)?.sellingPrice ?? 0) * line.quantity * 100) / 100, 0));
const cashChange = computed(() => Math.max(0, Number(cashReceived.value || 0) - cartTotal.value));
const cashStillDue = computed(() => Math.max(0, cartTotal.value - Number(cashReceived.value || 0)));
const cartValid = computed(() => cart.value.length > 0 && cart.value.every(line => {
    const product = lineProduct(line.itemId);
    return !!product && Number.isFinite(line.quantity) && line.quantity > 0 && line.quantity <= product.currentStock;
}));
const canSubmitSale = computed(() => !busy.value && cartValid.value
    && (paymentMethod.value !== 'CASH' || Number(cashReceived.value ?? 0) >= cartTotal.value)
    && (paymentMethod.value !== 'MEAL_CARD' || (!!selectedMealCardId.value && Number(chargedTotal.value) > 0))
    && (paymentMethod.value !== 'CREDIT' || !!creditCustomer.value.trim())
    && (paymentMethod.value !== 'PAYCHANGU' || !!customerPhone.value.trim()));
const saleDisabledReason = computed(() => busy.value ? 'Please wait for the current request to finish.'
    : !cart.value.length ? 'Choose at least one in-stock item.'
        : !cartValid.value ? 'Check each quantity against the available stock.'
            : paymentMethod.value === 'CASH' && Number(cashReceived.value ?? 0) < cartTotal.value ? 'Enter the full amount received before recording this cash sale.'
                : paymentMethod.value === 'MEAL_CARD' && !selectedMealCardId.value ? 'Select a meal card customer.'
                    : paymentMethod.value === 'MEAL_CARD' && !(Number(chargedTotal.value) > 0) ? 'Enter the meal charge.'
                        : paymentMethod.value === 'CREDIT' && !creditCustomer.value.trim() ? 'Enter the customer name for this credit sale.'
                            : paymentMethod.value === 'PAYCHANGU' && !customerPhone.value.trim() ? 'Enter the customer phone number for PayChangu.' : '');
const canSell = computed(() => auth.role !== 'ACCOUNTANT' && date.value === today());
const salePaymentMethods = computed(() => props.section === 'restaurant' ? ['CASH','AIRTEL_MONEY','TNM_MPAMBA','BANK','CREDIT','MEAL_CARD','PAYCHANGU'] : ['CASH','AIRTEL_MONEY','TNM_MPAMBA','BANK','CREDIT','PAYCHANGU']);
const selectedMealCard = computed(() => mealCards.value.find(card => card.id === selectedMealCardId.value));
watch(cartTotal, (total, previous) => {
    if (cashReceived.value === null || cashReceived.value === previous)
        cashReceived.value = total;
});
async function loadMealCards() {
    if (props.section !== 'restaurant') return;
    mealCards.value = fromApi<MealCard[]>(await api.get(`/restaurant/meal-cards?business=${business.value}`, auth.token));
    if (selectedMealCardId.value && !mealCards.value.some(card => card.id === selectedMealCardId.value)) selectedMealCardId.value = '';
}
async function addMealCard() {
    await run(async () => {
        await api.post(`/restaurant/meal-cards?business=${business.value}`, mealCardDraft.value, auth.token);
        mealCardDraft.value = { customerName: '', phone: '', balance: 0, defaultCharge: 0 };
        await loadMealCards();
    });
}
watch([business, date], () => { cart.value = []; cashReceived.value = null; productEditorOpen.value = false; stock.value = { productId: '', quantity: 0, notes: '' }; stockEntryToReverse.value = null; salesReceiptsOpen.value = false; stockReceiptsOpen.value = false; if (props.section === 'restaurant') void loadMealCards(); });
watch(business, () => { if (props.section === 'restaurant') void loadMealCards(); }, { immediate: true });
watch([tab, date], async ([activeTab]) => { if (activeTab === 'stock') { await run(load); await nextTick(); } });
function add(product: Product) {
    const line = cart.value.find(l => l.itemId === product.id);
    if (line) {
        if (line.quantity + 1 <= product.currentStock)
            line.quantity += 1;
    }
    else
        cart.value.push({ itemId: product.id, quantity: Math.min(1, product.currentStock) });
}
watch(selectedMealCard, card => { if (card) chargedTotal.value = card.defaultCharge; });
async function checkout() {
    await run(async () => {
        if (paymentMethod.value !== 'PAYCHANGU') {
            await sell(cart.value, paymentMethod.value, { chargedTotal: paymentMethod.value === 'MEAL_CARD' && chargedTotal.value !== null ? chargedTotal.value : cartTotal.value, mealCardId: paymentMethod.value === 'MEAL_CARD' ? selectedMealCardId.value : undefined, creditCustomer: paymentMethod.value === 'CREDIT' ? creditCustomer.value : undefined });
        } else {
            paymentStatus.value = 'Requesting mobile money payment…';
            const endpoint = props.section === 'restaurant'
                ? `/restaurant/payments/initiate?business=${business.value}`
                : '/grocery/payments/initiate?business=GROCERY';
            const initiated = await api.post<{ reference: string; checkout_url?: string; status: string }>(endpoint, {
                amount: cartTotal.value,
                items: cart.value,
                phone: customerPhone.value,
                network: paymentNetwork.value,
            }, auth.token);
            if (initiated.checkout_url) window.open(initiated.checkout_url, '_blank', 'noopener,noreferrer');
            paymentStatus.value = initiated.checkout_url ? 'Complete payment in the PayChangu checkout window…' : 'Payment prompt sent. Waiting for customer authorization…';
            const started = Date.now();
            let result: { status: string } = initiated;
            while (['PENDING', 'PROCESSING'].includes(result.status) && Date.now() - started < 120000) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                result = await api.get<{ status: string }>(`${props.section === 'restaurant' ? '/restaurant' : '/grocery'}/payments/${encodeURIComponent(initiated.reference)}/status?business=${business.value}`, auth.token);
                if (result.status === 'SUCCEEDED') break;
            }
            if (result.status !== 'SUCCEEDED') throw new Error(result.status === 'PENDING' || result.status === 'PROCESSING' ? 'Payment is still pending. Refresh the sale status before retrying.' : `Payment ${result.status.toLowerCase()}.`);
            paymentStatus.value = 'Payment successful. Sale recorded.';
        }
        cart.value = []; selectedMealCardId.value = ''; chargedTotal.value = null; creditCustomer.value = ''; customerPhone.value = ''; paymentStatus.value = ''; cashReceived.value = null;
        await load(); if (props.section === 'restaurant') await loadMealCards();
    });
}
async function receive() { await run(async () => { await save('/stock', { ...stock.value, date: date.value }); stock.value.quantity = 0; stock.value.notes = ''; await load(); }); }
async function reverseStockEntry(reason: string) {
    const entry = stockEntryToReverse.value;
    if (!entry || !reason) return;
    await run(async () => {
        await api.post(`/${props.section}/stock/${entry.id}/reverse?business=${business.value}`, { reason }, auth.token);
        stockEntryToReverse.value = null;
        await load();
    });
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
function setToday() { date.value = today(); }
function focusSearch() { document.querySelector<HTMLInputElement>('[data-product-search]')?.focus(); }
function sortConfiguredProducts(key: typeof configurationSort.value) {
    if (configurationSort.value === key)
        configurationDirection.value = configurationDirection.value === 'asc' ? 'desc' : 'asc';
    else {
        configurationSort.value = key;
        configurationDirection.value = 'asc';
    }
}
function searchShortcut(event: KeyboardEvent) {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey
        && !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName ?? '')) {
        event.preventDefault();
        focusSearch();
    }
}
onMounted(() => window.addEventListener('keydown', searchShortcut));
onUnmounted(() => window.removeEventListener('keydown', searchShortcut));
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
      <div class="flex flex-wrap items-end gap-3">
        <label class="field">
          Business date · {{ formatDisplayDate(date) }}
          <input v-model="date" class="input" type="date" :max="today()" :disabled="busy" />
        </label>
        <button type="button" class="btn-secondary" :disabled="busy || date===today()" @click="setToday">Today</button>
        <button class="btn-secondary self-end" :disabled="busy" @click="run(load)">
          Refresh
        </button>
      </div>
    </div>
    <p v-if="date !== today()" class="rounded-md border border-pending/40 bg-pending-light p-3 text-sm text-ink" role="status">Viewing past date {{ formatDisplayDate(date) }}. New sales are available for today only.</p>
    <p v-if="error" role="alert" class="error">
      {{ error }}
    </p>
    <p v-if="busy" role="status" class="text-sm text-ink-muted">
      Saving / loading…
    </p>
    <div v-if="tab==='sales'" class="grid gap-3 sm:grid-cols-2">
      <div v-if="tab==='sales'" class="panel">
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
    </div>
    <template v-if="tab==='sales'">
      <p v-if="!canSell" class="text-sm text-ink-muted">
        Viewing sales history. New sales can be recorded for today by managers and cashiers.
      </p>
      <div v-if="canSell" class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
        <section class="panel space-y-3">
          <label class="field">
            Find item
            <input v-model="search" data-product-search class="input" placeholder="Search configured products · /" aria-label="Search configured products" />
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
          <div v-if="products.length && !filtered.length" class="rounded-md border border-dashed border-line bg-paper p-4 text-sm text-ink-muted">
            No items match “{{ search }}”. Change the search to see other products.
          </div>
          <div v-if="!products.length" class="rounded-md border border-dashed border-line bg-paper p-4 text-sm text-ink-muted">
            <p>No sellable items are available yet. Add an item, then receive stock.</p>
            <router-link class="btn-secondary mt-3" :to="{ path: route.path, query: { ...route.query, tab: 'configuration' } }">Open Configuration</router-link>
            <router-link class="btn-tertiary mt-3" :to="{ path: route.path, query: { ...route.query, tab: 'stock' } }">Open Stock</router-link>
          </div>
        </section>
        <form class="panel space-y-3 xl:sticky xl:top-4" @submit.prevent="checkout">
          <h3 class="font-semibold">
            Current sale
          </h3>
          <div v-for="(line,index) in cart" :key="line.itemId" class="flex items-end gap-2">
            <label class="field flex-1">
              {{ lineProduct(line.itemId)?.name }}
              <input v-model.number="line.quantity" class="input" type="number" :min="section === 'grocery' ? 1 : 0.01" :step="section === 'grocery' ? 1 : 0.01" :max="lineProduct(line.itemId)?.currentStock" required />
            </label>
            <button type="button" class="btn-secondary" :disabled="busy" @click="cart.splice(index,1)">
              Remove
            </button>
          </div>
          <p v-if="!cart.length" class="text-sm text-ink-muted">
            Select an item to start a sale.
          </p>
          <fieldset class="space-y-2"><legend class="text-sm font-medium">Payment method</legend><div class="grid grid-cols-2 gap-2 sm:grid-cols-3"> <button v-for="m in salePaymentMethods" :key="m" type="button" class="min-h-11 rounded-md border px-3 text-sm font-medium" :class="paymentMethod===m ? 'border-primary bg-primary-light text-primary-dark' : 'border-line bg-surface'" :aria-pressed="paymentMethod===m" @click="paymentMethod=m as PaymentMethod">{{ m === 'CREDIT' ? 'Credit' : m === 'MEAL_CARD' ? 'Meal card' : m.replaceAll('_',' ') }}</button></div></fieldset>
          <label v-if="paymentMethod === 'CREDIT'" class="field">Customer name for credit
            <input v-model="creditCustomer" class="input" required maxlength="500" placeholder="Who will pay later?">
          </label>
          <template v-if="paymentMethod === 'MEAL_CARD'">
            <label class="field">Meal card customer
              <select v-model="selectedMealCardId" class="input" required>
                <option value="">Select customer</option>
                <option v-for="card in mealCards" :key="card.id" :value="card.id">{{ card.customerName }} · balance {{ formatMWK(card.balance) }}</option>
              </select>
            </label>
            <label class="field">Agreed meal charge (MWK)
              <input v-model.number="chargedTotal" class="input" type="number" min="0.01" step="0.01" required>
            </label>
            <p v-if="selectedMealCard" class="text-xs text-ink-muted">Default {{ formatMWK(selectedMealCard.defaultCharge) }} · remaining balance {{ formatMWK(selectedMealCard.balance) }}</p>
          </template>
          <template v-if="paymentMethod === 'PAYCHANGU'">
            <label v-if="section === 'restaurant'" class="field">Mobile money network
              <select v-model="paymentNetwork" class="input">
                <option value="AIRTEL_MONEY">Airtel Money</option>
                <option value="TNM_MPAMBA">TNM Mpamba</option>
              </select>
            </label>
            <label class="field">Customer phone number
              <input v-model="customerPhone" class="input" type="tel" inputmode="tel" autocomplete="off" placeholder="0999 123 456" required>
            </label>
            <p class="text-sm text-ink-muted" role="status">{{ section === 'restaurant' ? 'The customer will authorize the payment prompt on their phone.' : 'PayChangu checkout lets the customer choose and authorize their payment method.' }}</p>
            <p v-if="paymentStatus" class="text-sm" role="status">{{ paymentStatus }}</p>
          </template>
          <div class="rounded-md bg-paper p-3">
            <p class="text-sm text-ink-muted">Amount due</p>
            <p class="tabular text-2xl font-semibold">
            {{ formatMWK(paymentMethod === 'MEAL_CARD' && chargedTotal !== null ? chargedTotal : cartTotal) }}
            </p>
          </div>
          <template v-if="paymentMethod==='CASH'">
            <label class="field">Cash received (MWK)
              <input v-model.number="cashReceived" class="input" type="number" min="0" step="0.01" inputmode="decimal" />
            </label>
            <p v-if="cashStillDue" class="rounded bg-pending-light p-2 text-sm font-medium text-ink" role="status">Still due: {{ formatMWK(cashStillDue) }}</p>
            <p v-else class="text-sm font-medium">Change: {{ formatMWK(cashChange) }}</p>
          </template>
          <p v-if="!canSubmitSale" class="text-sm text-ink-muted" role="status">{{ saleDisabledReason }}</p>
          <button class="btn w-full" :disabled="!canSubmitSale">
            {{ paymentMethod === 'PAYCHANGU' ? 'Request payment' : 'Record sale' }}
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
      <p class="text-sm text-ink-muted">
          Stock carries forward from the previous day after recorded sales. Enter only new deliveries or additional quantities received today.
      </p>
      <form v-if="canManage" class="panel space-y-4" @submit.prevent="receive">
        <div>
          <h3 class="font-semibold">Receive stock · {{ formatDisplayDate(date) }}</h3>
          <p class="mt-1 text-sm text-ink-muted">Enter a delivery or additional quantity; stock carries forward from prior dates.</p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label class="field">
            Item
            <select v-model="stock.productId" class="input" aria-label="Stock item" required>
              <option disabled value="">Select item</option>
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }} ({{ p.unit }})</option>
            </select>
          </label>
          <label class="field">
            Quantity received <span v-if="selectedStockProduct">({{ selectedStockProduct.unit }})</span>
            <input v-model.number="stock.quantity" class="input" type="number" min="0.01" step="0.01" required />
          </label>
          <label class="field sm:col-span-2">
            Notes / transaction details
            <input v-model="stock.notes" class="input" maxlength="2000" />
          </label>
        </div>
        <div v-if="selectedStockProduct" class="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md bg-paper p-3 text-sm">
          <span>Current stock on {{ formatDisplayDate(date) }}: <strong class="tabular">{{ selectedStockProduct.currentStock }} {{ selectedStockProduct.unit }}</strong></span>
          <span>After receipt: <strong class="tabular">{{ stockAfterReceipt }} {{ selectedStockProduct.unit }}</strong></span>
        </div>
        <div class="flex justify-end">
          <button class="btn" :disabled="busy || !stock.productId || Number(stock.quantity) <= 0">Receive stock</button>
        </div>
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
                <span class="tabular">{{ p.currentStock }} {{ p.unit }}</span>
                <span v-if="p.currentStock<=p.lowStockLevel" class="ml-2 inline-flex rounded bg-pending-light px-2 py-0.5 text-xs font-medium text-pending">Low stock</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!products.length" class="panel text-sm text-ink-muted">
        No configured items yet. Add items in Configuration before receiving stock.
        <router-link class="ml-1 font-medium text-primary underline" :to="{ path: route.path, query: { ...route.query, tab: 'configuration' } }">Open Configuration</router-link>
      </p>
      <section class="panel">
        <div class="flex flex-wrap items-center justify-between gap-2"><h3 class="font-semibold">Stock receipts · {{ date }} ({{ entries.length }})</h3><button type="button" class="btn-secondary" :aria-expanded="stockReceiptsOpen" @click="stockReceiptsOpen=!stockReceiptsOpen">{{ stockReceiptsOpen ? 'Hide receipts' : 'View stock receipts' }}</button></div>
        <div v-if="stockReceiptsOpen" class="mt-3 space-y-3">
        <div class="flex justify-end"><button type="button" class="btn-secondary" @click="printReport('Stock receipts')">Print receipts</button></div>
        <div v-for="e in entries" :key="e.id" class="flex flex-wrap items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-0">
          <div>
            <p class="font-medium">{{ e.name }} · {{ e.quantity }}</p>
            <p class="text-xs text-ink-muted">{{ e.notes || 'No notes' }}<span v-if="e.reversedAt"> · Reversed {{ formatDisplayDateTime(e.reversedAt) }}<span v-if="e.reversedByName"> by {{ e.reversedByName }}</span> · {{ e.reversalReason }}</span></p>
          </div>
          <button v-if="canManage && !e.reversedAt" type="button" class="btn-secondary" :disabled="busy" @click="stockEntryToReverse=e">Reverse receipt</button>
          <span v-else-if="e.reversedAt" class="rounded bg-paper px-2 py-1 text-xs font-medium text-ink-muted">Reversed</span>
        </div>
        <p v-if="!entries.length" class="text-sm text-ink-muted">
          No stock received for this date.
        </p>
        </div>
      </section>
    </template>
    <template v-else-if="tab==='meal-cards' && section==='restaurant'">
      <section class="panel space-y-4">
        <div><h3 class="font-semibold">Restaurant meal cards</h3><p class="text-sm text-ink-muted">Register customers who pay in advance and set their usual meal charge. Their prepaid balance is reduced when they use a card.</p></div>
        <form v-if="canManage" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" @submit.prevent="addMealCard">
          <label class="field">Customer name<input v-model="mealCardDraft.customerName" class="input" required maxlength="500"></label>
          <label class="field">Phone<input v-model="mealCardDraft.phone" class="input" maxlength="100"></label>
          <label class="field">Amount paid in advance (MWK)<input v-model.number="mealCardDraft.balance" class="input" type="number" min="0" step="0.01" required></label>
          <label class="field">Default meal charge (MWK)<input v-model.number="mealCardDraft.defaultCharge" class="input" type="number" min="0" step="0.01" required></label>
          <button class="btn sm:col-span-2 lg:col-span-4" :disabled="busy">Add prepaid customer</button>
        </form>
        <p v-else class="text-sm text-ink-muted">Ask a manager to register meal card customers.</p>
        <div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Customer</th><th>Phone</th><th>Default meal charge</th><th>Prepaid balance</th></tr></thead><tbody><tr v-for="card in mealCards" :key="card.id"><td>{{ card.customerName }}</td><td>{{ card.phone || '—' }}</td><td>{{ formatMWK(card.defaultCharge) }}</td><td>{{ formatMWK(card.balance) }}</td></tr></tbody></table></div>
        <p v-if="!mealCards.length" class="text-sm text-ink-muted">No meal card customers for this restaurant.</p>
      </section>
    </template>
    <template v-else-if="tab==='configuration' && canManage">
      <section class="panel space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="font-semibold">Configured items <span class="text-sm font-normal text-ink-muted">({{ configuredProducts.length }} shown)</span></h3>
            <p class="mt-1 text-sm text-ink-muted">Search by item, category, or unit. Select a column heading to sort.</p>
          </div>
          <button class="btn" :disabled="busy" @click="edit()">Add item</button>
        </div>
        <div class="flex flex-wrap gap-3">
          <label class="field min-w-56 flex-1">Search items
            <input v-model="configurationSearch" class="input" type="search" placeholder="Name, category, or unit" />
          </label>
          <label class="field min-w-48">Category
            <select v-model="configurationCategory" class="input"><option value="">All categories</option><option v-for="category in categories" :key="category" :value="category">{{ category }}</option></select>
          </label>
        </div>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th :aria-sort="configurationSort==='name' ? (configurationDirection==='asc' ? 'ascending' : 'descending') : 'none'"><button type="button" class="font-semibold" @click="sortConfiguredProducts('name')">Name <span v-if="configurationSort==='name'" aria-hidden="true">{{ configurationDirection==='asc' ? '↑' : '↓' }}</span></button></th>
              <th :aria-sort="configurationSort==='category' ? (configurationDirection==='asc' ? 'ascending' : 'descending') : 'none'"><button type="button" class="font-semibold" @click="sortConfiguredProducts('category')">Category <span v-if="configurationSort==='category'" aria-hidden="true">{{ configurationDirection==='asc' ? '↑' : '↓' }}</span></button></th>
              <th :aria-sort="configurationSort==='unit' ? (configurationDirection==='asc' ? 'ascending' : 'descending') : 'none'"><button type="button" class="font-semibold" @click="sortConfiguredProducts('unit')">Unit <span v-if="configurationSort==='unit'" aria-hidden="true">{{ configurationDirection==='asc' ? '↑' : '↓' }}</span></button></th>
              <th :aria-sort="configurationSort==='sellingPrice' ? (configurationDirection==='asc' ? 'ascending' : 'descending') : 'none'"><button type="button" class="font-semibold" @click="sortConfiguredProducts('sellingPrice')">Selling price <span v-if="configurationSort==='sellingPrice'" aria-hidden="true">{{ configurationDirection==='asc' ? '↑' : '↓' }}</span></button></th>
              <th :aria-sort="configurationSort==='buyingPrice' ? (configurationDirection==='asc' ? 'ascending' : 'descending') : 'none'"><button type="button" class="font-semibold" @click="sortConfiguredProducts('buyingPrice')">Buying price <span v-if="configurationSort==='buyingPrice'" aria-hidden="true">{{ configurationDirection==='asc' ? '↑' : '↓' }}</span></button></th>
              <th>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in configuredProducts" :key="p.id">
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
                <button class="btn-destructive" :disabled="busy" @click="deleteProduct(p)">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
        <p v-if="products.length && !configuredProducts.length" class="rounded-md border border-dashed border-line bg-paper p-4 text-sm text-ink-muted">No items match these filters. Clear search or choose another category.</p>
        <div v-if="!products.length" class="rounded-md border border-dashed border-line bg-paper p-5 text-sm text-ink-muted">
          <p class="font-semibold text-ink">No items configured for {{ businessName(business) }}.</p>
          <p class="mt-1">Add a sellable item with its unit and prices. Then receive stock before recording sales.</p>
          <button type="button" class="btn mt-3" :disabled="busy" @click="edit()">Add first item</button>
        </div>
      </section>
    </template>
    <ProductEditorModal v-if="productEditorOpen" :product="editedProduct" :section="section" :business="business" @close="productEditorOpen=false" @saved="run(load)" />
    <ReasonModal v-if="stockEntryToReverse" title="Reverse stock receipt" :description="`This will remove ${stockEntryToReverse.quantity} units of ${stockEntryToReverse.name} from stock history. The reversal is recorded and cannot be deleted.`" :busy="busy" :error="error" @close="stockEntryToReverse=null" @submit="reverseStockEntry" />
  </div>
</template>
