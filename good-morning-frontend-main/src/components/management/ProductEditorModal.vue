<script setup lang="ts">
import { ref } from 'vue';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useTask } from '@/composables/useTask';
import FormModal from '@/components/ui/FormModal.vue';
import type { Product, SalesBusiness } from '@/types';
const props = defineProps<{
    product?: Product;
    business: SalesBusiness;
    section: 'restaurant' | 'grocery';
}>();
const emit = defineEmits<{
    close: [
    ];
    saved: [
    ];
}>();
const auth = useAuthStore(), { busy, error, run } = useTask();
const form = ref(props.product ? { id: props.product.id, name: props.product.name, category: props.product.category, unit: props.product.unit, sellingPrice: props.product.sellingPrice, buyingPrice: props.product.buyingPrice, lowStockLevel: props.product.lowStockLevel } : { id: '', name: '', category: '', unit: 'piece', sellingPrice: 0, buyingPrice: 0, lowStockLevel: 0 });
async function save() {
    await run(async () => { await api.post(`/${props.section}/products?business=${props.business}`, form.value, auth.token); emit('saved'); emit('close'); });
}
</script>
<template>
  <FormModal :title="product ? 'Edit item' : 'Add sellable item'" :busy="busy" @close="emit('close')">
    <form class="space-y-4" @submit.prevent="save">
      <p v-if="error" class="error" role="alert">
        {{ error }}
      </p>
      <fieldset :disabled="busy" class="grid gap-3 sm:grid-cols-2">
        <label class="field">
          Item name
          <input v-model="form.name" class="input" required />
        </label>
        <label class="field">
          Category
          <input v-model="form.category" class="input" />
        </label>
        <label class="field">
          Selling unit
          <input v-model="form.unit" class="input" required placeholder="piece, portion, kg, bottle" />
        </label>
        <label class="field">
          Selling price (MWK)
          <input v-model.number="form.sellingPrice" class="input" type="number" min="0" step="0.01" required />
        </label>
        <label class="field">
          Buying price per unit (MWK)
          <input v-model.number="form.buyingPrice" class="input" type="number" min="0" step="0.01" required />
        </label>
        <label class="field">
          Low stock alert
          <input v-model.number="form.lowStockLevel" class="input" type="number" min="0" step="0.01" required />
        </label>
      </fieldset>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" :disabled="busy" @click="emit('close')">
          Cancel
        </button>
        <button class="btn" :disabled="busy">
          {{ product ? 'Save changes' : 'Add item' }}
        </button>
      </div>
    </form>
  </FormModal>
</template>
