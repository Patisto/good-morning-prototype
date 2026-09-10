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

export type Section = 'hostel' | 'restaurant' | 'grocery' | 'expenses' | 'settings'

export function canSee(role: Role, section: Section): boolean {
  const full: Role[] = ['OWNER', 'ADMINISTRATOR']
  if (full.includes(role)) return true
  if (section === 'hostel') return role === 'HOSTEL_MANAGER' || role === 'ACCOUNTANT'
  if (section === 'restaurant') return (['RESTAURANT_MANAGER', 'RESTAURANT_CASHIER', 'ACCOUNTANT'] as Role[]).includes(role)
  if (section === 'grocery') return (['GROCERY_MANAGER', 'GROCERY_CASHIER', 'ACCOUNTANT'] as Role[]).includes(role)
  if (section === 'expenses') return role === 'ACCOUNTANT'
  if (section === 'settings') return role === 'SYSTEM_ADMINISTRATOR'
  return false
}
