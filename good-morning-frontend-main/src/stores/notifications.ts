import { defineStore } from 'pinia';
export const useNotificationsStore = defineStore('notifications', {
    state: () => ({ items: [] as {
            id: string;
            message: string;
            tone: 'success' | 'error';
        }[] }),
    actions: {
        show(message: string, tone: 'success' | 'error' = 'success') {
            const id = crypto.randomUUID();
            this.items.push({ id, message, tone });
            window.setTimeout(() => this.dismiss(id), tone === 'error' ? 10000 : 6000);
        },
        dismiss(id: string) { this.items = this.items.filter(item => item.id !== id); },
    },
});
