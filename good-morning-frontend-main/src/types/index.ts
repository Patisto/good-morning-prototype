export type Role =
  | 'OWNER'
  | 'ADMINISTRATOR'
  | 'HOSTEL_MANAGER'
  | 'RESTAURANT_MANAGER'
  | 'RESTAURANT_CASHIER'
  | 'GROCERY_MANAGER'
  | 'GROCERY_CASHIER'
  | 'ACCOUNTANT'
  | 'SYSTEM_ADMINISTRATOR'

export type PaymentMethod = 'CASH' | 'AIRTEL_MONEY' | 'TNM_MPAMBA' | 'BANK' | 'OTHER'

export type SyncStatus = 'SYNCED' | 'PENDING' | 'FAILED'

export type RoomType = 'SINGLE' | 'DOUBLE'
export type RoomStatus = 'OCCUPIED' | 'PARTIAL' | 'VACANT'

export interface Room {
  id: string
  housingUnit: string
  identifier: string
  label?: string
  type: RoomType
  capacity: number
  occupants: number
}

export interface Tenant {
  id: string
  firstName: string
  middleName?: string
  lastName: string
  gender?: string
  dateOfBirth?: string
  phone: string
  altPhone?: string
  email?: string
  homeDistrict?: string
  homeAddress?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelationship?: string
  institution?: string
  programme?: string
  faculty?: string
  department?: string
  yearOfStudy?: number
  regNumber?: string
  academicYear?: string
  roomId: string
  monthlyAmount: number
  deposit?: number
  moveInDate: string
  agreementStatus: 'PENDING' | 'SIGNED' | 'EXPIRED'
}

export interface HostelPayment {
  id: string
  tenantId: string
  periodLabel: string // "September 2026"
  expectedAmount: number
  amountPaid: number
  paymentMethod?: PaymentMethod
  paymentDate?: string
}

export interface FoodItem {
  id: string
  name: string
  unit: 'kg' | 'g' | 'litre' | 'piece'
  cost: number
}

export interface DailyFoodRecord {
  id: string
  date: string
  foodItemId: string
  quantity: number
  cost: number
}

export interface MenuItem {
  id: string
  name: string
  category: string
  sellingPrice: number
  available: boolean
}

export interface SaleLineItem {
  itemId: string
  name: string
  quantity: number
  unitPrice: number
}

export interface Sale {
  id: string
  date: string
  time: string
  items: SaleLineItem[]
  total: number
  paymentMethod: PaymentMethod
  status: 'COMPLETED' | 'CANCELLED'
  cashier: string
  syncStatus: SyncStatus
}

export interface GroceryProduct {
  id: string
  name: string
  category: string
  sellingPrice: number
  buyingPrice: number
  currentStock: number
  lowStockLevel: number
  unit: string
}

export interface Expense {
  id: string
  description: string
  amount: number
  business: 'HOSTEL' | 'RESTAURANT' | 'GROCERY' | 'GENERAL'
  date: string
  paymentMethod: PaymentMethod
  notes?: string
}

export function formatMWK(amount: number): string {
  return 'MWK ' + Math.round(amount).toLocaleString('en-US')
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}
