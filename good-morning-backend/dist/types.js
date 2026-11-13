"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSupervisor = void 0;
exports.canSee = canSee;
exports.canManage = canManage;
exports.allowedBusinesses = allowedBusinesses;
const isSupervisor = (role) => ['OWNER', 'ADMINISTRATOR', 'SUPER_MANAGER'].includes(role);
exports.isSupervisor = isSupervisor;
function canSee(role, section) {
    if ((0, exports.isSupervisor)(role))
        return true;
    if (section === 'reports')
        return role === 'ACCOUNTANT';
    if (section === 'settings')
        return role === 'SYSTEM_ADMINISTRATOR';
    if (section === 'expenses' || section === 'finance')
        return ['HOSTEL_MANAGER', 'RESTAURANT_MANAGER', 'GROCERY_MANAGER', 'ACCOUNTANT'].includes(role);
    if (role === 'ACCOUNTANT' || role === 'SYSTEM_ADMINISTRATOR')
        return false;
    return role.startsWith(section.toUpperCase() + '_');
}
function canManage(role, section) {
    return (0, exports.isSupervisor)(role) || role === `${section.toUpperCase()}_MANAGER`;
}
function allowedBusinesses(role) {
    if ((0, exports.isSupervisor)(role) || role === 'ACCOUNTANT')
        return ['HOSTEL', 'RESTAURANT_A', 'RESTAURANT_B', 'GROCERY', 'GENERAL', 'RESTAURANT'];
    if (role === 'HOSTEL_MANAGER')
        return ['HOSTEL'];
    if (role === 'RESTAURANT_MANAGER')
        return ['RESTAURANT_A', 'RESTAURANT_B'];
    if (role === 'GROCERY_MANAGER')
        return ['GROCERY'];
    return [];
}
//# sourceMappingURL=types.js.map