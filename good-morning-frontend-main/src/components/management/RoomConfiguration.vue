<script setup lang="ts">
import { computed, ref } from 'vue';
import { useHostelStore } from '@/stores/hostel';
import { useTask } from '@/composables/useTask';
import FormModal from '@/components/ui/FormModal.vue';
import { formatMWK, today, type Room, type HousingUnit } from '@/types';
const hostel = useHostelStore();
const { busy, error, run } = useTask();
const selected = ref<string[]>([]), unitFilter = ref('');
const visibleRooms = computed(() => hostel.rooms.filter(room => !unitFilter.value || room.housingUnitId === unitFilter.value));
const unitForm = ref<{
    id: string;
    name: string;
} | null>(null);
type RoomDraft = {
    id: string;
    housingUnitId: string;
    identifier: string;
    capacity: number;
    monthlyPrice: number;
    effectiveMonth: string;
};
const roomForm = ref<RoomDraft | null>(null);
const priceDialog = ref<'default' | 'batch' | null>(null);
const price = ref(0), effectiveMonth = ref(today().slice(0, 7));
function openUnit(unit?: HousingUnit) { error.value = ''; unitForm.value = unit ? { ...unit } : { id: '', name: '' }; }
function openRoom(room?: Room) {
    error.value = '';
    roomForm.value = room
        ? { id: room.id, housingUnitId: room.housingUnitId, identifier: room.label || room.identifier, capacity: room.capacity, monthlyPrice: room.monthlyPrice ?? 0, effectiveMonth: today().slice(0, 7) }
        : { id: '', housingUnitId: unitFilter.value, identifier: '', capacity: 1, monthlyPrice: hostel.defaultPrice, effectiveMonth: today().slice(0, 7) };
}
function openPrice(kind: 'default' | 'batch') { error.value = ''; priceDialog.value = kind; price.value = kind === 'default' ? hostel.defaultPrice : 0; effectiveMonth.value = today().slice(0, 7); }
async function saveUnit() { await run(async () => { await hostel.mutate('/units', unitForm.value); unitForm.value = null; }); }
async function saveRoom() { await run(async () => { await hostel.mutate('/rooms', roomForm.value); roomForm.value = null; }); }
async function savePrice() {
    await run(async () => {
        if (priceDialog.value === 'default')
            await hostel.mutate('/settings', { defaultPrice: price.value });
        else
            await hostel.mutate('/rooms/batch-price', { roomIds: selected.value, monthlyPrice: price.value, effectiveMonth: effectiveMonth.value });
        priceDialog.value = null;
    });
}
async function remove(room: Room) {
    if (confirm(`Delete ${room.label || room.identifier}? Historical rent records will be retained.`)) {
        await run(async () => { await hostel.deleteRoom(room.id); selected.value = selected.value.filter(id => id !== room.id); });
    }
}
function toggleVisible() {
    const ids = visibleRooms.value.map(room => room.id);
    selected.value = ids.every(id => selected.value.includes(id)) ? selected.value.filter(id => !ids.includes(id)) : [...new Set([...selected.value, ...ids])];
}
</script>
<template>
  <div class="space-y-5">
    <p v-if="error && !unitForm && !roomForm && !priceDialog" class="error" role="alert">
      {{ error }}
    </p>
    <section class="panel space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-semibold">
          Housing units
        </h2>
        <button class="btn" :disabled="busy" @click="openUnit()">
          Add unit
        </button>
      </div>
      <p class="text-sm text-ink-muted">
        Create units here, then select one when adding a room. Renaming a unit updates all of its rooms.
      </p>
      <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="unit in hostel.units" :key="unit.id" class="flex items-center justify-between gap-2 rounded border border-line p-3">
          <span>
            {{ unit.name }}
          </span>
          <button class="btn-secondary" :disabled="busy" :aria-label="`Edit ${unit.name}`" @click="openUnit(unit)">
            Edit
          </button>
        </li>
      </ul>
      <p v-if="!hostel.units.length" class="text-sm text-ink-muted">
        Add a housing unit before creating rooms.
      </p>
    </section>
    <section class="panel flex flex-wrap items-center justify-between gap-3">
      <p>
        Default monthly rent:
        <strong>
          {{ formatMWK(hostel.defaultPrice) }}
        </strong>
        per tenant/bed
      </p>
      <button class="btn-secondary" :disabled="busy" @click="openPrice('default')">
        Edit default rent
      </button>
    </section>
    <div class="flex flex-wrap items-end justify-between gap-3">
      <label class="field">
        Housing unit
        <select v-model="unitFilter" class="input">
          <option value="">
            All units
          </option>
          <option v-for="unit in hostel.units" :key="unit.id" :value="unit.id">
            {{ unit.name }}
          </option>
        </select>
      </label>
      <div class="flex flex-wrap gap-2">
        <button class="btn-secondary" :disabled="busy || !selected.length" @click="openPrice('batch')">
          Set rent · {{ selected.length }} selected
        </button>
        <button class="btn" :disabled="busy || !hostel.units.length" @click="openRoom()">
          Add room
        </button>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>
              <button class="underline" @click="toggleVisible">
                Select / clear visible
              </button>
            </th>
            <th>
              Room
            </th>
            <th>
              Unit
            </th>
            <th>
              Capacity
            </th>
            <th>
              Rent · {{ hostel.month }}
            </th>
            <th>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="room in visibleRooms" :key="room.id">
            <td>
              <input v-model="selected" type="checkbox" :value="room.id" :aria-label="`Select ${room.identifier}`" />
            </td>
            <td>
              {{ room.label || room.identifier }}
            </td>
            <td>
              {{ room.housingUnit }}
            </td>
            <td>
              {{ room.occupants }} / {{ room.capacity }}
            </td>
            <td>
              {{ formatMWK(room.monthlyPrice ?? 0) }}
            </td>
            <td class="space-x-2">
              <button class="btn-secondary" :disabled="busy" @click="openRoom(room)">
                Edit
              </button>
              <button class="btn-secondary" :disabled="busy || room.occupants>0" @click="remove(room)">
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!visibleRooms.length" class="text-sm text-ink-muted">
      No rooms in this selection.
    </p>
    <FormModal v-if="unitForm" :title="unitForm.id ? 'Edit housing unit' : 'Add housing unit'" :busy="busy" @close="unitForm=null">
      <form class="space-y-4" @submit.prevent="saveUnit">
        <p v-if="error" class="error" role="alert">
          {{ error }}
        </p>
        <label class="field">
          Unit name
          <input v-model="unitForm.name" class="input" maxlength="500" required :disabled="busy" />
        </label>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" :disabled="busy" @click="unitForm=null">
            Cancel
          </button>
          <button class="btn" :disabled="busy">
            {{ unitForm.id ? 'Save changes' : 'Add unit' }}
          </button>
        </div>
      </form>
    </FormModal>
    <FormModal v-if="roomForm" :title="roomForm.id ? 'Edit room' : 'Add room'" :busy="busy" @close="roomForm=null">
      <form class="space-y-4" @submit.prevent="saveRoom">
        <p v-if="error" class="error" role="alert">
          {{ error }}
        </p>
        <fieldset :disabled="busy" class="grid gap-3 sm:grid-cols-2">
          <label class="field">
            Housing unit
            <select v-model="roomForm.housingUnitId" class="input" required>
              <option disabled value="">
                Select unit
              </option>
              <option v-for="unit in hostel.units" :key="unit.id" :value="unit.id">
                {{ unit.name }}
              </option>
            </select>
          </label>
          <label class="field">
            Room name
            <input v-model="roomForm.identifier" class="input" required />
          </label>
          <label class="field">
            Capacity
            <input v-model.number="roomForm.capacity" class="input" type="number" min="1" step="1" required />
          </label>
          <label class="field">
            Monthly rent per tenant (MWK)
            <input v-model.number="roomForm.monthlyPrice" class="input" type="number" min="0" step="0.01" required />
          </label>
          <label class="field">
            Price effective from
            <input v-model="roomForm.effectiveMonth" class="input" type="month" :min="today().slice(0,7)" required />
          </label>
        </fieldset>
        <p class="text-sm text-ink-muted">
          Existing monthly charges retain their original rent amount.
        </p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" :disabled="busy" @click="roomForm=null">
            Cancel
          </button>
          <button class="btn" :disabled="busy">
            {{ roomForm.id ? 'Save changes' : 'Add room' }}
          </button>
        </div>
      </form>
    </FormModal>
    <FormModal v-if="priceDialog" :title="priceDialog==='default' ? 'Edit default rent' : 'Set rent for selected rooms'" :busy="busy" @close="priceDialog=null">
      <form class="space-y-4" @submit.prevent="savePrice">
        <p v-if="error" class="error" role="alert">
          {{ error }}
        </p>
        <p class="text-sm text-ink-muted">
          {{ priceDialog==='default' ? 'The default is used when adding a new room.' : `This applies to ${selected.length} selected rooms. Existing charges will not change.` }}
        </p>
        <label class="field">
          Monthly rent (MWK)
          <input v-model.number="price" class="input" type="number" min="0" step="0.01" :disabled="busy" required />
        </label>
        <label v-if="priceDialog==='batch'" class="field">
          Effective month
          <input v-model="effectiveMonth" class="input" type="month" :min="today().slice(0,7)" :disabled="busy" required />
        </label>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" :disabled="busy" @click="priceDialog=null">
            Cancel
          </button>
          <button class="btn" :disabled="busy">
            Save rent
          </button>
        </div>
      </form>
    </FormModal>
  </div>
</template>
