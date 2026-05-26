/**
 * Simple in-memory rate limiter middleware
 */
const hits = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, entries] of hits.entries()) {
    const valid = entries.filter(e => e.timestamp > now);
    if (valid.length === 0) hits.delete(key);
    else hits.set(key, valid);
  }
}, 5 * 60 * 1000);

function rateLimiter({ windowMs = 60000, max = 10 } = {}) {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    let entries = hits.get(key) || [];
    entries = entries.filter(e => e.timestamp > windowStart);

    if (entries.length >= max) {
      const retryAfter = Math.ceil((entries[0].timestamp + windowMs - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: '请求过于频繁，请稍后再试', retry_after: retryAfter });
    }

    entries.push({ timestamp: now });
    hits.set(key, entries);
    next();
  };
}

module.exports = rateLimiter;
