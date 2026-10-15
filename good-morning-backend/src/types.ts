export type Role = 'OWNER' | 'ADMINISTRATOR' | 'SUPER_MANAGER' | 'HOSTEL_MANAGER' | 'RESTAURANT_MANAGER' | 'RESTAURANT_CASHIER' | 'GROCERY_MANAGER' | 'GROCERY_CASHIER' | 'ACCOUNTANT' | 'SYSTEM_ADMINISTRATOR';
export type Section = 'hostel' | 'restaurant' | 'grocery' | 'expenses' | 'finance' | 'settings' | 'reports';
export type Business = 'HOSTEL' | 'RESTAURANT_A' | 'RESTAURANT_B' | 'GROCERY' | 'GENERAL' | 'RESTAURANT';
export const isSupervisor = (role: Role) => ['OWNER', 'ADMINISTRATOR', 'SUPER_MANAGER'].includes(role);
export function canSee(role: Role, section: Section): boolean {
    if (isSupervisor(role))
        return true;
    if (section === 'reports')
        return role === 'ACCOUNTANT';
    if (section === 'settings')
        return role === 'SYSTEM_ADMINISTRATOR';
    if (section === 'expenses' || section === 'finance')
        return ['HOSTEL_MANAGER', 'RESTAURANT_MANAGER', 'GROCERY_MANAGER', 'ACCOUNTANT'].includes(role);
    if (role === 'ACCOUNTANT')
        return true;
    return role.startsWith(section.toUpperCase() + '_');
}
export function canManage(role: Role, section: Section): boolean {
    return isSupervisor(role) || role === `${section.toUpperCase()}_MANAGER`;
}
export function allowedBusinesses(role: Role): Business[] {
    if (isSupervisor(role) || role === 'ACCOUNTANT')
        return ['HOSTEL', 'RESTAURANT_A', 'RESTAURANT_B', 'GROCERY', 'GENERAL', 'RESTAURANT'];
    if (role === 'HOSTEL_MANAGER')
        return ['HOSTEL'];
    if (role === 'RESTAURANT_MANAGER')
        return ['RESTAURANT_A', 'RESTAURANT_B'];
    if (role === 'GROCERY_MANAGER')
        return ['GROCERY'];
    return [];
}
