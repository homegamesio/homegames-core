/**
 * IP-based rate limiter for HTTP APIs.
 *
 * Uses a sliding window counter per IP address. Automatically evicts
 * stale entries to prevent memory growth.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60000, max: 10 });
 *   if (!limiter.allow(ipAddress)) {
 *       res.writeHead(429); res.end('Too many requests');
 *       return;
 *   }
 */

const createRateLimiter = ({ windowMs = 60000, max = 60 } = {}) => {
    // Map of IP -> { count, windowStart }
    const clients = new Map();

    // Evict stale entries every 60 seconds to prevent memory growth
    const evictInterval = setInterval(() => {
        const now = Date.now();
        for (const [ip, entry] of clients) {
            if (now - entry.windowStart > windowMs * 2) {
                clients.delete(ip);
            }
        }
    }, 60000);

    // Don't let the interval keep the process alive
    if (evictInterval.unref) evictInterval.unref();

    return {
        /**
         * Check if a request from this IP should be allowed.
         * @param {string} ip
         * @returns {boolean}
         */
        allow(ip) {
            const now = Date.now();
            let entry = clients.get(ip);

            const isNew = !entry || now - entry.windowStart > windowMs;
            if (isNew) {
                entry = { count: 0, windowStart: now };
                clients.set(ip, entry);
            }

            entry.count++;
            return entry.count <= max;
        },

        /**
         * Get remaining requests for an IP in the current window.
         * @param {string} ip
         * @returns {number}
         */
        remaining(ip) {
            const entry = clients.get(ip);
            if (!entry || Date.now() - entry.windowStart > windowMs) return max;
            return Math.max(0, max - entry.count);
        },

        /** Number of tracked IPs (for monitoring). */
        get size() {
            return clients.size;
        },
    };
};

module.exports = { createRateLimiter };
