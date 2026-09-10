import type {
  Room,
  Tenant,
  HostelPayment,
  FoodItem,
  DailyFoodRecord,
  MenuItem,
  GroceryProduct,
  Expense,
  Sale,
} from '@/types'

// ---------------- Hostel: 6 housing units, 49 rooms ----------------

function numbered(unit: string, prefix: string, count: number, type: 'SINGLE' | 'DOUBLE' = 'SINGLE'): Room[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${String(i + 1).padStart(2, '0')}`,
    housingUnit: unit,
    identifier: `${prefix}-${String(i + 1).padStart(2, '0')}`,
    type,
    capacity: type === 'DOUBLE' ? 2 : 1,
    occupants: 0,
  }))
}

export const rooms: Room[] = [
  ...numbered('Area 90', 'AREA90', 8),
  { id: 'AREA90-YEKHAI', housingUnit: 'Area 90', identifier: 'AREA90-YEKHAI', label: 'Yekhai', type: 'SINGLE', capacity: 1, occupants: 0 },
  { id: 'AREA90-YEKHAI-NEBA', housingUnit: 'Area 90', identifier: 'AREA90-YEKHAI-NEBA', label: 'Yekhai Neba', type: 'SINGLE', capacity: 1, occupants: 0 },
  ...numbered('Terrazo', 'TERRAZO', 8),
  ...numbered('Area 50', 'AREA50', 9),
  { id: 'AREA50-DOUBLE', housingUnit: 'Area 50', identifier: 'AREA50-DOUBLE', type: 'DOUBLE', capacity: 2, occupants: 0 },
  ...numbered('Chibus', 'CHIBUS', 9),
  { id: 'CHIBUS-DOUBLE', housingUnit: 'Chibus', identifier: 'CHIBUS-DOUBLE', type: 'DOUBLE', capacity: 2, occupants: 0 },
  ...numbered('Shop', 'SHOP', 4),
  ...numbered('Outer Rooms', 'OUTER', 5),
  { id: 'OUTER-WATHU', housingUnit: 'Outer Rooms', identifier: 'OUTER-WATHU', label: 'Wathu', type: 'SINGLE', capacity: 1, occupants: 0 },
  { id: 'OUTER-MARY', housingUnit: 'Outer Rooms', identifier: 'OUTER-MARY', label: 'Mary', type: 'SINGLE', capacity: 1, occupants: 0 },
]

export const tenants: Tenant[] = [
  { id: 'T-001', firstName: 'Chisomo', lastName: 'Banda', phone: '0991 234 001', institution: 'LUANAR', programme: 'Agribusiness', roomId: 'AREA90-01', monthlyAmount: 100000, moveInDate: '2026-02-10', agreementStatus: 'SIGNED' },
  { id: 'T-002', firstName: 'Takondwa', lastName: 'Phiri', phone: '0888 234 002', institution: 'MUBAS', programme: 'Accountancy', roomId: 'AREA90-02', monthlyAmount: 100000, moveInDate: '2026-02-11', agreementStatus: 'SIGNED' },
  { id: 'T-003', firstName: 'Grace', lastName: 'Mvula', phone: '0996 234 003', institution: 'MUBAS', programme: 'Marketing', roomId: 'TERRAZO-01', monthlyAmount: 90000, moveInDate: '2026-02-14', agreementStatus: 'SIGNED' },
  { id: 'T-004', firstName: 'Yamikani', lastName: 'Chirwa', phone: '0993 234 004', institution: 'LUANAR', programme: 'Food Science', roomId: 'AREA50-01', monthlyAmount: 85000, moveInDate: '2026-02-15', agreementStatus: 'PENDING' },
  { id: 'T-005', firstName: 'Blessings', lastName: 'Nyirenda', phone: '0889 234 005', institution: 'Nkhoma University', programme: 'Nursing', roomId: 'CHIBUS-01', monthlyAmount: 85000, moveInDate: '2026-02-18', agreementStatus: 'SIGNED' },
  { id: 'T-006', firstName: 'Patrick', lastName: 'Kalua', phone: '0995 234 006', institution: 'MUST', programme: 'Computer Science', roomId: 'AREA50-DOUBLE', monthlyAmount: 70000, moveInDate: '2026-03-01', agreementStatus: 'SIGNED' },
]

// reflect tenants in room occupancy
tenants.forEach((t) => {
  const room = rooms.find((r) => r.id === t.roomId)
  if (room) room.occupants += 1
})

export const hostelPayments: HostelPayment[] = [
  { id: 'P-001', tenantId: 'T-001', periodLabel: 'September 2026', expectedAmount: 100000, amountPaid: 100000, paymentMethod: 'AIRTEL_MONEY', paymentDate: '2026-09-03' },
  { id: 'P-002', tenantId: 'T-002', periodLabel: 'September 2026', expectedAmount: 100000, amountPaid: 70000, paymentMethod: 'CASH', paymentDate: '2026-09-05' },
  { id: 'P-003', tenantId: 'T-003', periodLabel: 'September 2026', expectedAmount: 90000, amountPaid: 90000, paymentMethod: 'TNM_MPAMBA', paymentDate: '2026-09-02' },
  { id: 'P-004', tenantId: 'T-004', periodLabel: 'September 2026', expectedAmount: 85000, amountPaid: 0 },
  { id: 'P-005', tenantId: 'T-005', periodLabel: 'September 2026', expectedAmount: 85000, amountPaid: 40000, paymentMethod: 'CASH', paymentDate: '2026-09-08' },
  { id: 'P-006', tenantId: 'T-006', periodLabel: 'September 2026', expectedAmount: 70000, amountPaid: 70000, paymentMethod: 'BANK', paymentDate: '2026-09-01' },
]

// ---------------- Restaurant ----------------

export const foodItems: FoodItem[] = [
  { id: 'F-001', name: 'Maize Flour', unit: 'kg', cost: 1500 },
  { id: 'F-002', name: 'Rice', unit: 'kg', cost: 2300 },
  { id: 'F-003', name: 'Beef', unit: 'kg', cost: 11200 },
  { id: 'F-004', name: 'Chicken', unit: 'kg', cost: 8500 },
  { id: 'F-005', name: 'Utaka', unit: 'kg', cost: 6000 },
  { id: 'F-006', name: 'Matemba', unit: 'kg', cost: 5200 },
  { id: 'F-007', name: 'Vegetables', unit: 'kg', cost: 1000 },
  { id: 'F-008', name: 'Cooking Oil', unit: 'litre', cost: 3200 },
]

export const dailyFoodRecords: DailyFoodRecord[] = [
  { id: 'D-001', date: '2026-09-10', foodItemId: 'F-001', quantity: 20, cost: 30000 },
  { id: 'D-002', date: '2026-09-10', foodItemId: 'F-002', quantity: 15, cost: 34500 },
  { id: 'D-003', date: '2026-09-10', foodItemId: 'F-003', quantity: 8, cost: 89600 },
]

export const menuItems: MenuItem[] = [
  { id: 'M-001', name: 'Nsima + Beef', category: 'Meals', sellingPrice: 3500, available: true },
  { id: 'M-002', name: 'Nsima + Chicken', category: 'Meals', sellingPrice: 3200, available: true },
  { id: 'M-003', name: 'Nsima + Utaka', category: 'Meals', sellingPrice: 2800, available: true },
  { id: 'M-004', name: 'Nsima + Matemba', category: 'Meals', sellingPrice: 2600, available: true },
  { id: 'M-005', name: 'Rice + Beef', category: 'Meals', sellingPrice: 3800, available: true },
  { id: 'M-006', name: 'Rice + Chicken', category: 'Meals', sellingPrice: 3500, available: true },
  { id: 'M-007', name: 'Banana', category: 'Extras', sellingPrice: 500, available: true },
  { id: 'M-008', name: 'Soft Drink', category: 'Extras', sellingPrice: 1000, available: true },
]

export const restaurantSales: Sale[] = [
  {
    id: 'RS-001', date: '2026-09-10', time: '12:14', cashier: 'Grace M.',
    items: [
      { itemId: 'M-001', name: 'Nsima + Beef', quantity: 2, unitPrice: 3500 },
      { itemId: 'M-007', name: 'Banana', quantity: 3, unitPrice: 500 },
    ],
    total: 8500, paymentMethod: 'CASH', status: 'COMPLETED', syncStatus: 'SYNCED',
  },
  {
    id: 'RS-002', date: '2026-09-10', time: '12:40', cashier: 'Grace M.',
    items: [{ itemId: 'M-005', name: 'Rice + Beef', quantity: 1, unitPrice: 3800 }],
    total: 3800, paymentMethod: 'AIRTEL_MONEY', status: 'COMPLETED', syncStatus: 'PENDING',
  },
]

// ---------------- Grocery ----------------

export const groceryProducts: GroceryProduct[] = [
  { id: 'G-001', name: 'Sugar 1kg', category: 'Pantry', sellingPrice: 2500, buyingPrice: 2000, currentStock: 42, lowStockLevel: 10, unit: 'piece' },
  { id: 'G-002', name: 'Bread', category: 'Bakery', sellingPrice: 1500, buyingPrice: 1100, currentStock: 18, lowStockLevel: 8, unit: 'piece' },
  { id: 'G-003', name: 'Milk 500ml', category: 'Dairy', sellingPrice: 2000, buyingPrice: 1500, currentStock: 6, lowStockLevel: 10, unit: 'piece' },
  { id: 'G-004', name: 'Cooking Oil 1L', category: 'Pantry', sellingPrice: 5500, buyingPrice: 4600, currentStock: 25, lowStockLevel: 8, unit: 'piece' },
  { id: 'G-005', name: 'Soap Bar', category: 'Household', sellingPrice: 1200, buyingPrice: 850, currentStock: 60, lowStockLevel: 15, unit: 'piece' },
  { id: 'G-006', name: 'Rice 1kg', category: 'Pantry', sellingPrice: 2300, buyingPrice: 1900, currentStock: 4, lowStockLevel: 10, unit: 'kg' },
  { id: 'G-007', name: 'Eggs (tray)', category: 'Dairy', sellingPrice: 6500, buyingPrice: 5400, currentStock: 12, lowStockLevel: 5, unit: 'piece' },
  { id: 'G-008', name: 'Airtime Scratch Card', category: 'Other', sellingPrice: 1000, buyingPrice: 950, currentStock: 100, lowStockLevel: 20, unit: 'piece' },
]

export const grocerySales: Sale[] = [
  {
    id: 'GS-001', date: '2026-09-10', time: '09:05', cashier: 'Yamikani C.',
    items: [
      { itemId: 'G-001', name: 'Sugar 1kg', quantity: 2, unitPrice: 2500 },
      { itemId: 'G-002', name: 'Bread', quantity: 1, unitPrice: 1500 },
    ],
    total: 6500, paymentMethod: 'CASH', status: 'COMPLETED', syncStatus: 'SYNCED',
  },
]

// ---------------- Expenses ----------------

export const expenses: Expense[] = [
  { id: 'E-001', description: 'Electricity (ESCOM)', amount: 80000, business: 'GENERAL', date: '2026-09-05', paymentMethod: 'BANK' },
  { id: 'E-002', description: 'Restaurant gas refill', amount: 50000, business: 'RESTAURANT', date: '2026-09-06', paymentMethod: 'CASH' },
  { id: 'E-003', description: 'Cleaning supplies', amount: 15000, business: 'HOSTEL', date: '2026-09-07', paymentMethod: 'CASH' },
  { id: 'E-004', description: 'Transport — market run', amount: 20000, business: 'GROCERY', date: '2026-09-08', paymentMethod: 'CASH' },
]
