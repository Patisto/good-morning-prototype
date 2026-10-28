<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api, fromApi } from '@/lib/api';
import logo from '@/goodmorniglogo.png';
import { useTask } from '@/composables/useTask';
import { today } from '@/types';
const canvas = ref<HTMLCanvasElement | null>(null), signed = ref(false), submitting = ref(false), success = ref(false);
const form = ref({ firstName: '', middleName: '', lastName: '', gender: '', dateOfBirth: '', phone: '', altPhone: '', email: '', homeDistrict: '', homeAddress: '', emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '', institution: '', programme: '', faculty: '', department: '', yearOfStudy: null as number | null, regNumber: '', academicYear: '', preferredRoomId: '', moveInDate: today(), deposit: 0 });
const rooms = ref<{id:string;label?:string;identifier:string;housingUnit:string;capacity:number;occupants:number}[]>([]);
const { busy, error, run } = useTask();
const availableRooms = computed(() => rooms.value.filter(room => room.occupants < room.capacity));
onMounted(() => run(async () => { rooms.value = fromApi<{rooms:typeof rooms.value}>(await api.get('/hostel/registration/options')).rooms; }));
function point(event: PointerEvent) { const c = canvas.value!, rect = c.getBoundingClientRect(); return { x:(event.clientX-rect.left)*c.width/rect.width, y:(event.clientY-rect.top)*c.height/rect.height }; }
function start(event: PointerEvent) { const c=canvas.value!,ctx=c.getContext('2d')!; c.setPointerCapture(event.pointerId); const p=point(event); ctx.beginPath(); ctx.moveTo(p.x,p.y); signed.value=true; }
function draw(event: PointerEvent) { if (!signed.value) return; const c=canvas.value!,ctx=c.getContext('2d')!,p=point(event); ctx.lineWidth=3;ctx.lineCap='round';ctx.strokeStyle='#17251d';ctx.lineTo(p.x,p.y);ctx.stroke(); }
function clearSignature() { const c=canvas.value!; c.getContext('2d')!.clearRect(0,0,c.width,c.height); signed.value=false; }
async function submit() { if (!signed.value) return; submitting.value=true; try { await api.post('/hostel/registration',{...form.value,studentSignature:canvas.value!.toDataURL('image/png')}); success.value=true; } catch (e) { error.value=e instanceof Error?e.message:'Could not submit registration.'; } finally { submitting.value=false; } }
</script>
<template>
  <main class="min-h-screen bg-paper px-4 py-8"><section class="mx-auto max-w-3xl space-y-5 rounded-xl border border-line bg-surface p-5 shadow-sm sm:p-8">
    <header class="flex items-center gap-4"><img :src="logo" alt="Good Morning logo" class="h-16 w-16 object-contain"><div><h1 class="text-2xl font-bold text-primary">Student accommodation registration</h1><p class="text-sm text-ink-muted">Complete this form and sign electronically. Your application will be sent to Good Morning for review.</p></div></header>
    <p v-if="success" class="rounded bg-primary-light p-4 font-medium">Application submitted successfully. Good Morning will contact you using the details provided.</p>
    <form v-else class="space-y-5" @submit.prevent="submit">
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <fieldset class="grid gap-3 sm:grid-cols-2"><legend class="mb-3 font-semibold">Personal details</legend>
        <input v-model="form.firstName" class="input" placeholder="First name *" required><input v-model="form.middleName" class="input" placeholder="Middle name">
        <input v-model="form.lastName" class="input" placeholder="Last name *" required><input v-model="form.phone" class="input" placeholder="Phone *" required>
        <select v-model="form.gender" class="input"><option value="">Gender</option><option>Female</option><option>Male</option><option>Other</option></select><input v-model="form.dateOfBirth" class="input" type="date" aria-label="Date of birth">
        <input v-model="form.altPhone" class="input" placeholder="Alternative phone"><input v-model="form.email" class="input" type="email" placeholder="Email">
        <input v-model="form.homeDistrict" class="input" placeholder="Home district"><input v-model="form.homeAddress" class="input" placeholder="Home address">
        <input v-model="form.emergencyContactName" class="input" placeholder="Emergency contact name"><input v-model="form.emergencyContactPhone" class="input" placeholder="Emergency contact phone">
        <input v-model="form.emergencyContactRelationship" class="input sm:col-span-2" placeholder="Emergency contact relationship">
        <input v-model="form.institution" class="input" placeholder="Institution">
        <input v-model="form.programme" class="input" placeholder="Programme"><input v-model="form.faculty" class="input" placeholder="Faculty / school">
        <input v-model="form.department" class="input" placeholder="Department"><input v-model.number="form.yearOfStudy" class="input" type="number" min="1" placeholder="Year of study">
        <input v-model="form.regNumber" class="input" placeholder="Student registration number"><input v-model="form.academicYear" class="input" placeholder="Academic year">
      </fieldset>
      <fieldset class="grid gap-3 sm:grid-cols-2"><legend class="mb-3 font-semibold">Accommodation preferences</legend>
        <label class="field">Preferred room (subject to availability)<select v-model="form.preferredRoomId" class="input"><option value="">No preference</option><option v-for="r in availableRooms" :key="r.id" :value="r.id">{{ r.housingUnit }} · {{ r.label || r.identifier }} ({{ r.capacity-r.occupants }} beds)</option></select></label>
        <label class="field">Preferred move-in date<input v-model="form.moveInDate" class="input" type="date" :max="today()" required></label>
        <label class="field">Deposit amount offered (MWK)<input v-model.number="form.deposit" class="input" type="number" min="0" step="0.01"></label>
      </fieldset>
      <div class="space-y-2"><label class="font-semibold">Student online signature *</label><canvas ref="canvas" width="900" height="220" class="block h-44 w-full touch-none rounded border border-line bg-white" @pointerdown="start" @pointermove="draw"></canvas><p class="text-xs text-ink-muted">Sign above using your finger, stylus, or mouse. Your signature is submitted with this application.</p><button type="button" class="btn-secondary" @click="clearSignature">Clear signature</button></div>
      <div class="flex flex-wrap gap-3"><button class="btn" :disabled="busy||submitting||!signed">{{ submitting?'Submitting…':'Submit registration' }}</button><router-link class="btn-secondary" to="/login">Staff login</router-link></div>
    </form>
  </section></main>
</template>
