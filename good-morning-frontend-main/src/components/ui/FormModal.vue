<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
const props = defineProps<{
    title: string;
    busy?: boolean;
}>();
const emit = defineEmits<{
    close: [
    ];
}>();
const panel = ref<HTMLElement | null>(null);
const titleId = `modal-${crypto.randomUUID()}`;
let previousFocus: HTMLElement | null = null;
let previousOverflow = '';
function close() { if (!props.busy)
    emit('close'); }
function focusable() {
    return Array.from(panel.value?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]') ?? []).filter(el => el.getClientRects().length);
}
function keyboard(event: KeyboardEvent) {
    if (event.key === 'Escape') {
        event.preventDefault();
        close();
    }
    if (event.key !== 'Tab')
        return;
    const items = focusable();
    if (!items.length) {
        event.preventDefault();
        panel.value?.focus();
        return;
    }
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !panel.value?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
    }
    else if (!event.shiftKey && (document.activeElement === last || !panel.value?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
    }
}
onMounted(async () => {
    previousFocus = document.activeElement as HTMLElement;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    await nextTick();
    (panel.value?.querySelector<HTMLElement>('input:not([disabled]),select:not([disabled]),textarea:not([disabled])') ?? panel.value)?.focus();
    document.addEventListener('keydown', keyboard);
});
onUnmounted(() => {
    document.removeEventListener('keydown', keyboard);
    document.body.style.overflow = previousOverflow;
    if (previousFocus?.isConnected)
        previousFocus.focus();
});
</script>
<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" @click.self="close">
      <section ref="panel" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1" class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-surface shadow-xl">
        <header class="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 :id="titleId" class="text-lg font-semibold">{{ title }}</h2>
          <button type="button" class="btn-secondary" :disabled="busy" aria-label="Close dialog" @click="close">×</button>
        </header>
        <div class="p-5"><slot /></div>
      </section>
    </div>
  </Teleport>
</template>
