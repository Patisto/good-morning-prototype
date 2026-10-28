<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useHostelStore } from '@/stores/hostel';
import { useAuthStore } from '@/stores/auth';
import RentPayments from '@/components/management/RentPayments.vue';
import RoomConfiguration from '@/components/management/RoomConfiguration.vue';
import ReceivePaymentModal from '@/components/management/ReceivePaymentModal.vue';
import FormModal from '@/components/ui/FormModal.vue';
import { useTask } from '@/composables/useTask';
import { downloadAgreement } from '@/lib/accommodation-agreement';
import StatusPill from '@/components/ui/StatusPill.vue';
import SearchInput from '@/components/ui/SearchInput.vue';
import { api, fromApi } from '@/lib/api';
import { formatMWK, today } from '@/types';
import type { Room, Tenant } from '@/types';
type TenantDraft = Omit<Tenant, 'id'>;
const hostel = useHostelStore();
const auth = useAuthStore();
const tab = ref('rooms');
const unitFilter = ref('');
const paymentTenant = ref<string | null>(null);
const { busy, error, run } = useTask();
onMounted(() => run(() => hostel.hydrate()));
const search = ref('');
const selectedRoom = ref<Room | null>(null);
const selectedTenant = ref<Tenant | null>(null);
const editing = ref(false);
const savingError = ref('');
type StudentApplication = { id:string; firstName:string; middleName?:string; lastName:string; phone:string; email?:string; institution?:string; programme?:string; regNumber?:string; academicYear?:string; submittedAt:string; studentSignature:string; roomLabel?:string; roomIdentifier?:string; housingUnit?:string };
const applications = ref<StudentApplication[]>([]);
async function loadApplications() { applications.value = fromApi<{applications:StudentApplication[]}>(await api.get('/hostel/applications', auth.token)).applications; }
const registrationUrl = `${window.location.origin}/student-registration`;
async function copyRegistrationLink() { await navigator.clipboard.writeText(registrationUrl); }
watch(tab, value => { if (value === 'tenants' && canManage.value) void run(loadApplications); });
const canManage = computed(() => auth.canManage('hostel'));
const roomsByUnit = computed(() => {
    const groups = new Map<string, Room[]>();
    for (const room of hostel.rooms) {
        if (unitFilter.value && room.housingUnitId !== unitFilter.value)
            continue;
        if (!groups.has(room.housingUnit))
            groups.set(room.housingUnit, []);
        groups.get(room.housingUnit)!.push(room);
    }
    return groups;
});
const filteredTenants = computed(() => hostel.tenants.filter((tenant) => !tenant.checkoutDate && `${tenant.firstName} ${tenant.lastName} ${tenant.roomId}`.toLowerCase().includes(search.value.toLowerCase())));
const roomName = (id: string) => { const room = hostel.rooms.find(r => r.id === id); return room?.label || room?.identifier || id; };
const roomOccupants = computed(() => selectedRoom.value ? hostel.tenantByRoom(selectedRoom.value.id) : []);
const availableRooms = computed(() => hostel.rooms.filter((room) => room.occupants < room.capacity || room.id === selectedTenant.value?.roomId));
function blankTenant(): TenantDraft {
    return { firstName: '', middleName: '', lastName: '', gender: '', dateOfBirth: '', phone: '', altPhone: '', email: '', homeDistrict: '', homeAddress: '', emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '', institution: '', programme: '', faculty: '', department: '', yearOfStudy: undefined, regNumber: '', academicYear: '', roomId: '', monthlyAmount: 0, deposit: 0, moveInDate: today(), agreementStatus: 'PENDING' };
}
const form = ref<TenantDraft>(blankTenant());
function statusTone(room: Room) { const status = hostel.roomStatus(room); return status === 'OCCUPIED' ? 'success' : status === 'PARTIAL' ? 'pending' : 'neutral'; }
function openRoom(room: Room) { selectedRoom.value = room; }
function viewTenant(tenant: Tenant) { selectedRoom.value = null; selectedTenant.value = tenant; editing.value = false; }
function addTenant() { selectedTenant.value = null; form.value = blankTenant(); savingError.value = ''; editing.value = true; }
function editTenant() {
    if (!selectedTenant.value)
        return;
    form.value = { ...selectedTenant.value };
    savingError.value = '';
    editing.value = true;
}
watch(() => form.value.roomId, id => { form.value.monthlyAmount = hostel.rooms.find(r => r.id === id)?.monthlyPrice ?? 0; });
async function saveTenant() {
    savingError.value = '';
    await run(async () => {
        const result = selectedTenant.value ? await hostel.updateTenant({ ...form.value, id: selectedTenant.value.id }) : await hostel.addTenant(form.value);
        selectedTenant.value = hostel.tenants.find(t => t.id === result.id) ?? null;
        editing.value = false;
    });
    savingError.value = error.value;
}
async function checkout() {
    if (!selectedTenant.value || !confirm('Check out this tenant today? Payment history will be retained.'))
        return;
    await run(async () => {
        await hostel.mutate(`/tenants/${selectedTenant.value!.id}/checkout`, { date: today() });
        selectedTenant.value = null;
    });
}
function closeModal() { selectedRoom.value = null; selectedTenant.value = null; editing.value = false; }
</script>

<template>
  <div class="space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-xl font-semibold">Hostel management</h2>
      <div class="flex gap-2">
        <router-link v-if="auth.canSee('finance')" class="btn-secondary" to="/finance?business=HOSTEL">View finances</router-link>
        <button v-if="canManage" class="btn" :disabled="busy" @click="paymentTenant=''">Receive payment</button>
      </div>
    </header>
    <p v-if="error" class="error" role="alert">
      {{ error }}
      <button class="underline" @click="run(() => hostel.hydrate())">
        Retry
      </button>
    </p>
    <p v-if="hostel.refreshError" class="error" role="alert">
      {{ hostel.refreshError }}
      <button class="underline" @click="run(() => hostel.hydrate())">
        Refresh
      </button>
    </p>
    <p v-if="busy" role="status" class="text-sm text-ink-muted">
      Saving / loading…
    </p>
    <div class="flex items-center justify-between gap-3 border-b border-line">
      <div class="flex flex-wrap gap-1">
        <button v-for="item in (canManage ? ['rooms', 'tenants', 'payments', 'configuration'] : ['rooms', 'tenants', 'payments'])" :key="item" type="button" class="border-b-2 px-4 py-2 text-sm font-medium capitalize" :class="tab === item ? 'border-primary text-primary-dark' : 'border-transparent text-ink-muted hover:text-ink'" @click="tab = item">
          {{ item }}
        </button>
      </div>
      <button v-if="canManage && tab === 'tenants'" type="button" class="rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark" @click="addTenant">
        Add tenant
      </button>
    </div>
    <section v-if="tab==='tenants' && canManage" class="panel space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3"><div><h3 class="font-semibold">Student registration link</h3><p class="text-sm text-ink-muted">Share this link with students. Their signed applications will appear here.</p></div><button type="button" class="btn-secondary" @click="copyRegistrationLink">Copy registration link</button></div>
      <a class="break-all text-sm text-primary underline" :href="registrationUrl" target="_blank" rel="noopener">{{ registrationUrl }}</a>
      <div class="flex items-center justify-between gap-3"><h3 class="font-semibold">Student applications</h3><button type="button" class="btn-secondary" :disabled="busy" @click="run(loadApplications)">Refresh applications</button></div>
      <p v-if="!applications.length" class="text-sm text-ink-muted">No student applications loaded. Refresh to check for submissions.</p>
      <div v-for="application in applications" :key="application.id" class="grid gap-4 rounded border border-line p-4 sm:grid-cols-[1fr_240px]">
        <div><p class="font-medium">{{ application.firstName }} {{ application.middleName }} {{ application.lastName }}</p><p class="text-sm text-ink-muted">{{ application.phone }} · {{ application.email || 'No email' }}</p><p class="text-sm">{{ application.institution || 'Institution not provided' }} · {{ application.programme || 'Programme not provided' }} · {{ application.regNumber || 'No registration number' }}</p><p class="mt-1 text-xs text-ink-muted">Submitted {{ new Date(application.submittedAt).toLocaleString() }}<span v-if="application.roomLabel || application.roomIdentifier"> · Preferred: {{ application.housingUnit }} {{ application.roomLabel || application.roomIdentifier }}</span></p></div>
        <div><p class="mb-1 text-xs font-medium">Student signature</p><img :src="application.studentSignature" alt="Student online signature" class="h-20 w-full rounded border border-line bg-white object-contain"></div>
      </div>
    </section>
    <div v-if="tab === 'rooms'" class="space-y-6">
      <label class="field max-w-sm">Housing unit
        <select v-model="unitFilter" class="input"><option value="">All units</option><option v-for="unit in hostel.units" :key="unit.id" :value="unit.id">{{ unit.name }}</option></select>
      </label>
      <p v-if="!roomsByUnit.size" class="panel text-sm text-ink-muted">No rooms in this housing unit.</p>
      <div v-for="[unit, roomsInUnit] in roomsByUnit" :key="unit">
        <h3 class="mb-2 text-sm font-medium text-ink-muted">
          {{ unit }}
        </h3>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <div v-for="room in roomsInUnit" :key="room.id" role="button" tabindex="0" class="cursor-pointer rounded border border-line bg-surface p-3 transition hover:border-primary hover:shadow-sm" @click="openRoom(room)" @keydown.enter="openRoom(room)">
            <p class="font-medium">
              {{ room.label ?? room.identifier }}
            </p>
            <p class="text-xs text-ink-muted">
              Capacity · {{ room.occupants }}/{{ room.capacity }}
            </p>
            <StatusPill class="mt-2" :tone="statusTone(room)" :label="hostel.roomStatus(room).charAt(0) + hostel.roomStatus(room).slice(1).toLowerCase()" />
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="tab === 'tenants'" class="space-y-3">
      <SearchInput v-model="search" placeholder="Search tenants by name or room…" />
      <div class="overflow-x-auto rounded border border-line bg-surface">
        <table class="w-full min-w-[640px] text-sm">
          <thead class="border-b border-line bg-paper text-left text-ink-muted">
            <tr>
              <th class="px-4 py-2 font-medium">
                Name
              </th>
              <th class="px-4 py-2 font-medium">
                Room
              </th>
              <th class="px-4 py-2 font-medium">
                Institution
              </th>
              <th class="px-4 py-2 font-medium">
                Monthly
              </th>
              <th class="px-4 py-2 font-medium">
                Agreement
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tenant in filteredTenants" :key="tenant.id" class="cursor-pointer border-b border-line last:border-0 hover:bg-paper" @click="viewTenant(tenant)">
              <td class="px-4 py-2 font-medium">
                {{ tenant.firstName }} {{ tenant.lastName }}
              </td>
              <td class="px-4 py-2 text-ink-muted">
                {{ roomName(tenant.roomId) }}
              </td>
              <td class="px-4 py-2 text-ink-muted">
                {{ tenant.institution }}
              </td>
              <td class="tabular px-4 py-2">
                {{ formatMWK(tenant.monthlyAmount) }}
              </td>
              <td class="px-4 py-2">
                <StatusPill :tone="tenant.agreementStatus === 'SIGNED' ? 'success' : tenant.agreementStatus === 'PENDING' ? 'pending' : 'danger'" :label="tenant.agreementStatus.charAt(0) + tenant.agreementStatus.slice(1).toLowerCase()" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <RentPayments v-else-if="tab === 'payments'" />
    <RoomConfiguration v-else-if="tab === 'configuration' && canManage" />

  </div>
  <ReceivePaymentModal v-if="paymentTenant!==null" :tenant-id="paymentTenant" @close="paymentTenant=null" @saved="run(()=>hostel.hydrate())" />
  <FormModal v-if="selectedRoom || selectedTenant || editing" :title="editing ? (selectedTenant ? 'Edit tenant' : 'Add tenant') : selectedRoom ? (selectedRoom.label || selectedRoom.identifier) : 'Tenant profile'" :busy="busy" @close="closeModal">
      <div v-if="selectedRoom && !editing" class="space-y-3 p-5">
        <p class="text-sm text-ink-muted">
          {{ selectedRoom.housingUnit }} · {{ selectedRoom.occupants }}/{{ selectedRoom.capacity }} occupants
        </p>
        <p v-if="roomOccupants.length === 0" class="rounded bg-paper p-4 text-sm text-ink-muted">
          This room is vacant.
        </p>
        <button v-for="tenant in roomOccupants" :key="tenant.id" type="button" class="flex w-full items-center justify-between rounded border border-line p-4 text-left hover:border-primary" @click="viewTenant(tenant)">
          <span>
            <span class="block font-medium">
              {{ tenant.firstName }} {{ tenant.lastName }}
            </span>
            <span class="text-sm text-ink-muted">
              {{ tenant.institution || 'No institution recorded' }}
            </span>
          </span>
          <span class="text-sm text-primary">
            View profile →
          </span>
        </button>
      </div>
      <div v-else-if="selectedTenant && !editing" class="p-5">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <p class="text-xl font-semibold">
              {{ selectedTenant.firstName }} {{ selectedTenant.middleName }} {{ selectedTenant.lastName }}
            </p>
            <p class="text-sm text-ink-muted">
              {{ roomName(selectedTenant.roomId) }} · {{ selectedTenant.institution || 'Institution not recorded' }}
            </p>
          </div>
          <div class="flex flex-wrap justify-end gap-2">
            <button type="button" class="rounded border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary-light" @click="downloadAgreement(selectedTenant, hostel.rooms)">
              Download agreement
            </button>
            <button v-if="canManage" type="button" class="rounded bg-primary px-3 py-2 text-sm font-medium text-white" @click="editTenant">
              Edit tenant / move room
            </button>
            <button v-if="canManage" type="button" class="btn" :disabled="busy" @click="paymentTenant=selectedTenant.id; closeModal()">Receive payment</button>
            <button v-if="canManage" type="button" class="btn-secondary" :disabled="busy" @click="checkout">
              Check out
            </button>
          </div>
        </div>
        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <h3 class="mb-2 font-medium">
              Personal information
            </h3>
            <dl class="space-y-1 text-sm">
              <div>
                <dt>
                  Phone
                </dt>
                <dd class="text-ink-muted">
                  {{ selectedTenant.phone }}
                </dd>
              </div>
              <div>
                <dt>
                  Email
                </dt>
                <dd class="text-ink-muted">
                  {{ selectedTenant.email || '—' }}
                </dd>
              </div>
              <div>
                <dt>
                  Gender / date of birth
                </dt>
                <dd class="text-ink-muted">
                  {{ selectedTenant.gender || '—' }} · {{ selectedTenant.dateOfBirth || '—' }}
                </dd>
              </div>
              <div>
                <dt>
                  Home address
                </dt>
                <dd class="text-ink-muted">
                  {{ selectedTenant.homeDistrict || '—' }} {{ selectedTenant.homeAddress || '' }}
                </dd>
              </div>
              <div>
                <dt>
                  Emergency contact
                </dt>
                <dd class="text-ink-muted">
                  {{ selectedTenant.emergencyContactName || '—' }} · {{ selectedTenant.emergencyContactPhone || '—' }}
                </dd>
              </div>
            </dl>
          </div>
          <div>
            <h3 class="mb-2 font-medium">
              Academic & accommodation
            </h3>
            <dl class="space-y-1 text-sm">
              <div>
                <dt>
                  Programme
                </dt>
                <dd class="text-ink-muted">
                  {{ selectedTenant.programme || '—' }}
                </dd>
              </div>
              <div>
                <dt>
                  Faculty / department
                </dt>
                <dd class="text-ink-muted">
                  {{ selectedTenant.faculty || '—' }} · {{ selectedTenant.department || '—' }}
                </dd>
              </div>
              <div>
                <dt>
                  Year / registration
                </dt>
                <dd class="text-ink-muted">
                  {{ selectedTenant.yearOfStudy || '—' }} · {{ selectedTenant.regNumber || '—' }}
                </dd>
              </div>
              <div>
                <dt>
                  Monthly amount / deposit
                </dt>
                <dd class="text-ink-muted">
                  {{ formatMWK(selectedTenant.monthlyAmount) }} · {{ formatMWK(selectedTenant.deposit || 0) }}
                </dd>
              </div>
              <div>
                <dt>
                  Move-in / agreement
                </dt>
                <dd class="text-ink-muted">
                  {{ selectedTenant.moveInDate }} · {{ selectedTenant.agreementStatus }}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
      <form v-else-if="editing" class="space-y-6 p-5" @submit.prevent="saveTenant">
        <p v-if="savingError" class="rounded bg-danger-light p-3 text-sm text-danger">
          {{ savingError }}
        </p>
        <fieldset :disabled="busy">
          <legend class="mb-3 font-semibold">
            Personal information
          </legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <input v-model="form.firstName" required placeholder="First name *" class="rounded border border-line px-3 py-2 text-sm" />
            <input v-model="form.middleName" placeholder="Middle name" class="rounded border border-line px-3 py-2 text-sm" />
            <input v-model="form.lastName" required placeholder="Last name *" class="rounded border border-line px-3 py-2 text-sm" />
            <select v-model="form.gender" class="rounded border border-line px-3 py-2 text-sm">
              <option value="">
                Gender
              </option>
              <option>
                Female
              </option>
              <option>
                Male
              </option>
              <option>
                Other
              </option>
            </select>
            <input v-model="form.dateOfBirth" type="date" class="rounded border border-line px-3 py-2 text-sm" />
            <input v-model="form.phone" required placeholder="Phone number *" class="rounded border border-line px-3 py-2 text-sm" />
            <input v-model="form.altPhone" placeholder="Alternative phone" class="rounded border border-line px-3 py-2 text-sm" />
            <input v-model="form.email" type="email" placeholder="Email" class="rounded border border-line px-3 py-2 text-sm" />
            <input v-model="form.homeDistrict" placeholder="Home district" class="rounded border border-line px-3 py-2 text-sm" />
            <input v-model="form.homeAddress" placeholder="Home address" class="rounded border border-line px-3 py-2 text-sm" />
            <input v-model="form.emergencyContactName" placeholder="Emergency contact name" class="rounded border border-line px-3 py-2 text-sm" />
            <input v-model="form.emergencyContactPhone" placeholder="Emergency contact phone" class="rounded border border-line px-3 py-2 text-sm" />
            <input v-model="form.emergencyContactRelationship" placeholder="Emergency contact relationship" class="rounded border border-line px-3 py-2 text-sm sm:col-span-2" />
          </div>
        </fieldset>
        <fieldset :disabled="busy">
          <legend class="mb-3 font-semibold">
            Academic information
          </legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <input v-model="form.institution" placeholder="Institution" class="rounded border border-line px-3 py-2 text-sm" />
            <input v-model="form.programme" placeholder="Programme" class="rounded border border-line px-3 py-2 text-sm" />
            <input v-model="form.faculty" placeholder="Faculty / school" class="rounded border border-line px-3 py-2 text-sm" />
            <input v-model="form.department" placeholder="Department" class="rounded border border-line px-3 py-2 text-sm" />
            <input v-model.number="form.yearOfStudy" min="1" type="number" placeholder="Year of study" class="rounded border border-line px-3 py-2 text-sm" />
            <input v-model="form.regNumber" placeholder="Student / registration number" class="rounded border border-line px-3 py-2 text-sm" />
            <input v-model="form.academicYear" placeholder="Academic year" class="rounded border border-line px-3 py-2 text-sm" />
          </div>
        </fieldset>
        <fieldset :disabled="busy">
          <legend class="mb-3 font-semibold">
            Accommodation
          </legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <select v-model="form.roomId" required class="rounded border border-line px-3 py-2 text-sm">
              <option disabled value="">
                Select room *
              </option>
              <option v-for="room in availableRooms" :key="room.id" :value="room.id">
                {{ room.label ?? room.identifier }} — {{ room.occupants }}/{{ room.capacity }}
              </option>
            </select>
            <input v-model="form.moveInDate" :disabled="!!selectedTenant" :max="today()" required type="date" class="rounded border border-line px-3 py-2 text-sm" />
            <p class="input">
              Monthly rent: {{ formatMWK(form.monthlyAmount) }} · set in Configuration
            </p>
            <input v-model.number="form.deposit" min="0" type="number" placeholder="Deposit" class="rounded border border-line px-3 py-2 text-sm" />
            <select v-model="form.agreementStatus" class="rounded border border-line px-3 py-2 text-sm">
              <option value="PENDING">
                Agreement pending
              </option>
              <option value="SIGNED">
                Agreement signed
              </option>
              <option value="EXPIRED">
                Agreement expired
              </option>
            </select>
          </div>
        </fieldset>
        <div class="flex justify-end gap-3">
          <button type="button" class="rounded border border-line px-4 py-2 text-sm" :disabled="busy" @click="selectedTenant ? (editing = false) : closeModal()">
            Cancel
          </button>
          <button type="submit" class="rounded bg-primary px-4 py-2 text-sm font-medium text-white" :disabled="busy">
            Save tenant
          </button>
        </div>
      </form>
  </FormModal>
</template>
