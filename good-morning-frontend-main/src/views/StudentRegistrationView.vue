<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api, fromApi } from '@/lib/api';
import logo from '@/goodmorniglogo.png';
import { useTask } from '@/composables/useTask';
import { today } from '@/types';
const submitting = ref(false), success = ref(false), error = ref('');
const form = ref({ bookingCode: '', firstName: '', middleName: '', lastName: '', gender: '', dateOfBirth: '', phone: '', altPhone: '', email: '', homeDistrict: '', homeAddress: '', emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '', institution: '', programme: '', faculty: '', department: '', yearOfStudy: null as number | null, regNumber: '', academicYear: '', preferredRoomId: '', moveInDate: today() });
const rooms = ref<{id:string;label?:string;identifier:string;housingUnit:string;capacity:number;occupants:number;monthlyPrice?:number}[]>([]);
const { busy, run } = useTask();
const availableRooms = () => rooms.value.filter(room => room.occupants < room.capacity);
onMounted(() => run(async () => { rooms.value = fromApi<{rooms:typeof rooms.value}>(await api.get('/hostel/registration/options')).rooms; }));
async function submit() {
    submitting.value = true; error.value = '';
    try { await api.post('/hostel/registration', form.value); success.value = true; }
    catch (e) { error.value = e instanceof Error ? e.message : 'Could not submit registration.'; }
    finally { submitting.value = false; }
}
</script>
<template>
  <main class="min-h-screen bg-paper px-4 py-8"><section class="mx-auto max-w-3xl space-y-5 rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-8">
    <header class="flex items-center gap-4"><img :src="logo" alt="Good Morning logo" class="h-16 w-16 object-contain"><div><h1 class="text-2xl font-bold text-primary">Student registration</h1><p class="text-sm text-ink-muted">Share your details so the hostel manager can set up your tenant profile and assign a room.</p></div></header>
    <p v-if="success" class="rounded bg-primary-light p-4 font-medium">Your details have been submitted. The hostel manager will review your profile and contact you about your room.</p>
    <form v-else class="space-y-5" @submit.prevent="submit">
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <fieldset class="rounded border border-primary bg-primary-light p-4"><legend class="px-1 font-semibold">Booking payment</legend><p class="mb-3 text-sm">Enter the one-use booking code sent to your email after payment was confirmed.</p><label class="field">Booking code<input v-model.trim="form.bookingCode" class="input uppercase" placeholder="GM-1234ABCD-5678EF90" required autocomplete="one-time-code"></label></fieldset>
      <fieldset class="grid gap-3 sm:grid-cols-2"><legend class="mb-3 font-semibold">Personal details</legend>
        <input v-model="form.firstName" class="input" placeholder="First name *" required><input v-model="form.middleName" class="input" placeholder="Middle name">
        <input v-model="form.lastName" class="input" placeholder="Last name *" required><input v-model="form.phone" class="input" placeholder="Phone *" required>
        <select v-model="form.gender" class="input"><option value="">Gender</option><option>Female</option><option>Male</option><option>Other</option></select><input v-model="form.dateOfBirth" class="input" type="date" aria-label="Date of birth">
        <input v-model="form.altPhone" class="input" placeholder="Alternative phone"><input v-model="form.email" class="input" type="email" placeholder="Email">
        <input v-model="form.homeDistrict" class="input" placeholder="Home district"><input v-model="form.homeAddress" class="input" placeholder="Home address">
        <input v-model="form.emergencyContactName" class="input" placeholder="Emergency contact name"><input v-model="form.emergencyContactPhone" class="input" placeholder="Emergency contact phone">
        <input v-model="form.emergencyContactRelationship" class="input sm:col-span-2" placeholder="Emergency contact relationship">
      </fieldset>
      <fieldset class="grid gap-3 sm:grid-cols-2"><legend class="mb-3 font-semibold">School details</legend>
        <input v-model="form.institution" class="input" placeholder="Institution"><input v-model="form.programme" class="input" placeholder="Programme">
        <input v-model="form.faculty" class="input" placeholder="Faculty / school"><input v-model="form.department" class="input" placeholder="Department">
        <input v-model.number="form.yearOfStudy" class="input" type="number" min="1" placeholder="Year of study"><input v-model="form.regNumber" class="input" placeholder="Student registration number"><input v-model="form.academicYear" class="input" placeholder="Academic year">
      </fieldset>
      <fieldset class="grid gap-3 sm:grid-cols-2"><legend class="mb-3 font-semibold">Room preference</legend>
        <label class="field">Preferred room (optional)<select v-model="form.preferredRoomId" class="input"><option value="">No preference</option><option v-for="room in availableRooms()" :key="room.id" :value="room.id">{{ room.housingUnit }} · {{ room.label || room.identifier }} ({{ room.capacity-room.occupants }} beds)</option></select></label>
        <label class="field">Preferred move-in date<input v-model="form.moveInDate" class="input" type="date" :max="today()" required></label>
      </fieldset>
      <p class="text-sm text-ink-muted">This is a registration request. Room assignment and rent are confirmed by the hostel manager. The accommodation agreement will be signed on a physical form.</p>
      <div class="flex flex-wrap gap-3"><button class="btn" :disabled="busy||submitting">{{ submitting ? 'Submitting…' : 'Submit registration' }}</button><router-link class="btn-secondary" to="/login">Staff login</router-link></div>
    </form>
  </section></main>
</template>
