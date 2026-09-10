import type { NextFunction, Request, Response } from 'express'
import { verifyToken } from '../utils/jwt'
import { canSee, type Section } from '../types'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string
        role: import('../types').Role
        name: string
        email: string
      }
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' })
  }

  const token = header.slice('Bearer '.length)
  try {
    const payload = verifyToken(token)
    req.user = { id: payload.sub, role: payload.role, name: payload.name, email: payload.email }
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' })
  }
}

export function requireSection(section: Section) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !canSee(req.user.role, section)) {
      return res.status(403).json({ error: 'You do not have access to this section.' })
    }
    next()
  }
}
