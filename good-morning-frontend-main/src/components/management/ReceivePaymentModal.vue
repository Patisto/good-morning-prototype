<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api, fromApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useHostelStore } from '@/stores/hostel';
import { useTask } from '@/composables/useTask';
import FormModal from '@/components/ui/FormModal.vue';
import { formatMWK, paymentMethods, today, type PaymentMethod, type Tenant } from '@/types';
const props = defineProps<{
    tenantId?: string;
    month?: string;
}>();
const emit = defineEmits<{
    close: [
    ];
    saved: [
    ];
}>();
const hostel = useHostelStore(), auth = useAuthStore();
const { busy, error, run } = useTask();
const tenantId = ref(props.tenantId ?? ''), month = ref(props.month ?? today().slice(0, 7)), search = ref(''), searchingTenant = ref(!props.tenantId);
const amount = ref<number | null>(null), paymentDate = ref(today()), paymentMethod = ref<PaymentMethod>('CASH');
const quote = ref<{
    expectedAmount: number;
    amountPaid: number;
} | null>(null), quoteLoading = ref(false), quoteError = ref('');
const selectedTenant = computed(() => hostel.tenants.find(t => t.id === tenantId.value));
const tenantMatches = computed(() => {
    const query = search.value.trim().toLowerCase();
    if (!query) return [];
    return hostel.tenants.filter(t => `${t.firstName} ${t.middleName ?? ''} ${t.lastName} ${t.phone}`.toLowerCase().includes(query)).slice(0, 8);
});
function chooseTenant(tenant: Tenant) { tenantId.value = tenant.id; search.value = ''; searchingTenant.value = false; }
function changeTenant() { tenantId.value = ''; search.value = ''; quote.value = null; searchingTenant.value = true; }
let version = 0;
async function loadQuote() {
    const request = ++version;
    quote.value = null;
    quoteError.value = '';
    if (!tenantId.value || !month.value) {
        quoteLoading.value = false;
        return;
    }
    quoteLoading.value = true;
    try {
        const result = fromApi<{
            expectedAmount: number;
            amountPaid: number;
        }>(await api.get(`/hostel/rent-quote?tenantId=${encodeURIComponent(tenantId.value)}&month=${encodeURIComponent(month.value)}`, auth.token));
        if (request === version)
            quote.value = result;
    }
    catch (cause) {
        if (request === version)
            quoteError.value = cause instanceof Error ? cause.message : 'Could not load rent balance.';
    }
    finally {
        if (request === version)
            quoteLoading.value = false;
    }
}
watch([tenantId, month], loadQuote, { immediate: true });
onMounted(() => run(() => hostel.hydrate()));
watch(() => hostel.tenants, () => { if (tenantId.value && !searchingTenant.value && !selectedTenant.value) { tenantId.value = ''; searchingTenant.value = true; } });
async function receive() {
    if (!quote.value || quoteLoading.value)
        return;
    await run(async () => {
        await api.post('/hostel/payments', { tenantId: tenantId.value, month: month.value, amount: amount.value, paymentDate: paymentDate.value, paymentMethod: paymentMethod.value }, auth.token);
        emit('saved');
        emit('close');
    });
}
</script>
<template>
  <FormModal title="Receive hostel payment" :busy="busy" @close="emit('close')">
    <form class="space-y-4" @submit.prevent="receive">
      <p v-if="error" class="error" role="alert">
        {{ error }}
      </p>
      <fieldset :disabled="busy" class="grid gap-3 sm:grid-cols-2">
        <div class="field sm:col-span-2">
          <span>Tenant</span>
          <div v-if="selectedTenant && !searchingTenant" class="flex items-center justify-between gap-3 rounded border border-line bg-paper px-3 py-2">
            <span class="text-sm font-medium">{{ selectedTenant.firstName }} {{ selectedTenant.middleName }} {{ selectedTenant.lastName }} · {{ selectedTenant.phone }}</span>
            <button type="button" class="text-sm text-primary underline" @click="changeTenant">Change</button>
          </div>
          <div v-else class="space-y-2">
            <input v-model="search" class="input" placeholder="Type tenant name or phone number" autocomplete="off" required />
            <div v-if="tenantMatches.length" class="max-h-48 overflow-y-auto rounded border border-line bg-surface">
              <button v-for="tenant in tenantMatches" :key="tenant.id" type="button" class="block w-full border-b border-line px-3 py-2 text-left text-sm last:border-0 hover:bg-paper" @click="chooseTenant(tenant)">
                <span class="font-medium">{{ tenant.firstName }} {{ tenant.middleName }} {{ tenant.lastName }}</span><span class="text-ink-muted"> · {{ tenant.phone }}</span>
              </button>
            </div>
            <p v-else-if="search.trim()" class="text-sm text-ink-muted">No tenant matches that name or phone number.</p>
          </div>
        </div>
        <label class="field">
          Paying for month
          <input v-model="month" class="input" type="month" required />
        </label>
        <div class="rounded bg-paper p-3 text-sm sm:col-span-2">
          <p v-if="quoteLoading">
            Loading rent balance…
          </p>
          <p v-else-if="quoteError" class="text-danger">
            {{ quoteError }}
            <button type="button" class="underline" @click="loadQuote">
              Retry
            </button>
          </p>
          <p v-else-if="quote">
            Rent: {{ formatMWK(quote.expectedAmount) }} · Paid: {{ formatMWK(quote.amountPaid) }} · {{ quote.amountPaid>quote.expectedAmount ? 'Credit' : 'Balance' }}: {{ formatMWK(Math.abs(quote.expectedAmount-quote.amountPaid)) }}
          </p>
          <p v-else>
            Select a tenant and month to see the rent balance.
          </p>
        </div>
        <label class="field">
          Amount received (MWK)
          <input v-model.number="amount" class="input" type="number" min="0.01" step="0.01" required />
        </label>
        <label class="field">
          Payment date
          <input v-model="paymentDate" class="input" type="date" :max="today()" required />
        </label>
        <label class="field">
          Payment method
          <select v-model="paymentMethod" class="input">
            <option v-for="method in paymentMethods" :key="method" :value="method">
              {{ method.replaceAll('_',' ') }}
            </option>
          </select>
        </label>
      </fieldset>
      <p class="text-sm text-ink-muted">
        Partial payments are allowed. Any amount above the monthly rent is kept as a credit for that month.
      </p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" :disabled="busy" @click="emit('close')">
          Cancel
        </button>
        <button class="btn" :disabled="busy || quoteLoading || !quote">
          Receive payment
        </button>
      </div>
    </form>
  </FormModal>
</template>
