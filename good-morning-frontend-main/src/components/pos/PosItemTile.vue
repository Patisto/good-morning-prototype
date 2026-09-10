<script setup lang="ts">
import { formatMWK } from '@/types'

defineProps<{
  name: string
  price: number
  disabled?: boolean
  sublabel?: string
}>()

defineEmits<{ tap: [] }>()
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    class="flex min-h-[104px] flex-col justify-between rounded border border-line bg-surface p-4 text-left transition-colors hover:border-primary hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-40"
    @click="$emit('tap')"
  >
    <span class="font-medium leading-snug">{{ name }}</span>
    <span class="flex items-baseline justify-between">
      <span class="tabular text-sm text-ink-muted">{{ sublabel }}</span>
      <span class="tabular font-semibold text-primary-dark">{{ formatMWK(price) }}</span>
    </span>
  </button>
</template>
