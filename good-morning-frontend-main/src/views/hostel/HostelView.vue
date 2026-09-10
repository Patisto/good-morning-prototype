<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHostelStore } from '@/stores/hostel'
import StatusPill from '@/components/ui/StatusPill.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import { formatMWK } from '@/types'
import type { PaymentMethod } from '@/types'

const hostel = useHostelStore()
const tab = ref<'rooms' | 'tenants' | 'payments'>('rooms')
const search = ref('')

const roomsByUnit = computed(() => {
  const groups = new Map<string, typeof hostel.rooms>()
  for (const room of hostel.rooms) {
    if (!groups.has(room.housingUnit)) groups.set(room.housingUnit, [])
    groups.get(room.housingUnit)!.push(room)
  }
  return groups
})

function statusTone(room: (typeof hostel.rooms)[number]) {
  const status = hostel.roomStatus(room)
  if (status === 'OCCUPIED') return 'success'
  if (status === 'PARTIAL') return 'pending'
  return 'neutral'
}

const filteredTenants = computed(() =>
  hostel.tenants.filter((t) =>
    `${t.firstName} ${t.lastName} ${t.roomId}`.toLowerCase().includes(search.value.toLowerCase())
  )
)

const payAmount = ref<Record<string, number>>({})

function pay(tenantId: string, method: PaymentMethod) {
  const amount = payAmount.value[tenantId]
  if (!amount || amount <= 0) return
  hostel.recordPayment(tenantId, amount, method)
  payAmount.value[tenantId] = 0
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex gap-1 border-b border-line">
      <button
        v-for="t in ['rooms', 'tenants', 'payments'] as const"
        :key="t"
        type="button"
        class="border-b-2 px-4 py-2 text-sm font-medium capitalize"
        :class="tab === t ? 'border-primary text-primary-dark' : 'border-transparent text-ink-muted hover:text-ink'"
        @click="tab = t"
      >
        {{ t }}
      </button>
    </div>

    <!-- ROOMS -->
    <div v-if="tab === 'rooms'" class="space-y-6">
      <div v-for="[unit, roomsInUnit] in roomsByUnit" :key="unit">
        <h3 class="mb-2 text-sm font-medium text-ink-muted">{{ unit }}</h3>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <div v-for="room in roomsInUnit" :key="room.id" class="rounded border border-line bg-surface p-3">
            <p class="font-medium">{{ room.label ?? room.identifier }}</p>
            <p class="text-xs text-ink-muted">{{ room.type === 'DOUBLE' ? 'Double' : 'Single' }} · {{ room.occupants }}/{{ room.capacity }}</p>
            <StatusPill class="mt-2" :tone="statusTone(room)" :label="hostel.roomStatus(room).charAt(0) + hostel.roomStatus(room).slice(1).toLowerCase()" />
          </div>
        </div>
      </div>
    </div>

    <!-- TENANTS -->
    <div v-else-if="tab === 'tenants'" class="space-y-3">
      <SearchInput v-model="search" placeholder="Search tenants by name or room…" />
      <div class="overflow-x-auto rounded border border-line bg-surface">
        <table class="w-full min-w-[640px] text-sm">
          <thead class="border-b border-line bg-paper text-left text-ink-muted">
            <tr>
              <th class="px-4 py-2 font-medium">Name</th>
              <th class="px-4 py-2 font-medium">Room</th>
              <th class="px-4 py-2 font-medium">Institution</th>
              <th class="px-4 py-2 font-medium">Monthly</th>
              <th class="px-4 py-2 font-medium">Agreement</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in filteredTenants" :key="t.id" class="border-b border-line last:border-0">
              <td class="px-4 py-2 font-medium">{{ t.firstName }} {{ t.lastName }}</td>
              <td class="px-4 py-2 text-ink-muted">{{ t.roomId }}</td>
              <td class="px-4 py-2 text-ink-muted">{{ t.institution }}</td>
              <td class="tabular px-4 py-2">{{ formatMWK(t.monthlyAmount) }}</td>
              <td class="px-4 py-2">
                <StatusPill
                  :tone="t.agreementStatus === 'SIGNED' ? 'success' : t.agreementStatus === 'PENDING' ? 'pending' : 'danger'"
                  :label="t.agreementStatus.charAt(0) + t.agreementStatus.slice(1).toLowerCase()"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- PAYMENTS -->
    <div v-else class="overflow-x-auto rounded border border-line bg-surface">
      <table class="w-full min-w-[720px] text-sm">
        <thead class="border-b border-line bg-paper text-left text-ink-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Tenant</th>
            <th class="px-4 py-2 font-medium">Expected</th>
            <th class="px-4 py-2 font-medium">Paid</th>
            <th class="px-4 py-2 font-medium">Balance</th>
            <th class="px-4 py-2 font-medium">Status</th>
            <th class="px-4 py-2 font-medium">Record payment</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tenant in hostel.tenants" :key="tenant.id" class="border-b border-line last:border-0">
            <td class="px-4 py-2 font-medium">{{ tenant.firstName }} {{ tenant.lastName }}</td>
            <template v-if="hostel.paymentFor(tenant.id)">
              <td class="tabular px-4 py-2">{{ formatMWK(hostel.paymentFor(tenant.id)!.expectedAmount) }}</td>
              <td class="tabular px-4 py-2">{{ formatMWK(hostel.paymentFor(tenant.id)!.amountPaid) }}</td>
              <td class="tabular px-4 py-2">{{ formatMWK(hostel.paymentFor(tenant.id)!.expectedAmount - hostel.paymentFor(tenant.id)!.amountPaid) }}</td>
              <td class="px-4 py-2">
                <StatusPill
                  :tone="hostel.paymentFor(tenant.id)!.amountPaid >= hostel.paymentFor(tenant.id)!.expectedAmount ? 'success' : 'pending'"
                  :label="hostel.paymentFor(tenant.id)!.amountPaid >= hostel.paymentFor(tenant.id)!.expectedAmount ? 'Paid' : 'Balance'"
                />
              </td>
              <td class="px-4 py-2">
                <div class="flex items-center gap-2">
                  <input
                    v-model.number="payAmount[tenant.id]"
                    type="number"
                    placeholder="Amount"
                    class="w-28 rounded border border-line px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    class="rounded bg-primary px-3 py-1 text-sm font-medium text-white hover:bg-primary-dark"
                    @click="pay(tenant.id, 'CASH')"
                  >
                    Add
                  </button>
                </div>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
