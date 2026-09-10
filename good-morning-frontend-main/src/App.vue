<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppShell from '@/components/layout/AppShell.vue'

const route = useRoute()
</script>

<template>
  <AppShell v-if="!route.meta.public">
    <router-view />
  </AppShell>
  <router-view v-else />
</template>
