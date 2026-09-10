import { defineStore } from 'pinia'
import { listPendingChanges } from '@/lib/local-db'

export type ConnectionState = 'ONLINE' | 'OFFLINE'

export const useSyncStore = defineStore('sync', {
  state: () => ({
    connection: (navigator.onLine ? 'ONLINE' : 'OFFLINE') as ConnectionState,
    pendingCount: 0,
    monitoring: false,
  }),
  actions: {
    startMonitoring() {
      if (this.monitoring) return
      this.monitoring = true
      window.addEventListener('online', () => {
        this.connection = 'ONLINE'
        void this.flushIfOnline()
      })
      window.addEventListener('offline', () => { this.connection = 'OFFLINE' })
    },
    async refreshPendingCount() {
      this.pendingCount = (await listPendingChanges()).length
    },
    async flushIfOnline() {
      // The local queue remains durable until the upcoming sync API confirms
      // each mutation. Never discard a financial operation merely because the
      // browser has regained a network connection.
      await this.refreshPendingCount()
    },
  },
})
