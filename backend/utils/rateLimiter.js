// Simple in-memory rate limiter
// key: usually req.ip
// limit: max requests
// windowMs: time window in milliseconds

const requests = new Map();

function rateLimiter(key, limit, windowMs) {
  const now = Date.now();
  const windowStart = now - windowMs;

  const timestamps = requests.get(key) || [];

  // Keep only requests inside the window
  const recent = timestamps.filter(ts => ts > windowStart);

  if (recent.length >= limit) {
    return false; // rate limited
  }

  recent.push(now);
  requests.set(key, recent);

  return true; // allowed
}

module.exports = rateLimiter;
