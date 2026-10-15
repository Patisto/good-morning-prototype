<script setup lang="ts">
import AccountEditorModal from '@/components/management/AccountEditorModal.vue';
import { onMounted, ref } from 'vue';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useTask } from '@/composables/useTask';
const auth = useAuthStore(), { busy, error, run } = useTask();
interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
}
const users = ref<User[]>([]), roles = ref<string[]>([]);
const editorOpen = ref(false);
const editedUser = ref<User | undefined>();
function edit(user?: User) { editedUser.value = user; editorOpen.value = true; }
async function load() {
    const data = await api.get<{
        users: User[];
        roles: string[];
    }>('/users', auth.token);
    users.value = data.users;
    roles.value = data.roles;
}
onMounted(() => run(load));
</script>
<template>
  <div class="space-y-4">
    <h2 class="text-xl font-semibold">
      Team & roles
    </h2>
    <p class="text-sm text-ink-muted">
      Business managers configure their department and record expenses. Cashiers record sales. Super managers can manage all businesses and see combined reporting. Accountants can review operations and record expenses.
    </p>
    <p v-if="error" class="error" role="alert">
      {{ error }}
    </p>
    <button class="btn" :disabled="busy || !roles.length" @click="edit()">Add account</button>
    <AccountEditorModal v-if="editorOpen" :user="editedUser" :roles="roles" @close="editorOpen=false" @saved="run(load)" />
    <div class="overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>
              Name
            </th>
            <th>
              Email
            </th>
            <th>
              Role
            </th>
            <th>
              Status
            </th>
            <th>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>
              {{ user.name }}
            </td>
            <td>
              {{ user.email }}
            </td>
            <td>
              {{ user.role.replaceAll('_',' ') }}
            </td>
            <td>
              {{ user.active ? 'Active' : 'Inactive' }}
            </td>
            <td>
              <button class="btn-secondary" :disabled="busy || user.id===auth.user?.id" @click="edit(user)">
                Edit
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
