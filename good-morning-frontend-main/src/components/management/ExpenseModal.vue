<script setup lang="ts">
import { ref } from 'vue';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useTask } from '@/composables/useTask';
import FormModal from '@/components/ui/FormModal.vue';
import { businessName, paymentMethods, today, type Business, type PaymentMethod } from '@/types';
const props = defineProps<{
    businesses: Business[];
    business?: Business;
}>();
const emit = defineEmits<{
    close: [
    ];
    saved: [
    ];
}>();
const auth = useAuthStore(), { busy, error, run } = useTask();
const options = props.businesses.filter(b => b !== 'RESTAURANT');
const form = ref({ description: '', amount: null as number | null, business: props.business && options.includes(props.business) ? props.business : options[0], date: today(), paymentMethod: 'CASH' as PaymentMethod, notes: '' });
async function save() {
    await run(async () => { await api.post('/expenses', form.value, auth.token); emit('saved'); emit('close'); });
}
</script>
<template>
  <FormModal title="Record expense" :busy="busy" @close="emit('close')">
    <form class="space-y-4" @submit.prevent="save">
      <p v-if="error" class="error" role="alert">
        {{ error }}
      </p>
      <fieldset :disabled="busy" class="grid gap-3 sm:grid-cols-2">
        <label class="field sm:col-span-2">
          Description
          <input v-model="form.description" class="input" maxlength="500" required />
        </label>
        <label class="field">
          Business
          <select v-model="form.business" class="input" required>
            <option v-for="business in options" :key="business" :value="business">
              {{ businessName(business) }}
            </option>
          </select>
        </label>
        <label class="field">
          Amount (MWK)
          <input v-model.number="form.amount" class="input" type="number" min="0.01" step="0.01" required />
        </label>
        <label class="field">
          Date
          <input v-model="form.date" class="input" type="date" required />
        </label>
        <label class="field">
          Payment method
          <select v-model="form.paymentMethod" class="input">
            <option v-for="method in paymentMethods" :key="method" :value="method">
              {{ method.replaceAll('_',' ') }}
            </option>
          </select>
        </label>
        <label class="field sm:col-span-2">
          Notes
          <textarea v-model="form.notes" class="input" maxlength="2000" />
        </label>
      </fieldset>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" :disabled="busy" @click="emit('close')">
          Cancel
        </button>
        <button class="btn" :disabled="busy || !options.length">
          Record expense
        </button>
      </div>
    </form>
  </FormModal>
</template>
