import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: THIRTY_DAYS_MS,
    path: '/',
  };
}

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' });
    }

    const adminUser = process.env.ADMIN_USERNAME;
    const adminHash = process.env.ADMIN_PASSWORD_HASH;
    if (!adminUser || !adminHash) {
      return res.status(500).json({ error: 'admin credentials not configured on server' });
    }

    // Compare hash even when username is wrong so timing doesn't reveal which side failed
    const hashOk = await bcrypt.compare(password, adminHash);
    const userOk = username === adminUser;
    if (!hashOk || !userOk) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const token = jwt.sign({ sub: adminUser }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.cookie('token', token, cookieOpts());
    res.json({ username: adminUser });
  } catch (e) { next(e); }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ username: decoded.sub });
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
});

export default router;
