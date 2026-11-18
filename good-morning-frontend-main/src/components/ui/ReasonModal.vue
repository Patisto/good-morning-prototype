<script setup lang="ts">
import { ref } from 'vue';
import FormModal from './FormModal.vue';

const props = defineProps<{
  title: string;
  description: string;
  busy?: boolean;
  error?: string;
}>();
const emit = defineEmits<{
  close: [];
  submit: [reason: string];
}>();
const reason = ref('');
</script>

<template>
  <FormModal :title="props.title" :busy="props.busy" @close="emit('close')">
    <form class="space-y-4" @submit.prevent="emit('submit', reason.trim())">
      <p class="text-sm text-ink-muted">{{ props.description }}</p>
      <p v-if="props.error" class="error" role="alert">{{ props.error }}</p>
      <label class="field">
        Reason for reversal
        <textarea v-model="reason" class="input min-h-24" maxlength="500" required />
      </label>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" :disabled="props.busy" @click="emit('close')">Cancel</button>
        <button class="btn-destructive" :disabled="props.busy || !reason.trim()">Reverse record</button>
      </div>
    </form>
  </FormModal>
</template>
