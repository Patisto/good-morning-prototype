"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canSee = canSee;
function canSee(role, section) {
    const full = ['OWNER', 'ADMINISTRATOR'];
    if (full.includes(role))
        return true;
    if (section === 'hostel')
        return role === 'HOSTEL_MANAGER' || role === 'ACCOUNTANT';
    if (section === 'restaurant')
        return ['RESTAURANT_MANAGER', 'RESTAURANT_CASHIER', 'ACCOUNTANT'].includes(role);
    if (section === 'grocery')
        return ['GROCERY_MANAGER', 'GROCERY_CASHIER', 'ACCOUNTANT'].includes(role);
    if (section === 'expenses')
        return role === 'ACCOUNTANT';
    if (section === 'settings')
        return role === 'SYSTEM_ADMINISTRATOR';
    return false;
}
//# sourceMappingURL=types.js.map