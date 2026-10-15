import { useNotificationsStore } from '@/stores/notifications';
import { ref } from 'vue';
/** One place for pending/error feedback; a failed write never looks saved. */
export function useTask() {
    const busy = ref(false), error = ref('');
    async function run<T>(work: () => Promise<T>): Promise<T | undefined> {
        if (busy.value)
            return;
        busy.value = true;
        error.value = '';
        try {
            return await work();
        }
        catch (cause) {
            error.value = cause instanceof Error ? cause.message : 'The request failed. Please retry.';
            useNotificationsStore().show(error.value, 'error');
        }
        finally {
            busy.value = false;
        }
    }
    return { busy, error, run };
}
