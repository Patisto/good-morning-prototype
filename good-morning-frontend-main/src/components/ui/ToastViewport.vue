<script setup lang="ts">
import { useNotificationsStore } from '@/stores/notifications';
const notifications = useNotificationsStore();
</script>
<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed right-4 top-4 z-[100] w-[calc(100%-2rem)] max-w-sm space-y-2" aria-live="polite" aria-atomic="false">
      <div v-for="item in notifications.items" :key="item.id" class="pointer-events-auto flex items-start justify-between gap-3 rounded-lg border p-4 shadow-lg" :class="item.tone === 'success' ? 'border-success bg-success-light text-success' : 'border-danger bg-danger-light text-danger'" :role="item.tone === 'error' ? 'alert' : 'status'">
        <span class="text-sm font-medium">{{ item.message }}</span>
        <button type="button" aria-label="Dismiss notification" class="px-1" @click="notifications.dismiss(item.id)">×</button>
      </div>
    </div>
  </Teleport>
</template>
