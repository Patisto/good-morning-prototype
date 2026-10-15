<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
const online = ref(navigator.onLine);
const update = () => { online.value = navigator.onLine; };
onMounted(() => { window.addEventListener('online', update); window.addEventListener('offline', update); });
onUnmounted(() => { window.removeEventListener('online', update); window.removeEventListener('offline', update); });
</script>
<template><span class="text-xs" :class="online ? 'text-ink-muted' : 'text-danger'">{{ online ? 'Server-backed records' : 'Offline · reconnect to save' }}</span></template>
