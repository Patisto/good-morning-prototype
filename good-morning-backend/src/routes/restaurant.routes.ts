import { Router } from 'express'
import { pool } from '../db/pool'
import { requireAuth, requireSection } from '../middleware/auth'

const router = Router()
router.use(requireAuth, requireSection('restaurant'))

router.get('/menu-items', async (_req, res) => {
  const result = await pool.query(
    'SELECT id, name, category, selling_price, available FROM menu_items ORDER BY category, name'
  )
  res.json({ menuItems: result.rows })
})

router.get('/food-items', async (_req, res) => {
  const result = await pool.query('SELECT id, name, unit, cost FROM food_items ORDER BY name')
  res.json({ foodItems: result.rows })
})

router.get('/food-records', async (_req, res) => {
  const result = await pool.query(`
    SELECT r.id, r.date, r.food_item_id, r.quantity, r.cost, f.name AS food_item_name, f.unit
    FROM daily_food_records r
    JOIN food_items f ON f.id = r.food_item_id
    ORDER BY r.date DESC
  `)
  res.json({ records: result.rows })
})

export default router
