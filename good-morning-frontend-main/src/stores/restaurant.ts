import { defineStore } from 'pinia'
import { foodItems, dailyFoodRecords, menuItems, restaurantSales } from '@/data/mock'
import type { FoodItem, DailyFoodRecord, MenuItem, Sale, SaleLineItem, PaymentMethod } from '@/types'
import { uid } from '@/types'
import { useSyncStore } from './sync'
import { putLocal, queueChange, seedLocal } from '@/lib/local-db'

export const useRestaurantStore = defineStore('restaurant', {
  state: () => ({
    foodItems: [] as FoodItem[],
    dailyFoodRecords: [] as DailyFoodRecord[],
    menuItems: [] as MenuItem[],
    sales: [] as Sale[],
    hydrated: false,
  }),
  getters: {
    todaysSales: (state) => state.sales.filter((s) => s.date === '2026-09-10' && s.status === 'COMPLETED'),
    todaysRevenue(): number {
      return this.todaysSales.reduce((sum: number, s: Sale) => sum + s.total, 0)
    },
    todaysFoodCost: (state) =>
      state.dailyFoodRecords.filter((r) => r.date === '2026-09-10').reduce((sum, r) => sum + r.cost, 0),
    bestSeller(): string {
      const counts = new Map<string, number>()
      for (const sale of this.todaysSales) {
        for (const item of sale.items) {
          counts.set(item.name, (counts.get(item.name) ?? 0) + item.quantity)
        }
      }
      let top = '—'
      let max = 0
      for (const [name, qty] of counts) {
        if (qty > max) {
          max = qty
          top = name
        }
      }
      return top
    },
  },
  actions: {
    async hydrate() {
      const [storedFoodItems, storedFoodRecords, storedMenuItems, storedSales] = await Promise.all([
        seedLocal('foodItems', foodItems as FoodItem[]),
        seedLocal('foodRecords', dailyFoodRecords as DailyFoodRecord[]),
        seedLocal('menuItems', menuItems as MenuItem[]),
        seedLocal('restaurantSales', restaurantSales as Sale[]),
      ])
      this.foodItems = storedFoodItems
      this.dailyFoodRecords = storedFoodRecords
      this.menuItems = storedMenuItems
      this.sales = storedSales
      this.hydrated = true
    },
    completeSale(items: SaleLineItem[], paymentMethod: PaymentMethod, cashier: string) {
      if (items.length === 0) return
      const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
      const sale: Sale = {
        id: uid('RS'),
        date: '2026-09-10',
        time: new Date().toTimeString().slice(0, 5),
        items,
        total,
        paymentMethod,
        status: 'COMPLETED',
        cashier,
        syncStatus: 'PENDING',
      }
      this.sales.unshift(sale)
      void putLocal('restaurantSales', sale)
      void queueChange('restaurantSales', sale.id, 'CREATE').then(() => useSyncStore().refreshPendingCount())
      return sale
    },
    addFoodRecord(foodItemId: string, quantity: number, cost: number) {
      this.dailyFoodRecords.unshift({
        id: uid('D'),
        date: '2026-09-10',
        foodItemId,
        quantity,
        cost,
      })
      const record = this.dailyFoodRecords[0]
      void putLocal('foodRecords', record)
      void queueChange('foodRecords', record.id, 'CREATE').then(() => useSyncStore().refreshPendingCount())
    },
    addMenuItem(item: Omit<MenuItem, 'id'>) {
      const menuItem: MenuItem = { ...item, id: uid('M') }
      this.menuItems.push(menuItem)
      void putLocal('menuItems', menuItem)
      void queueChange('menuItems', menuItem.id, 'CREATE').then(() => useSyncStore().refreshPendingCount())
    },
  },
})
