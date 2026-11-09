"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeMalawiPhone = normalizeMalawiPhone;
const http_1 = require("../utils/http");
function normalizeMalawiPhone(value) {
    (0, http_1.check)(typeof value === 'string' && value.trim().length <= 40, 'Invalid phone number.');
    let phone = value.replace(/[\s().-]/g, '');
    if (phone.startsWith('+'))
        phone = phone.slice(1);
    if (phone.startsWith('0'))
        phone = `265${phone.slice(1)}`;
    (0, http_1.check)(/^265(88|89|98|99)\d{7}$/.test(phone), 'Invalid Malawian phone number.');
    return phone;
}
//# sourceMappingURL=phone.js.map