<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api, fromApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useHostelStore } from '@/stores/hostel';
import { useTask } from '@/composables/useTask';
import FormModal from '@/components/ui/FormModal.vue';
import { formatMWK, paymentMethods, today, type PaymentMethod } from '@/types';
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
const tenantId = ref(props.tenantId ?? ''), month = ref(props.month ?? today().slice(0, 7)), search = ref('');
const amount = ref<number | null>(null), paymentDate = ref(today()), paymentMethod = ref<PaymentMethod>('CASH');
const quote = ref<{
    expectedAmount: number;
    amountPaid: number;
} | null>(null), quoteLoading = ref(false), quoteError = ref('');
const tenants = computed(() => hostel.tenants.filter(t => t.id === tenantId.value || `${t.firstName} ${t.lastName} ${t.phone}`.toLowerCase().includes(search.value.toLowerCase())));
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
        <label class="field sm:col-span-2">
          Find tenant
          <input v-model="search" class="input" placeholder="Search name or phone" />
        </label>
        <label class="field">
          Tenant
          <select v-model="tenantId" class="input" required>
            <option disabled value="">
              Select tenant
            </option>
            <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
              {{ tenant.firstName }} {{ tenant.lastName }}{{ tenant.checkoutDate ? ' (checked out)' : '' }}
            </option>
          </select>
        </label>
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
