<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed, ref, watch } from 'vue'
import SidebarNav from './SidebarNav.vue'
import SyncStatusBadge from './SyncStatusBadge.vue'

const route = useRoute()
const title = computed(() => (route.name ? String(route.name) : ''))

const sidebarOpen = ref(false)
watch(
  () => route.fullPath,
  () => {
    sidebarOpen.value = false
  }
)
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <SidebarNav :open="sidebarOpen" @close="sidebarOpen = false" />
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header class="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-4 sm:px-6">
        <div class="flex min-w-0 items-center gap-3">
          <button
            type="button"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-line text-ink-muted hover:border-ink-faint lg:hidden"
            aria-label="Open menu"
            @click="sidebarOpen = true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 class="truncate text-lg font-semibold capitalize sm:text-xl">{{ title }}</h1>
        </div>
        <SyncStatusBadge />
      </header>
      <main class="flex-1 overflow-y-auto p-4 sm:p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
