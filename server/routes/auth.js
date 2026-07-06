import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../db/index.js';

const router = Router();
const googleClient = new OAuth2Client();
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

function issue(res, user) {
  const token = jwt.sign({ sub: String(user.id) }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.cookie('token', token, cookieOpts());
  return { id: user.id, email: user.email, name: user.name };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim() || email.split('@')[0];
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const taken = await query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (taken.rowCount) return res.status(409).json({ error: 'That email is already registered.' });

    const hash = await bcrypt.hash(password, 10);
    const user = (await query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hash, name],
    )).rows[0];
    res.status(201).json(issue(res, user));
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    // Accept `email`; also accept `username` for the legacy owner login.
    const identifier = String(req.body?.email || req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!identifier || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const user = (await query('SELECT id, email, name, password_hash FROM users WHERE email = $1', [identifier])).rows[0];
    // Constant-ish time: always run a compare so a missing user doesn't leak via timing.
    const hash = user?.password_hash || '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
    const ok = await bcrypt.compare(password, hash);
    if (!user || !user.password_hash || !ok) return res.status(401).json({ error: 'Invalid email or password.' });

    res.json(issue(res, user));
  } catch (e) { next(e); }
});

// Sign in with Google. The client sends the ID token ("credential") from Google
// Identity Services; we verify its signature against Google's keys, then link
// or create a local user. No client secret needed — this is the SPA flow.
router.post('/google', async (req, res, next) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(501).json({ error: 'Google sign-in is not configured.' });

    const credential = String(req.body?.credential || '');
    if (!credential) return res.status(400).json({ error: 'Missing Google credential.' });

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ error: 'Invalid Google credential.' });
    }
    if (!payload?.email || !payload.email_verified) {
      return res.status(401).json({ error: 'Your Google email is not verified.' });
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const name = payload.name || email.split('@')[0];

    // Prefer matching on google_id; otherwise link Google to an existing
    // email/password account, or create a fresh Google-only account.
    let user = (await query('SELECT id, email, name FROM users WHERE google_id = $1', [googleId])).rows[0];
    if (!user) {
      const byEmail = (await query('SELECT id, email, name FROM users WHERE email = $1', [email])).rows[0];
      if (byEmail) {
        await query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, byEmail.id]);
        user = byEmail;
      } else {
        user = (await query(
          'INSERT INTO users (email, name, google_id) VALUES ($1, $2, $3) RETURNING id, email, name',
          [email, name, googleId],
        )).rows[0];
      }
    }
    res.json(issue(res, user));
  } catch (e) { next(e); }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = (await query('SELECT id, email, name FROM users WHERE id = $1', [Number(decoded.sub)])).rows[0];
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    res.json(user);
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
});

export default router;
