<script setup lang="ts">
import { ref } from 'vue';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useTask } from '@/composables/useTask';
import FormModal from '@/components/ui/FormModal.vue';
const props = defineProps<{
    user?: {
        id: string;
        name: string;
        email: string;
        role: string;
        active: boolean;
    };
    roles: string[];
}>();
const emit = defineEmits<{
    close: [
    ];
    saved: [
    ];
}>();
const auth = useAuthStore(), { busy, error, run } = useTask();
const form = ref(props.user ? { ...props.user, password: '' } : { id: '', name: '', email: '', role: 'HOSTEL_MANAGER', active: true, password: '' });
async function save() {
    await run(async () => { await api.post('/users', form.value, auth.token); emit('saved'); emit('close'); });
}
</script>
<template>
  <FormModal :title="user ? 'Edit staff account' : 'Add staff account'" :busy="busy" @close="emit('close')">
    <form class="space-y-4" @submit.prevent="save">
      <p v-if="error" class="error" role="alert">
        {{ error }}
      </p>
      <fieldset :disabled="busy" class="grid gap-3 sm:grid-cols-2">
        <label class="field">
          Name
          <input v-model="form.name" class="input" required />
        </label>
        <label class="field">
          Email
          <input v-model="form.email" class="input" type="email" required />
        </label>
        <label class="field">
          Role
          <select v-model="form.role" class="input">
            <option v-for="role in roles" :key="role" :value="role">
              {{ role.replaceAll('_',' ') }}
            </option>
          </select>
        </label>
        <label class="field">
          {{ user ? 'New password (leave blank to keep)' : 'Password' }}
          <input v-model="form.password" class="input" type="password" autocomplete="new-password" minlength="12" :required="!user" />
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="form.active" type="checkbox" />
          Active account
        </label>
      </fieldset>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" :disabled="busy" @click="emit('close')">
          Cancel
        </button>
        <button class="btn" :disabled="busy">
          {{ user ? 'Save changes' : 'Create account' }}
        </button>
      </div>
    </form>
  </FormModal>
</template>
