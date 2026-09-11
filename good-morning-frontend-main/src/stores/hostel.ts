import { defineStore } from 'pinia'
import { rooms, tenants, hostelPayments } from '@/data/mock'
import type { Room, Tenant, HostelPayment, RoomStatus } from '@/types'
import { useSyncStore } from './sync'
import { putLocal, queueChange, seedLocal } from '@/lib/local-db'

export const useHostelStore = defineStore('hostel', {
  state: () => ({
    rooms: [] as Room[],
    tenants: [] as Tenant[],
    payments: [] as HostelPayment[],
    hydrated: false,
  }),
  getters: {
    roomStatus: () => (room: Room): RoomStatus => {
      if (room.occupants === 0) return 'VACANT'
      if (room.occupants < room.capacity) return 'PARTIAL'
      return 'OCCUPIED'
    },
    tenantByRoom: (state) => (roomId: string) => state.tenants.filter((t) => t.roomId === roomId),
    paymentFor: (state) => (tenantId: string) => state.payments.find((p) => p.tenantId === tenantId),
    occupiedCount: (state) => state.rooms.filter((r) => r.occupants >= r.capacity).length,
    vacantCount: (state) => state.rooms.filter((r) => r.occupants === 0).length,
    outstandingBalance: (state) =>
      state.payments.reduce((sum, p) => sum + Math.max(0, p.expectedAmount - p.amountPaid), 0),
    paymentsReceivedThisMonth: (state) => state.payments.reduce((sum, p) => sum + p.amountPaid, 0),
  },
  actions: {
    async hydrate() {
      const [storedRooms, storedTenants, storedPayments] = await Promise.all([
        seedLocal('rooms', rooms as Room[]),
        seedLocal('tenants', tenants as Tenant[]),
        seedLocal('payments', hostelPayments as HostelPayment[]),
      ])
      this.rooms = storedRooms
      this.tenants = storedTenants
      this.payments = storedPayments
      this.hydrated = true
    },
    recordPayment(tenantId: string, amount: number, method: HostelPayment['paymentMethod']) {
      const payment = this.payments.find((p) => p.tenantId === tenantId)
      if (!payment) return
      // optimistic local update — this is what the SQLite write looks like in the real app
      payment.amountPaid = Math.min(payment.expectedAmount, payment.amountPaid + amount)
      payment.paymentMethod = method
      payment.paymentDate = new Date().toISOString().slice(0, 10)
      void putLocal('payments', payment)
      void queueChange('payments', payment.id).then(() => useSyncStore().refreshPendingCount())
    },
    renameRoom(roomId: string, label: string) {
      const room = this.rooms.find((item) => item.id === roomId)
      if (!room) return
      room.label = label.trim() || undefined
      void putLocal('rooms', room)
      void queueChange('rooms', room.id).then(() => useSyncStore().refreshPendingCount())
    },
  },
})
