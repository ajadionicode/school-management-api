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

        // Atomic increment on a hash field 'count'
        const currentCount = await cache.hash.incrby({ key, field: 'count', incr: 1 });

        if (parseInt(currentCount, 10) === 1) { 
            await cache.key.expire({ key, expire: WINDOW_SECONDS });

            const expiresAt = Date.now() + WINDOW_MS;
            await cache.hash.setField({ key, fieldKey: 'expiresAt', data: String(expiresAt) });
        }

        let expiresAtStr = await cache.hash.getField({ key, fieldKey: 'expiresAt' }); 
        let expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null; 
        const now = Date.now(); 

        // If expiresAt missing for any reason, set a fallback and ensure TTL exists
        if (!expiresAt || Number.isNaN(expiresAt)) { 
            expiresAt = now + WINDOW_MS; 
            await cache.hash.setField({ key, fieldKey: 'expiresAt', data: String(expiresAt) }); 
            await cache.key.expire({ key, expire: WINDOW_SECONDS }); 
        } 

        const remaining = Math.max(0, limit - parseInt(currentCount, 10)); 
        // const resetAtSeconds = Math.ceil(expiresAt / 1000); 
        const retryAfterSeconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', new Date(expiresAt).toUTCString());

        // Check if rate limit exceeded
        if (currentCount > limit) {
            res.setHeader('Retry-After', retryAfterSeconds);

            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 429,
                errors: `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds`
            });
        }

        return next({ rateLimit: { limit, remaining, reset: expiresAt } });
    };
};
