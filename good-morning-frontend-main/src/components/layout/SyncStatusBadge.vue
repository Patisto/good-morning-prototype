<script setup lang="ts">
import { computed } from 'vue'
import { useSyncStore } from '@/stores/sync'

const sync = useSyncStore()

const state = computed(() => {
  if (sync.connection === 'OFFLINE') return { label: 'Offline', dot: 'bg-danger', tone: 'text-danger' }
  if (sync.pendingCount > 0)
    return { label: `${sync.pendingCount} change${sync.pendingCount > 1 ? 's' : ''} waiting`, dot: 'bg-pending', tone: 'text-pending' }
  return { label: 'Synced', dot: 'bg-success', tone: 'text-success' }
})

function handleClick() {
  void sync.flushIfOnline()
}
</script>

<template>
  <button
    type="button"
    class="flex items-center gap-2 rounded border border-line bg-surface px-3 py-1.5 text-sm hover:border-ink-faint"
    title="Checks the durable local sync queue"
    @click="handleClick"
  >
    <span class="h-2 w-2 rounded-full" :class="state.dot" />
    <span :class="state.tone">{{ state.label }}</span>
  </button>
</template>
