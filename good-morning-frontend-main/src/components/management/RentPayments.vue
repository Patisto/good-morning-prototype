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
const statusFilter = ref<'ALL' | 'DUE' | 'PAID' | 'CREDIT'>('ALL');
const receipts = ref<{
    id: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
}[]>([]);
const netBalance = (charge: Charge) => charge.openingBalance + charge.amountPaid - charge.expectedAmount;
const due = (charge: Charge) => Math.max(0, -netBalance(charge));
const total = computed(() => hostel.charges.reduce((sum, charge) => sum + due(charge), 0));
const paidTotal = computed(() => hostel.charges.reduce((sum, charge) => sum + charge.amountPaid, 0));
const dueCount = computed(() => hostel.charges.filter(charge => netBalance(charge) < 0).length);
const paidCount = computed(() => hostel.charges.filter(charge => netBalance(charge) === 0).length);
const creditTotal = computed(() => hostel.charges.reduce((sum, charge) => sum + Math.max(0, netBalance(charge)), 0));
const visibleCharges = computed(() => hostel.charges.filter(charge => statusFilter.value === 'ALL' || (statusFilter.value === 'DUE' && netBalance(charge) < 0) || (statusFilter.value === 'PAID' && netBalance(charge) === 0) || (statusFilter.value === 'CREDIT' && netBalance(charge) > 0)));
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
      Rent still owing:
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
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <button v-for="card in [
        { id: 'ALL', label: 'Tenants charged', value: hostel.charges.length, detail: 'this month' },
        { id: 'PAID', label: 'Fully paid', value: paidCount, detail: formatMWK(paidTotal) + ' received' },
        { id: 'DUE', label: 'Still owing', value: dueCount, detail: formatMWK(total) + ' outstanding' },
        { id: 'CREDIT', label: 'Tenant credit', value: formatMWK(creditTotal), detail: 'available against rent' }
      ]" :key="card.id" type="button" class="panel text-left transition hover:border-primary" :class="statusFilter===card.id ? 'border-primary ring-1 ring-primary' : ''" @click="statusFilter=card.id as typeof statusFilter">
        <span class="block text-sm text-ink-muted">{{ card.label }}</span>
        <strong class="mt-1 block text-xl">{{ card.value }}</strong>
        <span class="text-xs text-ink-muted">{{ card.detail }}</span>
      </button>
    </div>
    <p class="text-sm text-ink-muted">
      Generate a month to set each tenant’s rent from their room rate. Unpaid balances carry forward; overpayments become credit and reduce later rent.
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
              Opening balance
            </th>
            <th>
              Due / credit
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
          <tr v-for="charge in visibleCharges" :key="charge.id">
            <td>
              {{ tenantName(charge.tenantId) }}
            </td>
            <td>
              {{ formatMWK(charge.expectedAmount) }}
            </td>
            <td>
              {{ formatMWK(charge.amountPaid) }}
            </td>
            <td>{{ formatMWK(Math.abs(charge.openingBalance)) }} {{ charge.openingBalance > 0 ? 'credit' : charge.openingBalance < 0 ? 'owed' : '—' }}</td>
            <td><span class="font-semibold" :class="netBalance(charge)<0 ? 'text-red-700' : netBalance(charge)>0 ? 'text-primary' : 'text-green-700'">{{ netBalance(charge)<0 ? 'Due ' : netBalance(charge)>0 ? 'Credit ' : 'Paid ' }}{{ formatMWK(Math.abs(netBalance(charge))) }}</span></td>
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
