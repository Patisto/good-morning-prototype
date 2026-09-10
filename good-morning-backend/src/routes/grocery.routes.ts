import { Router } from 'express'
import { pool } from '../db/pool'
import { requireAuth, requireSection } from '../middleware/auth'

const router = Router()
router.use(requireAuth, requireSection('grocery'))

router.get('/products', async (_req, res) => {
  const result = await pool.query(`
    SELECT id, name, category, selling_price, buying_price, current_stock, low_stock_level, unit
    FROM grocery_products
    ORDER BY category, name
  `)
  res.json({ products: result.rows })
})

export default router
