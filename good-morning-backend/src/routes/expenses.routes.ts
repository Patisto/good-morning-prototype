import { Router } from 'express'
import { pool } from '../db/pool'
import { requireAuth, requireSection } from '../middleware/auth'

const router = Router()
router.use(requireAuth, requireSection('expenses'))

router.get('/', async (_req, res) => {
  const result = await pool.query(`
    SELECT id, description, amount, business, date, payment_method, notes
    FROM expenses
    ORDER BY date DESC
  `)
  res.json({ expenses: result.rows })
})

export default router
