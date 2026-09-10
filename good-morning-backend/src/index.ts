import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.routes'
import hostelRoutes from './routes/hostel.routes'
import restaurantRoutes from './routes/restaurant.routes'
import groceryRoutes from './routes/grocery.routes'
import expensesRoutes from './routes/expenses.routes'

dotenv.config()

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/auth', authRoutes)
app.use('/api/hostel', hostelRoutes)
app.use('/api/restaurant', restaurantRoutes)
app.use('/api/grocery', groceryRoutes)
app.use('/api/expenses', expensesRoutes)

// Keep error responses generic — don't leak internals to the client.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Something went wrong.' })
})

const port = Number(process.env.PORT ?? 4000)
// Cloud web hosts route traffic to the port they provide at runtime.
app.listen(port, '0.0.0.0', () => {
  console.log(`Good Morning API listening on port ${port}`)
})
