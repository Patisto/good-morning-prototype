<script setup lang="ts">
defineProps<{ modelValue: string; placeholder?: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <input
    type="search"
    :value="modelValue"
    :placeholder="placeholder ?? 'Search…'"
    class="w-full rounded border border-line bg-surface px-3 py-2 text-sm placeholder:text-ink-faint focus:border-primary"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
