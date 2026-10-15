<script setup lang="ts">
import { useRoute } from 'vue-router'
import ToastViewport from '@/components/ui/ToastViewport.vue'
import AppShell from '@/components/layout/AppShell.vue'

const route = useRoute()
</script>

<template>
  <ToastViewport />
  <AppShell v-if="!route.meta.public">
    <router-view />
  </AppShell>
  <router-view v-else />
</template>
