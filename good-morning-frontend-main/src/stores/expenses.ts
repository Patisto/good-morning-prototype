import { defineStore } from 'pinia'
import { expenses } from '@/data/mock'
import type { Expense } from '@/types'
import { uid } from '@/types'
import { useSyncStore } from './sync'
import { putLocal, queueChange, seedLocal } from '@/lib/local-db'

export const useExpensesStore = defineStore('expenses', {
  state: () => ({
    items: [] as Expense[],
    hydrated: false,
  }),
  getters: {
    total: (state) => state.items.reduce((sum, e) => sum + e.amount, 0),
    byBusiness: (state) => (business: Expense['business']) =>
      state.items.filter((e) => e.business === business).reduce((sum, e) => sum + e.amount, 0),
  },
  actions: {
    async hydrate() {
      this.items = await seedLocal('expenses', expenses as Expense[])
      this.hydrated = true
    },
    add(expense: Omit<Expense, 'id'>) {
      const item = { ...expense, id: uid('E') }
      this.items.unshift(item)
      void putLocal('expenses', item)
      void queueChange('expenses', item.id, 'CREATE').then(() => useSyncStore().refreshPendingCount())
    },
  },
})
