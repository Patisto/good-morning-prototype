<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { readLegacySnapshot } from '@/lib/local-db';
import { useTask } from '@/composables/useTask';
const { busy, error, run } = useTask();
const pending = ref(0);
onMounted(() => run(async () => { const snapshot = await readLegacySnapshot(); pending.value = snapshot.syncQueue?.length ?? 0; }));
async function download() {
    await run(async () => {
        const snapshot = await readLegacySnapshot();
        const url = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data: snapshot }, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'good-morning-legacy-browser-records.json';
        link.click();
        URL.revokeObjectURL(url);
    });
}
</script>
<template>
  <aside v-if="pending || error" class="panel mb-4 space-y-2 border-pending">
    <p v-if="pending" class="text-sm">
      This browser has {{ pending }} queued changes from the old app. They have not been uploaded to the server. Export them for reconciliation before clearing browser data.
    </p>
    <p v-if="error" class="text-sm text-danger">
      Could not read old browser records: {{ error }}
    </p>
    <button class="btn-secondary" :disabled="busy" @click="download">
      Export old browser records
    </button>
  </aside>
</template>
