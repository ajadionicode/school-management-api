/**
 * Rate Limiting Middleware
 *
 * Provides two rate limit tiers:
 * - Global: 100 requests per 15-minute window (configurable via RATE_LIMIT_GLOBAL)
 * - Auth endpoints: 5 requests per 15-minute window (configurable via RATE_LIMIT_AUTH)
 *
 * Uses Redis for distributed rate limiting across multiple instances
 */

module.exports = ({ meta, config, cache, managers }) => {
    const WINDOW_MS = parseInt(config.dotEnv.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
    const WINDOW_SECONDS = Math.ceil(WINDOW_MS / 1000);
    const GLOBAL_LIMIT = parseInt(config.dotEnv.RATE_LIMIT_GLOBAL) || 100;
    const AUTH_LIMIT = parseInt(config.dotEnv.RATE_LIMIT_AUTH) || 5;

    return async ({ req, res, next, results }) => {
        const clientIp = results.__device.ip

        const moduleName = req.params?.moduleName || '';
        const fnName = req.params?.fnName || '';

        const isAuthEndpoint = moduleName === 'auth' &&
            ['login', 'refreshToken', 'logout'].includes(fnName);

        const limit = isAuthEndpoint ? AUTH_LIMIT : GLOBAL_LIMIT;
        const keyPrefix = isAuthEndpoint ? 'ratelimit:auth:' : 'ratelimit:global:';
        const key = `${keyPrefix}${clientIp}`;

        // Get current count from Redis
        let currentCount = await cache.key.get({ key });
        currentCount = parseInt(currentCount) || 0;

        currentCount++;

        await cache.key.set({
            key,
            data: currentCount.toString(),
            ttl: WINDOW_SECONDS
        });

        // Calculate remaining and reset time
        const remaining = Math.max(0, limit - currentCount);
        const now = Date.now();
        const resetAt = now + WINDOW_MS;
        const resetAtSeconds = Math.ceil(resetAt / 1000);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', resetAtSeconds);

        // Check if rate limit exceeded
        if (currentCount > limit) {
            const retryAfterSeconds = WINDOW_SECONDS;
            res.setHeader('Retry-After', retryAfterSeconds);

            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 429,
                errors: `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds`
            });
        }

        return next({ rateLimit: { limit, remaining, reset: resetAt } });
    };
};
