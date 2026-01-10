/**
 * Rate Limiting Middleware Unit Tests
 */

// Mock dependencies
const mockCache = {
    hash: {
        incrby: jest.fn(),
        setField: jest.fn(),
        getField: jest.fn()
    },
    key: {
        expire: jest.fn()
    }
};

const mockConfig = {
    dotEnv: {
        RATE_LIMIT_WINDOW_MS: '900000', // 15 minutes
        RATE_LIMIT_GLOBAL: '100',
        RATE_LIMIT_AUTH: '5'
    }
};

const mockManagers = {
    responseDispatcher: {
        dispatch: jest.fn()
    }
};

// Import rate limit middleware factory
const rateLimitFactory = require('../../mws/__rateLimit.mw.js');

describe('Rate Limiting Middleware', () => {
    let rateLimitMiddleware;
    let mockReq;
    let mockRes;
    let mockNext;
    let mockResults;

    beforeEach(() => {
        jest.clearAllMocks();

        rateLimitMiddleware = rateLimitFactory({
            meta: {},
            config: mockConfig,
            cache: mockCache,
            managers: mockManagers
        });

        mockReq = {
            params: {
                moduleName: 'school',
                fnName: 'getSchools'
            }
        };

        mockRes = {
            setHeader: jest.fn()
        };

        mockNext = jest.fn().mockImplementation((data) => ({ ...data, continued: true }));

        mockResults = {
            __device: { ip: '192.168.1.1' }
        };

        // Default mock implementations
        mockCache.hash.incrby.mockResolvedValue(1);
        mockCache.hash.setField.mockResolvedValue(true);
        mockCache.hash.getField.mockResolvedValue(String(Date.now() + 900000));
        mockCache.key.expire.mockResolvedValue(true);
    });

    describe('rate limit headers', () => {
        it('should set X-RateLimit headers', async () => {
            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
        });

        it('should pass rate limit info to next middleware', async () => {
            const result = await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockNext).toHaveBeenCalledWith({
                rateLimit: expect.objectContaining({
                    limit: 100,
                    remaining: expect.any(Number),
                    reset: expect.any(Number)
                })
            });
        });
    });

    describe('global rate limit', () => {
        it('should allow requests under the limit', async () => {
            mockCache.hash.incrby.mockResolvedValue(51); // 51st request (under 100)

            const result = await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(result.continued).toBe(true);
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 49);
        });

        it('should return 429 when global limit is exceeded', async () => {
            mockCache.hash.incrby.mockResolvedValue(101); // Over limit

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockManagers.responseDispatcher.dispatch).toHaveBeenCalledWith(
                mockRes,
                expect.objectContaining({
                    ok: false,
                    code: 429,
                    errors: expect.stringContaining('Rate limit exceeded')
                })
            );
        });

        it('should set Retry-After header when limit exceeded', async () => {
            mockCache.hash.incrby.mockResolvedValue(101);
            const futureTime = Date.now() + 900000;
            mockCache.hash.getField.mockResolvedValue(String(futureTime));

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
        });

        it('should use correct Redis key for global requests', async () => {
            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.hash.incrby).toHaveBeenCalledWith({
                key: 'ratelimit:global:192.168.1.1',
                field: 'count',
                incr: 1
            });
        });
    });

    describe('auth endpoint rate limit', () => {
        beforeEach(() => {
            mockReq.params = {
                moduleName: 'auth',
                fnName: 'login'
            };
        });

        it('should use stricter limit for auth endpoints', async () => {
            mockCache.hash.incrby.mockResolvedValue(4); // 4th request

            const result = await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(result.continued).toBe(true);
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 1);
        });

        it('should return 429 when auth limit exceeded', async () => {
            mockCache.hash.incrby.mockResolvedValue(6); // Over auth limit of 5

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockManagers.responseDispatcher.dispatch).toHaveBeenCalledWith(
                mockRes,
                expect.objectContaining({
                    ok: false,
                    code: 429
                })
            );
        });

        it('should use correct Redis key for auth requests', async () => {
            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.hash.incrby).toHaveBeenCalledWith({
                key: 'ratelimit:auth:192.168.1.1',
                field: 'count',
                incr: 1
            });
        });

        it('should apply auth limit to refreshToken endpoint', async () => {
            mockReq.params.fnName = 'refreshToken';

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.hash.incrby).toHaveBeenCalledWith({
                key: 'ratelimit:auth:192.168.1.1',
                field: 'count',
                incr: 1
            });
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
        });

        it('should apply auth limit to logout endpoint', async () => {
            mockReq.params.fnName = 'logout';

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.hash.incrby).toHaveBeenCalledWith({
                key: 'ratelimit:auth:192.168.1.1',
                field: 'count',
                incr: 1
            });
        });
    });

    describe('client IP handling', () => {
        it('should use IP from __device middleware', async () => {
            mockResults.__device = { ip: '10.0.0.1' };

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.hash.incrby).toHaveBeenCalledWith({
                key: 'ratelimit:global:10.0.0.1',
                field: 'count',
                incr: 1
            });
        });

        it('should use "N/A" if IP not available', async () => {
            mockResults.__device = { ip: 'N/A' };

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.hash.incrby).toHaveBeenCalledWith({
                key: 'ratelimit:global:N/A',
                field: 'count',
                incr: 1
            });
        });

        it('should handle N/A IP from __device middleware', async () => {
            mockResults = { __device: { ip: 'N/A' } };

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.hash.incrby).toHaveBeenCalledWith({
                key: 'ratelimit:global:N/A',
                field: 'count',
                incr: 1
            });
        });
    });

    describe('Redis counter management', () => {
        it('should increment counter on each request', async () => {
            mockCache.hash.incrby.mockResolvedValue(11); // Returns new count after increment

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.hash.incrby).toHaveBeenCalledWith({
                key: 'ratelimit:global:192.168.1.1',
                field: 'count',
                incr: 1
            });
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 89);
        });

        it('should set expiry on first request', async () => {
            mockCache.hash.incrby.mockResolvedValue(1); // First request

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.key.expire).toHaveBeenCalledWith({
                key: 'ratelimit:global:192.168.1.1',
                expire: 900
            });
            expect(mockCache.hash.setField).toHaveBeenCalledWith({
                key: 'ratelimit:global:192.168.1.1',
                fieldKey: 'expiresAt',
                data: expect.any(String)
            });
        });
    });

    describe('environment configuration', () => {
        it('should use default values when env vars not set', async () => {
            const middleware = rateLimitFactory({
                meta: {},
                config: { dotEnv: {} },
                cache: mockCache,
                managers: mockManagers
            });

            await middleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
        });
    });
});
