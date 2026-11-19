<script setup lang="ts">
import { ref, watch } from 'vue';
import { api, fromApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useTask } from '@/composables/useTask';
import { businessName, formatDisplayDate, formatMWK, today } from '@/types';
const props=defineProps<{section:'restaurant'|'grocery';business:'RESTAURANT_A'|'RESTAURANT_B'|'GROCERY'}>();
type Receipt={id:string;business:string;date:string;time:string;total:number;paymentMethod:string;cashier:string;creditCustomer:string|null;items:{name:string;quantity:number;unitPrice:number}[]};
const auth=useAuthStore(),{busy,error,run}=useTask(),month=ref(today().slice(0,7)),receipts=ref<Receipt[]>([]);
async function load(){receipts.value=fromApi<Receipt[]>(await api.get(`/${props.section}/payment-history?month=${month.value}&business=${props.business}`,auth.token));}
watch(()=>[month.value,props.section,props.business],()=>void run(load),{immediate:true});
</script>
<template><section class="space-y-4"><header><h3 class="text-xl font-semibold">{{businessName(business)}} · Payment history</h3><p class="text-sm text-ink-muted">Completed sales and their recorded payment details.</p></header><div class="panel flex flex-wrap items-end justify-between gap-3"><label class="field">Sales month<input v-model="month" class="input" type="month" /></label><button class="btn-secondary" :disabled="busy" @click="run(load)">Refresh</button></div><p v-if="error" class="error">{{error}}</p><div class="overflow-x-auto"><table class="data-table"><thead><tr><th>Date / time</th><th>Items</th><th>Payment method</th><th>Customer</th><th>Cashier</th><th>Amount</th></tr></thead><tbody><tr v-for="receipt in receipts" :key="receipt.id"><td>{{formatDisplayDate(receipt.date)}}<span class="block text-xs text-ink-muted">{{receipt.time}}</span></td><td><ul><li v-for="(item,index) in receipt.items" :key="index">{{item.quantity}} × {{item.name}} · {{formatMWK(item.unitPrice)}}</li></ul></td><td>{{receipt.paymentMethod.replaceAll('_',' ')}}</td><td>{{receipt.creditCustomer||'—'}}</td><td>{{receipt.cashier}}</td><td class="font-semibold">{{formatMWK(receipt.total)}}</td></tr></tbody></table></div><p v-if="!receipts.length&&!busy" class="panel text-sm text-ink-muted">No recorded sales for {{month}}.</p></section></template>
