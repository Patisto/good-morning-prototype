import { Router } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../db/pool';
import { requireAuth, requireSection, requireManager } from '../middleware/auth';
import { claimRequest, check, date, method, number, route, text, today, transaction } from '../utils/http';
import { business, inventorySelect, pricedLines } from '../services/inventory';
/** One implementation keeps restaurant and grocery inventory rules consistent. */
export function tradingRouter(section: 'restaurant' | 'grocery') {
    const router = Router();
    router.use(requireAuth, requireSection(section));
    router.use((req, res, next) => {
        try {
            const scope = business(req.query.business ?? req.body?.business);
            check(section === 'grocery' ? scope === 'GROCERY' : scope !== 'GROCERY', 'Wrong business for this section.', 403);
            res.locals.business = scope;
            next();
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/', route(async (req, res) => {
        const scope = res.locals.business, day = date(req.query.date);
        const [products, sales, entries] = await Promise.all([
            pool.query(inventorySelect, [scope, day]),
            pool.query(`SELECT s.*, COALESCE(json_agg(json_build_object('itemId',i.item_id,'name',i.name,'quantity',i.quantity,'unitPrice',i.unit_price)) FILTER (WHERE i.id IS NOT NULL),'[]') AS items
        FROM sales s LEFT JOIN sale_items i ON i.sale_id=s.id WHERE s.business=$1 AND s.date=$2 GROUP BY s.id ORDER BY s.created_at DESC`, [scope, day]),
            pool.query(`SELECT e.*,p.name FROM stock_entries e JOIN business_products p ON p.id=e.product_id WHERE p.business=$1 AND e.date=$2 ORDER BY e.created_at DESC`, [scope, day]),
        ]);
        res.json({ products: products.rows.map(p => ({ ...p, current_stock: Number(p.received) - Number(p.sold) })), sales: sales.rows, entries: entries.rows });
    }));
    router.post('/products', requireManager(section), route(async (req, res) => {
        const b = req.body, id = b.id || randomUUID(), scope = res.locals.business;
        const values = [id, scope, text(b.name, 'Product name'), typeof b.category === 'string' ? b.category.slice(0, 100) : '', text(b.unit, 'Selling unit'), number(b.sellingPrice, 'Selling price'), number(b.buyingPrice ?? 0, 'Buying price'), number(b.lowStockLevel ?? 0, 'Low stock level')];
        if (b.id) {
            const result = await pool.query(`UPDATE business_products SET name=$3,category=$4,unit=$5,selling_price=$6,buying_price=$7,low_stock_level=$8 WHERE id=$1 AND business=$2 AND archived_at IS NULL RETURNING id`, values);
            check(result.rowCount, 'Product not found.', 404);
        }
        else
            await pool.query('INSERT INTO business_products(id,business,name,category,unit,selling_price,buying_price,low_stock_level) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', values);
        res.json({ id });
    }));
    router.delete('/products/:id', requireManager(section), route(async (req, res) => {
        const result = await pool.query('UPDATE business_products SET archived_at=now() WHERE id=$1 AND business=$2 AND archived_at IS NULL RETURNING id', [req.params.id, res.locals.business]);
        check(result.rowCount, 'Product not found.', 404);
        res.json({ ok: true });
    }));
    router.post('/stock', requireManager(section), route(async (req, res) => {
        const b = req.body, day = date(b.date), quantity = number(b.quantity, 'Quantity', 0.01);
        check(day <= today(), 'Stock cannot be received in the future.');
        await transaction(async (db) => {
            if (!await claimRequest(db, b.requestId, req.user!.id, `stock:${res.locals.business}`))
                return;
            const product = await db.query('SELECT id FROM business_products WHERE id::text=$1 AND business=$2 AND archived_at IS NULL FOR UPDATE', [b.productId, res.locals.business]);
            check(product.rowCount, 'Product not found.', 404);
            await db.query('INSERT INTO stock_entries(product_id,date,quantity,notes) VALUES ($1,$2,$3,$4)', [b.productId, day, quantity, typeof b.notes === 'string' ? b.notes.slice(0, 2000) : '']);
        });
        res.json({ ok: true });
    }));
    router.post('/sales', route(async (req, res) => {
        check(req.user!.role !== 'ACCOUNTANT', 'This account has read-only sales access.', 403);
        const day = date(req.body.date), payment = method(req.body.paymentMethod), scope = res.locals.business;
        // Historical entry can consume stock needed by later sales. Sell on today's date;
        // dated history remains available for review.
        check(day === today(), "Sales must be recorded for today's date.");
        const id = await transaction(async (db) => {
            if (!await claimRequest(db, req.body.requestId, req.user!.id, `sale:${scope}`))
                return null;
            const lines = await pricedLines(db, scope, day, req.body.items);
            const total = number(Math.round(lines.reduce((sum, line) => sum + Math.round(line.quantity * line.unitPrice * 100), 0)) / 100, 'Sale total');
            const result = await db.query(`INSERT INTO sales(business,date,time,total,payment_method,cashier,inventory_tracked)
        VALUES ($1,$2,to_char(now() AT TIME ZONE 'Africa/Blantyre','HH24:MI'),$3,$4,$5,true) RETURNING id`, [scope, day, total, payment, req.user!.name]);
            for (const line of lines)
                await db.query('INSERT INTO sale_items(sale_id,item_id,name,quantity,unit_price) VALUES ($1,$2,$3,$4,$5)', [result.rows[0].id, line.itemId, line.name, line.quantity, line.unitPrice]);
            return result.rows[0].id;
        });
        res.json({ id });
    }));
    router.delete('/sales/:id', requireManager(section), route(async (req, res) => {
        const configuredKey = process.env.SALE_ERASE_KEY;
        check(!!configuredKey && typeof req.query.key === 'string' && req.query.key === configuredKey, 'The sale erase key is missing or incorrect.', 403);
        await transaction(async db => {
            const sale = await db.query('SELECT id FROM sales WHERE id=$1 AND business=$2 FOR UPDATE', [req.params.id, res.locals.business]);
            check(sale.rowCount, 'Sale not found.', 404);
            await db.query('DELETE FROM sales WHERE id=$1', [req.params.id]);
        });
        res.json({ ok: true });
    }));
    return router;
}
