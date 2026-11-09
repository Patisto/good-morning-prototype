"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tradingRouter = tradingRouter;
const express_1 = require("express");
const crypto_1 = require("crypto");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const http_1 = require("../utils/http");
const inventory_1 = require("../services/inventory");
/** One implementation keeps restaurant and grocery inventory rules consistent. */
function tradingRouter(section) {
    const router = (0, express_1.Router)();
    router.use(auth_1.requireAuth, (0, auth_1.requireSection)(section));
    router.use((req, res, next) => {
        try {
            const scope = (0, inventory_1.business)(req.query.business ?? req.body?.business);
            (0, http_1.check)(section === 'grocery' ? scope === 'GROCERY' : scope !== 'GROCERY', 'Wrong business for this section.', 403);
            res.locals.business = scope;
            next();
        }
        catch (error) {
            next(error);
        }
    });
    router.get('/', (0, http_1.route)(async (req, res) => {
        const scope = res.locals.business, day = (0, http_1.date)(req.query.date);
        const [products, sales, entries] = await Promise.all([
            pool_1.pool.query(inventory_1.inventorySelect, [scope, day]),
            pool_1.pool.query(`SELECT s.*, COALESCE(json_agg(json_build_object('itemId',i.item_id,'name',i.name,'quantity',i.quantity,'unitPrice',i.unit_price)) FILTER (WHERE i.id IS NOT NULL),'[]') AS items
        FROM sales s LEFT JOIN sale_items i ON i.sale_id=s.id WHERE s.business=$1 AND s.date=$2 GROUP BY s.id ORDER BY s.created_at DESC`, [scope, day]),
            pool_1.pool.query(`SELECT e.*,p.name FROM stock_entries e JOIN business_products p ON p.id=e.product_id WHERE p.business=$1 AND e.date=$2 ORDER BY e.created_at DESC`, [scope, day]),
        ]);
        res.json({ products: products.rows.map(p => ({ ...p, current_stock: Number(p.received) - Number(p.sold) })), sales: sales.rows, entries: entries.rows });
    }));
    if (section === 'restaurant') {
        router.get('/meal-cards', (0, http_1.route)(async (_req, res) => {
            const result = await pool_1.pool.query('SELECT id,customer_name,phone,balance,default_charge,business,active FROM restaurant_meal_cards WHERE business=$1 AND active=true ORDER BY customer_name', [res.locals.business]);
            res.json(result.rows);
        }));
        router.post('/meal-cards', (0, auth_1.requireManager)(section), (0, http_1.route)(async (req, res) => {
            const b = req.body;
            const name = (0, http_1.text)(b.customerName, 'Customer name');
            const phone = typeof b.phone === 'string' ? b.phone.slice(0, 100) : '';
            const balance = (0, http_1.number)(b.balance, 'Prepaid amount');
            const defaultCharge = (0, http_1.number)(b.defaultCharge, 'Default meal amount');
            const id = await (0, http_1.transaction)(async (db) => {
                if (!await (0, http_1.claimRequest)(db, b.requestId, req.user.id, `meal-card:${res.locals.business}`))
                    return null;
                const created = await db.query('INSERT INTO restaurant_meal_cards(customer_name,phone,balance,default_charge,business) VALUES($1,$2,$3,$4,$5) RETURNING id', [name, phone, balance, defaultCharge, res.locals.business]);
                if (balance > 0)
                    await db.query('INSERT INTO restaurant_meal_card_funding(meal_card_id,business,amount,date,recorded_by) VALUES($1,$2,$3,$4,$5)', [created.rows[0].id, res.locals.business, balance, (0, http_1.today)(), req.user.name]);
                return created.rows[0].id;
            });
            res.json({ id });
        }));
    }
    router.post('/products', (0, auth_1.requireManager)(section), (0, http_1.route)(async (req, res) => {
        const b = req.body, id = b.id || (0, crypto_1.randomUUID)(), scope = res.locals.business;
        const values = [id, scope, (0, http_1.text)(b.name, 'Product name'), typeof b.category === 'string' ? b.category.slice(0, 100) : '', (0, http_1.text)(b.unit, 'Selling unit'), (0, http_1.number)(b.sellingPrice, 'Selling price'), (0, http_1.number)(b.buyingPrice ?? 0, 'Buying price'), (0, http_1.number)(b.lowStockLevel ?? 0, 'Low stock level')];
        if (b.id) {
            const result = await pool_1.pool.query(`UPDATE business_products SET name=$3,category=$4,unit=$5,selling_price=$6,buying_price=$7,low_stock_level=$8 WHERE id=$1 AND business=$2 AND archived_at IS NULL RETURNING id`, values);
            (0, http_1.check)(result.rowCount, 'Product not found.', 404);
        }
        else
            await pool_1.pool.query('INSERT INTO business_products(id,business,name,category,unit,selling_price,buying_price,low_stock_level) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', values);
        res.json({ id });
    }));
    router.delete('/products/:id', (0, auth_1.requireManager)(section), (0, http_1.route)(async (req, res) => {
        const result = await pool_1.pool.query('UPDATE business_products SET archived_at=now() WHERE id=$1 AND business=$2 AND archived_at IS NULL RETURNING id', [req.params.id, res.locals.business]);
        (0, http_1.check)(result.rowCount, 'Product not found.', 404);
        res.json({ ok: true });
    }));
    router.post('/stock', (0, auth_1.requireManager)(section), (0, http_1.route)(async (req, res) => {
        const b = req.body, day = (0, http_1.date)(b.date), quantity = (0, http_1.number)(b.quantity, 'Quantity', 0.01);
        (0, http_1.check)(day <= (0, http_1.today)(), 'Stock cannot be received in the future.');
        await (0, http_1.transaction)(async (db) => {
            if (!await (0, http_1.claimRequest)(db, b.requestId, req.user.id, `stock:${res.locals.business}`))
                return;
            const product = await db.query('SELECT id FROM business_products WHERE id::text=$1 AND business=$2 AND archived_at IS NULL FOR UPDATE', [b.productId, res.locals.business]);
            (0, http_1.check)(product.rowCount, 'Product not found.', 404);
            await db.query('INSERT INTO stock_entries(product_id,date,quantity,notes) VALUES ($1,$2,$3,$4)', [b.productId, day, quantity, typeof b.notes === 'string' ? b.notes.slice(0, 2000) : '']);
        });
        res.json({ ok: true });
    }));
    router.post('/sales', (0, http_1.route)(async (req, res) => {
        (0, http_1.check)(req.user.role !== 'ACCOUNTANT', 'This account has read-only sales access.', 403);
        const day = (0, http_1.date)(req.body.date), payment = (0, http_1.method)(req.body.paymentMethod), scope = res.locals.business;
        // Historical entry can consume stock needed by later sales. Sell on today's date;
        // dated history remains available for review.
        (0, http_1.check)(day === (0, http_1.today)(), "Sales must be recorded for today's date.");
        const id = await (0, http_1.transaction)(async (db) => {
            if (!await (0, http_1.claimRequest)(db, req.body.requestId, req.user.id, `sale:${scope}`))
                return null;
            const lines = await (0, inventory_1.pricedLines)(db, scope, day, req.body.items);
            const calculatedTotal = Math.round(lines.reduce((sum, line) => sum + Math.round(line.quantity * line.unitPrice * 100), 0)) / 100;
            const total = payment === 'MEAL_CARD' ? (0, http_1.number)(req.body.chargedTotal, 'Meal card charge', 0.01) : calculatedTotal;
            let mealCardId = null;
            const creditCustomer = payment === 'CREDIT' ? (0, http_1.text)(req.body.creditCustomer, 'Credit customer') : null;
            if (payment === 'MEAL_CARD') {
                (0, http_1.check)(section === 'restaurant' && typeof req.body.mealCardId === 'string', 'Select a restaurant meal card.');
                const card = await db.query('SELECT id,balance FROM restaurant_meal_cards WHERE id=$1 AND business=$2 AND active=true FOR UPDATE', [req.body.mealCardId, scope]);
                (0, http_1.check)(card.rowCount, 'Meal card not found.', 404);
                (0, http_1.check)(Number(card.rows[0].balance) >= total, 'Meal card has insufficient prepaid balance.');
                mealCardId = card.rows[0].id;
                await db.query('UPDATE restaurant_meal_cards SET balance=balance-$2 WHERE id=$1', [mealCardId, total]);
            }
            const result = await db.query(`INSERT INTO sales(business,date,time,total,payment_method,cashier,inventory_tracked,meal_card_id,credit_customer)
        VALUES ($1,$2,to_char(now() AT TIME ZONE 'Africa/Blantyre','HH24:MI'),$3,$4,$5,true,$6,$7) RETURNING id`, [scope, day, total, payment, req.user.name, mealCardId, creditCustomer]);
            for (const line of lines)
                await db.query('INSERT INTO sale_items(sale_id,item_id,name,quantity,unit_price) VALUES ($1,$2,$3,$4,$5)', [result.rows[0].id, line.itemId, line.name, line.quantity, line.unitPrice]);
            return result.rows[0].id;
        });
        res.json({ id });
    }));
    router.delete('/sales/:id', (0, auth_1.requireManager)(section), (0, http_1.route)(async (req, res) => {
        const configuredKey = process.env.SALE_ERASE_KEY;
        (0, http_1.check)(!!configuredKey && typeof req.query.key === 'string' && req.query.key === configuredKey, 'The sale erase key is missing or incorrect.', 403);
        await (0, http_1.transaction)(async (db) => {
            const sale = await db.query('SELECT id,meal_card_id,total FROM sales WHERE id=$1 AND business=$2 FOR UPDATE', [req.params.id, res.locals.business]);
            (0, http_1.check)(sale.rowCount, 'Sale not found.', 404);
            if (sale.rows[0].meal_card_id)
                await db.query('UPDATE restaurant_meal_cards SET balance=balance+$2 WHERE id=$1', [sale.rows[0].meal_card_id, sale.rows[0].total]);
            await db.query('DELETE FROM sales WHERE id=$1', [req.params.id]);
        });
        res.json({ ok: true });
    }));
    return router;
}
//# sourceMappingURL=trading.routes.js.map