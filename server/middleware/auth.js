import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = Number(decoded.sub);
    req.user = decoded;
    if (!Number.isFinite(req.userId)) return res.status(401).json({ error: 'unauthorized' });
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}
