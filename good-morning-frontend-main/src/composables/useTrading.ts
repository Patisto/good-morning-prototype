import { computed, ref, watch } from 'vue';
import { api, fromApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useTask } from './useTask';
import { today, type Product, type Sale, type SalesBusiness, type PaymentMethod } from '@/types';
export function useTrading(section: 'restaurant' | 'grocery') {
    const auth = useAuthStore();
    const business = ref<SalesBusiness>(section === 'restaurant' ? 'RESTAURANT_A' : 'GROCERY');
    const date = ref(today()), products = ref<Product[]>([]), sales = ref<Sale[]>([]);
    const entries = ref<{
        id: string;
        name: string;
        quantity: number;
        notes: string;
    }[]>([]);
    const task = useTask();
    const path = (suffix = '') => `/${section}${suffix}?business=${business.value}`;
    const canManage = computed(() => auth.canManage(section));
    const revenue = computed(() => sales.value.filter(s => s.status === 'COMPLETED').reduce((sum, s) => sum + s.total, 0));
    async function load() {
        const data = fromApi<{
            products: Product[];
            sales: Sale[];
            entries: typeof entries.value;
        }>(await api.get(`${path()}&date=${date.value}`, auth.token));
        products.value = data.products;
        sales.value = data.sales;
        entries.value = data.entries;
    }
    async function save(suffix: string, body: unknown) {
        await api.post(path(suffix), body, auth.token);
    }
    async function remove(id: string) { await api.delete(path(`/products/${id}`), auth.token); await load(); }
    async function sell(items: {
        itemId: string;
        quantity: number;
    }[], paymentMethod: PaymentMethod) {
        await save('/sales', { date: date.value, items, paymentMethod });
    }
    watch([business, date], () => {
        products.value = [];
        sales.value = [];
        entries.value = [];
        void task.run(load);
    }, { immediate: true });
    return { business, date, products, sales, entries, canManage, revenue, ...task, load, save, remove, sell };
}
