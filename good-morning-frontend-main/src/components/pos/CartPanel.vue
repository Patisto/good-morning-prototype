<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SaleLineItem, PaymentMethod } from '@/types'
import { formatMWK } from '@/types'

const props = withDefaults(defineProps<{ items: SaleLineItem[]; showChangeCalculator?: boolean }>(), {
  showChangeCalculator: false,
})
const emit = defineEmits<{
  'update-quantity': [itemId: string, quantity: number]
  checkout: [paymentMethod: PaymentMethod]
}>()

const total = computed(() => props.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0))
const methods: PaymentMethod[] = ['CASH', 'AIRTEL_MONEY', 'TNM_MPAMBA', 'BANK']
const selectedMethod = ref<PaymentMethod>('CASH')
const cashReceived = ref<number | null>(null)
const change = computed(() => Math.max(0, (cashReceived.value ?? 0) - total.value))
const cashShort = computed(() => Math.max(0, total.value - (cashReceived.value ?? 0)))

function complete() {
  if (selectedMethod.value === 'CASH' && props.showChangeCalculator && cashShort.value > 0) return
  emit('checkout', selectedMethod.value)
  cashReceived.value = null
}
</script>

<template>
  <aside class="flex w-full shrink-0 flex-col rounded border border-line bg-surface lg:w-80">
    <div class="border-b border-line px-4 py-3">
      <h2 class="font-semibold">Current sale</h2>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-2">
      <p v-if="items.length === 0" class="py-8 text-center text-sm text-ink-muted">
        Tap an item to add it to the sale.
      </p>
      <div v-for="item in items" :key="item.itemId" class="flex items-center justify-between border-b border-line py-2 last:border-0">
        <div>
          <p class="text-sm font-medium">{{ item.name }}</p>
          <p class="tabular text-xs text-ink-muted">{{ formatMWK(item.unitPrice) }} each</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="h-7 w-7 rounded border border-line text-ink-muted hover:border-primary hover:text-primary"
            @click="$emit('update-quantity', item.itemId, item.quantity - 1)"
          >
            −
          </button>
          <span class="tabular w-5 text-center text-sm">{{ item.quantity }}</span>
          <button
            type="button"
            class="h-7 w-7 rounded border border-line text-ink-muted hover:border-primary hover:text-primary"
            @click="$emit('update-quantity', item.itemId, item.quantity + 1)"
          >
            +
          </button>
        </div>
      </div>
    </div>

    <div class="space-y-3 border-t border-line px-4 py-4">
      <div class="flex items-baseline justify-between">
        <span class="text-sm text-ink-muted">Total</span>
        <span class="tabular text-xl font-semibold">{{ formatMWK(total) }}</span>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="method in methods"
          :key="method"
          type="button"
          class="rounded border px-2 py-1.5 text-xs font-medium"
          :class="selectedMethod === method ? 'border-primary bg-primary-light text-primary-dark' : 'border-line text-ink-muted hover:border-ink-faint'"
          @click="selectedMethod = method"
        >
          {{ method.replaceAll('_', ' ') }}
        </button>
      </div>

      <div v-if="showChangeCalculator && selectedMethod === 'CASH'" class="space-y-2 rounded bg-paper p-3 text-sm">
        <label class="block text-xs font-medium text-ink-muted" for="cash-received">Cash received</label>
        <input id="cash-received" v-model.number="cashReceived" min="0" type="number" placeholder="Amount given" class="w-full rounded border border-line bg-surface px-2 py-1.5" />
        <p v-if="cashShort > 0" class="text-danger">Still due: {{ formatMWK(cashShort) }}</p>
        <p v-else class="font-medium text-success">Change: {{ formatMWK(change) }}</p>
      </div>

      <button
        type="button"
        :disabled="items.length === 0"
        class="w-full rounded bg-primary py-3 font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
        @click="complete"
      >
        Complete sale
      </button>
    </div>
  </aside>
</template>
