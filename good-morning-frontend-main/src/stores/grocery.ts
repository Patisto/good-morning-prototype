import { defineStore } from 'pinia'
import { groceryProducts, grocerySales } from '@/data/mock'
import type { GroceryProduct, Sale, SaleLineItem, PaymentMethod } from '@/types'
import { uid } from '@/types'
import { useSyncStore } from './sync'
import { putLocal, queueChange, seedLocal } from '@/lib/local-db'

export const useGroceryStore = defineStore('grocery', {
  state: () => ({
    products: [] as GroceryProduct[],
    sales: [] as Sale[],
    hydrated: false,
  }),
  getters: {
    todaysSales: (state) => state.sales.filter((s) => s.date === '2026-09-10' && s.status === 'COMPLETED'),
    todaysRevenue(): number {
      return this.todaysSales.reduce((sum: number, s: Sale) => sum + s.total, 0)
    },
    lowStock: (state) => state.products.filter((p) => p.currentStock <= p.lowStockLevel),
  },
  actions: {
    async hydrate() {
      const [storedProducts, storedSales] = await Promise.all([
        seedLocal('groceryProducts', groceryProducts as GroceryProduct[]),
        seedLocal('grocerySales', grocerySales as Sale[]),
      ])
      this.products = storedProducts
      this.sales = storedSales
      this.hydrated = true
    },
    addStock(productId: string, quantity: number) {
      const product = this.products.find((p) => p.id === productId)
      if (!product) return
      product.currentStock += quantity
      void putLocal('groceryProducts', product)
      void queueChange('groceryProducts', product.id).then(() => useSyncStore().refreshPendingCount())
    },
    completeSale(items: SaleLineItem[], paymentMethod: PaymentMethod, cashier: string) {
      const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
      const sale: Sale = {
        id: uid('GS'),
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
      for (const line of items) {
        const product = this.products.find((p) => p.id === line.itemId)
        if (product) product.currentStock = Math.max(0, product.currentStock - line.quantity)
      }
      void Promise.all([
        putLocal('grocerySales', sale),
        ...items.map((line) => {
          const product = this.products.find((p) => p.id === line.itemId)
          return product ? putLocal('groceryProducts', product) : Promise.resolve()
        }),
      ])
      void queueChange('grocerySales', sale.id, 'CREATE').then(() => useSyncStore().refreshPendingCount())
      return sale
    },
  },
})
