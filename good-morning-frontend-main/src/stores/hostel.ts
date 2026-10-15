import { defineStore } from 'pinia';
import { api, fromApi } from '@/lib/api';
import { useAuthStore } from './auth';
import type { Room, Tenant, Charge, RoomStatus, HousingUnit } from '@/types';
import { today } from '@/types';
export const useHostelStore = defineStore('hostel', {
    state: () => ({ units: [] as HousingUnit[], rooms: [] as Room[], tenants: [] as Tenant[], charges: [] as Charge[], defaultPrice: 0, refreshError: '', month: today().slice(0, 7) }),
    getters: {
        roomStatus: () => (room: Room): RoomStatus => room.occupants === 0 ? 'VACANT' : room.occupants < room.capacity ? 'PARTIAL' : 'OCCUPIED',
        tenantByRoom: state => (id: string) => state.tenants.filter(t => t.roomId === id && !t.checkoutDate),
    },
    actions: {
        async hydrate() {
            this.refreshError = '';
            const data = fromApi<{
                units: HousingUnit[];
                rooms: Room[];
                tenants: Tenant[];
                charges: Charge[];
                defaultPrice: number;
            }>(await api.get(`/hostel?month=${this.month}`, useAuthStore().token));
            this.units = data.units;
            this.rooms = data.rooms;
            this.tenants = data.tenants;
            this.charges = data.charges;
            this.defaultPrice = data.defaultPrice;
        },
        async mutate(path: string, body: unknown) {
            const result = await api.post<{
                id?: string;
            }>(`/hostel${path}`, body, useAuthStore().token);
            try {
                await this.hydrate();
            }
            catch {
                this.refreshError = 'Saved successfully, but refreshing failed. Refresh before making another change.';
            }
            return result;
        },
        async addTenant(tenant: Omit<Tenant, 'id'>) { return this.mutate('/tenants', tenant); },
        async updateTenant(tenant: Tenant) { return this.mutate('/tenants', tenant); },
        async deleteRoom(id: string) { await api.delete(`/hostel/rooms/${id}`, useAuthStore().token); await this.hydrate(); },
    },
});
