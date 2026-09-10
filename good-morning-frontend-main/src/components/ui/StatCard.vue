<script setup lang="ts">
defineProps<{
  label: string
  value: string
  tone?: 'default' | 'success' | 'pending' | 'danger'
}>()
</script>

<template>
  <div class="rounded border border-line bg-surface p-4">
    <p class="text-sm text-ink-muted">{{ label }}</p>
    <p
      class="tabular mt-1 text-2xl font-semibold"
      :class="{
        'text-success': tone === 'success',
        'text-pending': tone === 'pending',
        'text-danger': tone === 'danger',
      }"
    >
      {{ value }}
    </p>
  </div>
</template>
