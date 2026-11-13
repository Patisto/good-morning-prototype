import { check } from '../utils/http';

export function normalizeMalawiPhone(value: unknown): string {
  check(typeof value === 'string' && value.trim().length <= 40, 'Invalid phone number.');
  let phone = value.replace(/[\s().-]/g, '');
  if (phone.startsWith('+')) phone = phone.slice(1);
  if (phone.startsWith('0')) phone = `265${phone.slice(1)}`;
  check(/^265(88|89|98|99)\d{7}$/.test(phone), 'Invalid Malawian phone number.');
  return phone;
}
