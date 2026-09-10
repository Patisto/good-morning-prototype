import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { pool } from '../db/pool'
import { signToken } from '../utils/jwt'
import { requireAuth } from '../middleware/auth'
import type { Role } from '../types'

const router = Router()

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }

  const result = await pool.query(
    'SELECT id, name, email, password_hash, role, active FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  )
  const user = result.rows[0]

  // Same generic message whether the email doesn't exist or the password is
  // wrong, so we don't reveal which accounts exist.
  const invalid = () => res.status(401).json({ error: 'Invalid email or password.' })

  if (!user || !user.active) return invalid()

  const passwordMatches = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatches) return invalid()

  const token = signToken({ sub: user.id, role: user.role as Role, name: user.name, email: user.email })

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role as Role },
  })
})

router.get('/me', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [req.user!.id])
  const user = result.rows[0]
  if (!user) return res.status(404).json({ error: 'User not found.' })
  res.json({ user })
})

export default router
