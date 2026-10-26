import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import hostelRoutes from './routes/hostel.routes';
import restaurantRoutes from './routes/restaurant.routes';
import groceryRoutes from './routes/grocery.routes';
import financeRoutes from './routes/finance.routes';
import expensesRoutes from './routes/expenses.routes';
import usersRoutes from './routes/users.routes';
import reportsRoutes from './routes/reports.routes';
import { HttpError } from './utils/http';
dotenv.config();
const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/hostel', hostelRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/grocery', groceryRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);
// Keep error responses generic — don't leak internals to the client.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError)
        return res.status(err.status).json({ error: err.message });
    const code = (err as {
        code?: string;
    })?.code;
    if (code === '22P02')
        return res.status(400).json({ error: 'Invalid record identifier or value.' });
    if (code === '23505')
        return res.status(409).json({ error: 'That record already exists.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
});
const port = Number(process.env.PORT ?? 4000);
// Cloud web hosts route traffic to the port they provide at runtime.
app.listen(port, '127.0.0.1', () => {
    console.log(`Good Morning API listening on port ${port}`);
});
