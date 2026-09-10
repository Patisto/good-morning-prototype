<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  tone: 'success' | 'pending' | 'danger' | 'neutral'
  label: string
}>()

const classes = computed(() => ({
  success: 'bg-success-light text-success',
  pending: 'bg-pending-light text-pending',
  danger: 'bg-danger-light text-danger',
  neutral: 'bg-paper text-ink-muted border border-line',
}[props.tone]))
</script>

<template>
  <span class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium" :class="classes">
    {{ label }}
  </span>
</template>
