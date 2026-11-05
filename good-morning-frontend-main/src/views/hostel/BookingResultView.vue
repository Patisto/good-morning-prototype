<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/lib/api';
import logo from '@/goodmorniglogo.png';
const route = useRoute(), state = ref('CHECKING'), busy = ref(false), error = ref('');
const retryBookingUrl = computed(() => typeof route.query.booking_token === 'string' ? `/hostel-booking/${encodeURIComponent(route.query.booking_token)}` : '');
async function refresh() {
    const txRef = typeof route.query.tx_ref === 'string' ? route.query.tx_ref : '';
    if (!txRef) { state.value = 'UNKNOWN'; return; }
    busy.value = true; error.value = '';
    try { state.value = (await api.get<{status:string}>(`/hostel/bookings/payment-status/${encodeURIComponent(txRef)}`)).status; }
    catch (e) { error.value = e instanceof Error ? e.message : 'Could not check payment status.'; }
    finally { busy.value = false; }
}
onMounted(() => { void refresh(); });
</script>
<template>
  <main class="min-h-screen bg-paper px-4 py-10"><section class="mx-auto max-w-lg space-y-5 rounded-xl border border-line bg-surface p-6 text-center shadow-sm sm:p-8">
    <img :src="logo" alt="Good Morning" class="mx-auto h-16 w-16 object-contain"><h1 class="text-2xl font-semibold">Booking payment status</h1>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="state==='PAID' || state==='USED'" class="rounded bg-primary-light p-4">Payment confirmed. Your booking code has been sent to your email. Enter it on the student registration form.</p>
    <p v-else-if="state==='PENDING' && route.query.status === 'failed'" class="rounded bg-pending-light p-4 text-sm">Payment was not completed. You can retry from the booking link.</p>
    <p v-else-if="state==='PENDING' || state==='CHECKING'" class="text-sm text-ink-muted">{{ busy || state==='CHECKING' ? 'Checking your payment…' : 'Payment is still being confirmed. Check your email for the booking code after confirmation.' }}</p>
    <p v-else-if="state==='FAILED'" class="rounded bg-danger-light p-4 text-danger">This payment was not completed. Return to your booking link to try again.</p>
    <p v-else class="text-sm text-ink-muted">We couldn’t find this booking payment. Contact the hostel manager if you completed payment.</p>
    <button v-if="state==='PENDING' || error" class="btn-secondary" :disabled="busy" @click="refresh">Check again</button>
    <router-link v-if="state==='PENDING' && retryBookingUrl" class="btn-secondary inline-block" :to="retryBookingUrl">Return to booking</router-link>
    <router-link v-if="state==='PAID' || state==='USED'" class="btn inline-block" to="/student-registration">Continue to registration</router-link>
  </section></main>
</template>
