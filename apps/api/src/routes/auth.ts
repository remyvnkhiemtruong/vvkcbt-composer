import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { signComposerToken } from '../auth';

export const authRouter = Router();

authRouter.post('/composer/login', async (req: Request, res: Response) => {
  const username = String(req.body?.username ?? '');
  const password = String(req.body?.password ?? '');
  const expectedUser = process.env.COMPOSER_USER || 'composer';
  const expectedPassword = process.env.COMPOSER_PASSWORD || 'composer123';
  const passwordHash = process.env.COMPOSER_PASSWORD_HASH?.trim();

  if (username !== expectedUser) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  let valid = false;
  if (passwordHash?.startsWith('$2')) {
    valid = await bcrypt.compare(password, passwordHash);
  } else {
    valid = password === expectedPassword;
  }

  if (!valid) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  const token = signComposerToken(username);
  res.json({ token, role: 'composer' });
});
