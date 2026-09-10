<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

function logout() {
  auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="max-w-md space-y-4">
    <div class="rounded border border-line bg-surface p-4">
      <h2 class="mb-3 font-semibold">Account</h2>
      <dl class="space-y-2 text-sm">
        <div class="flex justify-between">
          <dt class="text-ink-muted">Name</dt>
          <dd class="font-medium">{{ auth.name }}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-ink-muted">Email</dt>
          <dd class="font-medium">{{ auth.user?.email }}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-ink-muted">Role</dt>
          <dd class="font-medium capitalize">{{ auth.role?.replaceAll('_', ' ').toLowerCase() }}</dd>
        </div>
      </dl>
    </div>

    <button
      type="button"
      class="w-full rounded border border-line px-3 py-2 text-sm font-medium text-danger hover:border-danger"
      @click="logout"
    >
      Log out
    </button>
  </div>
</template>
