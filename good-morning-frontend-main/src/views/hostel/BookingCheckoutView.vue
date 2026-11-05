<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api, fromApi } from '@/lib/api';
import logo from '@/goodmorniglogo.png';
type Offer = { title: string; amount: number; roomId?: string; housingUnit?: string; label?: string; identifier?: string };
const route = useRoute(), offer = ref<Offer | null>(null), email = ref(''), busy = ref(false), error = ref('');
onMounted(async () => {
    try { offer.value = fromApi<Offer>(await api.get(`/hostel/bookings/links/${encodeURIComponent(String(route.params.token))}`)); }
    catch (e) { error.value = e instanceof Error ? e.message : 'This booking link is unavailable.'; }
});
async function pay() {
    busy.value = true; error.value = '';
    try {
        const result = await api.post<{checkoutUrl:string}>(`/hostel/bookings/links/${encodeURIComponent(String(route.params.token))}/checkout`, { email: email.value });
        window.location.assign(result.checkoutUrl);
    }
    catch (e) { error.value = e instanceof Error ? e.message : 'Could not start payment.'; busy.value = false; }
}
</script>
<template>
  <main class="min-h-screen bg-paper px-4 py-10"><section class="mx-auto max-w-lg space-y-5 rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8">
    <header class="flex items-center gap-4"><img :src="logo" alt="Good Morning" class="h-14 w-14 object-contain"><div><p class="text-sm font-medium uppercase tracking-wide text-primary">Good Morning Hostel</p><h1 class="text-2xl font-semibold">Booking payment</h1></div></header>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <template v-if="offer">
      <div class="rounded bg-paper p-4"><p class="font-semibold">{{ offer.title }}</p><p v-if="offer.roomId" class="text-sm text-ink-muted">{{ offer.housingUnit }} · {{ offer.label || offer.identifier || offer.roomId }}</p><p class="mt-3 text-2xl font-semibold">MWK {{ offer.amount.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</p></div>
      <p class="text-sm text-ink-muted">Enter your email address. You’ll continue to PayChangu to pay. Once payment is confirmed, we’ll email your one-use booking code to this address.</p>
      <form class="space-y-4" @submit.prevent="pay"><label class="field">Email address<input v-model.trim="email" class="input" type="email" required autocomplete="email"></label><button class="btn w-full" :disabled="busy">{{ busy ? 'Opening PayChangu…' : 'Continue to secure payment' }}</button></form>
    </template>
    <p v-else-if="!error" class="text-sm text-ink-muted">Loading booking…</p>
  </section></main>
</template>
