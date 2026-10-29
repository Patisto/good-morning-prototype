import type { PoolClient } from 'pg';
import { check, number } from '../utils/http';
export type SalesBusiness = 'RESTAURANT_A' | 'RESTAURANT_B' | 'GROCERY';
export function business(value: unknown): SalesBusiness {
    check(['RESTAURANT_A', 'RESTAURANT_B', 'GROCERY'].includes(String(value)), 'Choose Upper Restaurant, Lower Restaurant, or Grocery.');
    return value as SalesBusiness;
}
// Restaurant stock belongs to a service date. Grocery stock carries forward.
export const inventorySelect = `SELECT p.*,
  COALESCE((SELECT SUM(e.quantity) FROM stock_entries e WHERE e.product_id=p.id
    AND (CASE WHEN p.business='GROCERY' THEN e.date <= $2::date ELSE e.date=$2::date END)),0) AS received,
  COALESCE((SELECT SUM(i.quantity) FROM sale_items i JOIN sales s ON s.id=i.sale_id
    WHERE i.item_id=p.id::text AND s.inventory_tracked AND s.status='COMPLETED'
    AND (CASE WHEN p.business='GROCERY' THEN s.date <= $2::date ELSE s.date=$2::date END)),0) AS sold
  FROM business_products p WHERE p.business=$1 AND p.archived_at IS NULL ORDER BY p.name`;
export function normalizeLines(value: unknown): {
    itemId: string;
    quantity: number;
}[] {
    check(Array.isArray(value) && value.length > 0 && value.length <= 200, 'Add between 1 and 200 sale items.');
    const quantities = new Map<string, number>();
    for (const line of value) {
        check(line && typeof line.itemId === 'string', 'Invalid sale item.');
        const qty = number(line.quantity, 'Quantity', 0.01);
        quantities.set(line.itemId, number(Math.round(((quantities.get(line.itemId) ?? 0) + qty) * 100) / 100, 'Quantity', 0.01));
    }
    return Array.from(quantities, ([itemId, quantity]) => ({ itemId, quantity })).sort((a, b) => a.itemId.localeCompare(b.itemId));
}
export async function pricedLines(db: PoolClient, scope: SalesBusiness, date: string, input: unknown) {
    const lines = normalizeLines(input);
    // Always lock products in the same order. Sales and stock receipts share these locks.
    const locked = await db.query('SELECT id FROM business_products WHERE id::text=ANY($1::text[]) AND business=$2 AND archived_at IS NULL ORDER BY id FOR UPDATE', [lines.map(l => l.itemId), scope]);
    check(locked.rowCount === lines.length, 'One or more products are unavailable.');
    const result = await db.query(inventorySelect, [scope, date]);
    const products = new Map(result.rows.map(p => [p.id, p]));
    return lines.map(line => {
        const p = products.get(line.itemId)!;
        check(Number(p.received) - Number(p.sold) >= line.quantity, `Insufficient stock for ${p.name}.`);
        return { ...line, name: p.name as string, unitPrice: Number(p.selling_price) };
    });
}
