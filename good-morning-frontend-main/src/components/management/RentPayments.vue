<script setup lang="ts">
import { computed, ref } from 'vue';
import { useHostelStore } from '@/stores/hostel';
import { useAuthStore } from '@/stores/auth';
import { useTask } from '@/composables/useTask';
import { api, fromApi } from '@/lib/api';
import FormModal from '@/components/ui/FormModal.vue';
import ReceivePaymentModal from './ReceivePaymentModal.vue';
import { formatMWK, type Charge } from '@/types';
const hostel = useHostelStore(), auth = useAuthStore(), { busy, error, run } = useTask();
const history = ref<Charge | null>(null), paymentTenant = ref<string | null>(null), notes = ref('');
const receipts = ref<{
    id: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
}[]>([]);
const total = computed(() => hostel.charges.reduce((sum, charge) => sum + Math.max(0, charge.expectedAmount - charge.amountPaid), 0));
const tenantName = (id: string) => { const tenant = hostel.tenants.find(t => t.id === id); return tenant ? `${tenant.firstName} ${tenant.lastName}` : id; };
async function openHistory(charge: Charge) {
    history.value = charge;
    notes.value = charge.notes;
    receipts.value = [];
    await run(async () => { receipts.value = fromApi<{
        receipts: typeof receipts.value;
    }>(await api.get(`/hostel/charges/${charge.id}/receipts`, auth.token)).receipts; });
}
async function saveNotes() {
    if (!history.value)
        return;
    const id = history.value.id;
    await run(async () => { await hostel.mutate(`/charges/${id}/notes`, { notes: notes.value }); history.value = null; });
}
</script>
<template>
  <div class="space-y-4">
    <p v-if="error && !history" class="error" role="alert">
      {{ error }}
    </p>
    <div class="panel flex flex-wrap items-end justify-between gap-3">
      <label class="field">
        Rent month
        <input v-model="hostel.month" class="input" type="month" :disabled="busy" @change="run(()=>hostel.hydrate())" />
      </label>
      <p>
        Outstanding for this month:
        <strong>
          {{ formatMWK(total) }}
        </strong>
      </p>
      <div v-if="auth.canManage('hostel')" class="flex flex-wrap gap-2">
        <button class="btn-secondary" :disabled="busy" @click="run(()=>hostel.mutate('/charges',{ month:hostel.month }))">
          Generate monthly charges
        </button>
        <button class="btn" :disabled="busy" @click="paymentTenant=''">
          Receive payment
        </button>
      </div>
    </div>
    <p class="text-sm text-ink-muted">
      Receive a payment at any time by selecting a tenant and rent month. Generate charges to list all tenants owing rent for a month.
    </p>
    <div class="overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>
              Tenant
            </th>
            <th>
              Expected
            </th>
            <th>
              Paid
            </th>
            <th>
              Balance / credit
            </th>
            <th>
              Notes
            </th>
            <th>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="charge in hostel.charges" :key="charge.id">
            <td>
              {{ tenantName(charge.tenantId) }}
            </td>
            <td>
              {{ formatMWK(charge.expectedAmount) }}
            </td>
            <td>
              {{ formatMWK(charge.amountPaid) }}
            </td>
            <td>
              {{ formatMWK(Math.abs(charge.expectedAmount-charge.amountPaid)) }} {{ charge.amountPaid>charge.expectedAmount ? 'credit' : charge.amountPaid===charge.expectedAmount ? 'paid' : 'due' }}
            </td>
            <td>
              {{ charge.notes || '—' }}
            </td>
            <td class="space-x-2">
              <button v-if="auth.canManage('hostel')" class="btn" :disabled="busy" @click="paymentTenant=charge.tenantId">
                Receive payment
              </button>
              <button class="btn-secondary" :disabled="busy" @click="openHistory(charge)">
                History & notes
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!hostel.charges.length" class="panel text-ink-muted">
      No charges for this month yet. Receive a payment directly, or generate monthly charges to see all balances.
    </p>
    <ReceivePaymentModal v-if="paymentTenant!==null" :tenant-id="paymentTenant" :month="hostel.month" @close="paymentTenant=null" @saved="run(()=>hostel.hydrate())" />
    <FormModal v-if="history" :title="`${tenantName(history.tenantId)} · ${history.month}`" :busy="busy" @close="history=null">
      <div class="space-y-4">
        <p v-if="error" class="error" role="alert">
          {{ error }}
        </p>
        <p v-if="busy" role="status">
          Loading / saving…
        </p>
        <h3 class="font-semibold">
          Payment receipts
        </h3>
        <ul class="space-y-2 text-sm">
          <li v-for="receipt in receipts" :key="receipt.id">
            {{ receipt.paymentDate }} · {{ formatMWK(receipt.amount) }} · {{ receipt.paymentMethod.replaceAll('_',' ') }}
          </li>
        </ul>
        <p v-if="!receipts.length && !busy" class="text-sm text-ink-muted">
          No payments recorded.
        </p>
        <form v-if="auth.canManage('hostel')" class="space-y-3" @submit.prevent="saveNotes">
          <label class="field">
            Balance notes
            <textarea v-model="notes" class="input" maxlength="2000" :disabled="busy" />
          </label>
          <div class="flex justify-end gap-2">
            <button class="btn-secondary" type="button" :disabled="busy" @click="history=null">
              Cancel
            </button>
            <button class="btn" :disabled="busy">
              Save notes
            </button>
          </div>
        </form>
        <p v-else class="text-sm">
          {{ history.notes || 'No balance notes.' }}
        </p>
      </div>
    </FormModal>
  </div>
</template>
