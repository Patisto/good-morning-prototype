import { useNotificationsStore } from '@/stores/notifications';
const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/+$/, '');
export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}
async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
    };
    if (token)
        headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/${path.replace(/^\/+/, '')}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new ApiError(data.error ?? 'Something went wrong.', res.status);
    }
    if (options.method === 'POST' || options.method === 'DELETE') {
        const message = mutationMessage(path, options);
        if (message)
            useNotificationsStore().show(message);
    }
    return data as T;
}
// Keep the same request ID when a network failure leaves the outcome unknown.
const pendingRequests = new Map<string, string>();
async function post<T>(path: string, body: unknown = {}, token?: string | null): Promise<T> {
    if (!/\/(sales|stock|payments)(\?|$)|^\/expenses(?:\?|$)/.test(path))
        return request<T>(path, { method: 'POST', body: JSON.stringify(body) }, token);
    const key = JSON.stringify([token, path, body]);
    const requestId = pendingRequests.get(key) ?? crypto.randomUUID();
    pendingRequests.set(key, requestId);
    try {
        const result = await request<T>(path, { method: 'POST', body: JSON.stringify({ ...(body as object), requestId }) }, token);
        pendingRequests.delete(key);
        return result;
    }
    catch (error) {
        if (error instanceof ApiError && error.status < 500)
            pendingRequests.delete(key);
        throw error;
    }
}
export const api = {
    get: <T>(path: string, token?: string | null) => request<T>(path, { method: 'GET' }, token),
    delete: <T>(path: string, token?: string | null) => request<T>(path, { method: 'DELETE' }, token),
    post,
};
/** Normalize PostgreSQL numeric values and snake_case keys at the API boundary. */
const numericKeys = new Set(['capacity', 'occupants', 'monthlyPrice', 'monthlyAmount', 'deposit', 'yearOfStudy', 'expectedAmount', 'amountPaid', 'sellingPrice', 'buyingPrice', 'currentStock', 'lowStockLevel', 'received', 'sold', 'quantity', 'unitPrice', 'total', 'amount', 'income', 'expenses', 'count']);
export function fromApi<T>(input: unknown): T {
    if (Array.isArray(input))
        return input.map(value => fromApi(value)) as T;
    if (input && typeof input === 'object')
        return Object.fromEntries(Object.entries(input).map(([key, value]) => {
            const name = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
            return [name, numericKeys.has(name) && value !== null ? Number(value) : fromApi(value)];
        })) as T;
    return input as T;
}
/** Success is announced only after the server accepts a write, before any refresh. */
function mutationMessage(path: string, options: RequestInit): string | null {
    if (path.startsWith('/auth/'))
        return null;
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
    const resource = path.split('?')[0];
    if (options.method === 'DELETE')
        return resource.includes('/rooms/') ? 'Room deleted.' : 'Item deleted.';
    if (resource === '/users')
        return body.id ? 'Account updated.' : 'Account created.';
    if (resource === '/hostel/units')
        return body.id ? 'Housing unit updated.' : 'Housing unit added.';
    if (resource === '/hostel/rooms')
        return body.id ? 'Room updated.' : 'Room added.';
    if (resource === '/hostel/tenants')
        return body.id ? 'Tenant updated.' : 'Tenant added.';
    if (resource.endsWith('/checkout'))
        return 'Tenant checked out.';
    if (resource.endsWith('/payments'))
        return 'Payment received and recorded.';
    if (resource.endsWith('/notes'))
        return 'Balance notes saved.';
    if (resource.endsWith('/batch-price'))
        return 'Room prices updated.';
    if (resource === '/hostel/settings')
        return 'Default rent updated.';
    if (resource === '/hostel/charges')
        return 'Monthly charges are ready.';
    if (resource.endsWith('/products'))
        return body.id ? 'Item updated.' : 'Item added.';
    if (resource.endsWith('/stock'))
        return 'Stock received.';
    if (resource.endsWith('/sales'))
        return 'Sale recorded.';
    if (resource === '/expenses')
        return 'Expense recorded.';
    return 'Changes saved.';
}
