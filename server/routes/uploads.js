import { Router } from 'express';
import express from 'express';
import { query } from '../db/index.js';

const router = Router();

const ALLOWED = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif',
]);
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

// POST raw image bytes (Content-Type is the image mime). Returns { id, url }.
// express.json (app-wide) ignores non-JSON content-types, so the raw body
// survives to this route's express.raw parser.
router.post('/', express.raw({ type: () => true, limit: '20mb' }), async (req, res, next) => {
  try {
    const mime = (req.get('Content-Type') || '').split(';')[0].trim();
    if (!ALLOWED.has(mime)) return res.status(415).json({ error: 'unsupported media type' });
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) return res.status(400).json({ error: 'empty body' });
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'image too large (max 20MB)' });

    const { rows } = await query(
      'INSERT INTO attachments (mime, bytes, size, user_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [mime, buf, buf.length, req.userId],
    );
    res.status(201).json({ id: rows[0].id, url: `/api/uploads/${rows[0].id}` });
  } catch (e) { next(e); }
});

// GET the image bytes. Same-origin <img> requests carry the auth cookie, so
// requireAuth (mounted in index.js) still protects these, and we scope to the
// owner so one account can't fetch another's attachment by guessing an id.
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT mime, bytes FROM attachments WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!rows[0]) return res.status(404).end();
    res.set('Content-Type', rows[0].mime);
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    res.send(rows[0].bytes);
  } catch (e) { next(e); }
});

export default router;
