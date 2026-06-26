import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export type StaffRole = 'composer';

export interface StaffJwtPayload {
  sub: string;
  role: StaffRole;
}

declare global {
  namespace Express {
    interface Request {
      staff?: StaffJwtPayload;
    }
  }
}

function jwtSecret(): string {
  return process.env.JWT_SECRET || 'dev-composer-secret-change-me';
}

export function signComposerToken(username: string): string {
  return jwt.sign({ sub: username, role: 'composer' as const }, jwtSecret(), { expiresIn: '12h' });
}

export function requireComposerAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing token' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, jwtSecret()) as StaffJwtPayload;
    if (payload.role !== 'composer') {
      res.status(401).json({ message: 'Insufficient role' });
      return;
    }
    req.staff = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}
