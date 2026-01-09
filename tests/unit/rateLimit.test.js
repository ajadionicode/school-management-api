/**
 * Rate Limiting Middleware Unit Tests
 */

// Mock dependencies
const mockCache = {
    key: {
        get: jest.fn(),
        set: jest.fn()
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
    });

    describe('rate limit headers', () => {
        it('should set X-RateLimit headers', async () => {
            mockCache.key.get.mockResolvedValue(null);
            mockCache.key.set.mockResolvedValue(true);

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
        });

        it('should pass rate limit info to next middleware', async () => {
            mockCache.key.get.mockResolvedValue(null);
            mockCache.key.set.mockResolvedValue(true);

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
            mockCache.key.get.mockResolvedValue('50'); // 50 previous requests
            mockCache.key.set.mockResolvedValue(true);

            const result = await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(result.continued).toBe(true);
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 49);
        });

        it('should return 429 when global limit is exceeded', async () => {
            mockCache.key.get.mockResolvedValue('100'); // Already at limit
            mockCache.key.set.mockResolvedValue(true);

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
            mockCache.key.get.mockResolvedValue('100');
            mockCache.key.set.mockResolvedValue(true);

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', 900);
        });

        it('should use correct Redis key for global requests', async () => {
            mockCache.key.get.mockResolvedValue(null);
            mockCache.key.set.mockResolvedValue(true);

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.key.get).toHaveBeenCalledWith({ key: 'ratelimit:global:192.168.1.1' });
            expect(mockCache.key.set).toHaveBeenCalledWith({
                key: 'ratelimit:global:192.168.1.1',
                data: '1',
                ttl: 900
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
            mockCache.key.get.mockResolvedValue('3');
            mockCache.key.set.mockResolvedValue(true);

            const result = await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(result.continued).toBe(true);
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 1);
        });

        it('should return 429 when auth limit exceeded', async () => {
            mockCache.key.get.mockResolvedValue('5');
            mockCache.key.set.mockResolvedValue(true);

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
            mockCache.key.get.mockResolvedValue(null);
            mockCache.key.set.mockResolvedValue(true);

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.key.get).toHaveBeenCalledWith({ key: 'ratelimit:auth:192.168.1.1' });
        });

        it('should apply auth limit to refreshToken endpoint', async () => {
            mockReq.params.fnName = 'refreshToken';
            mockCache.key.get.mockResolvedValue(null);
            mockCache.key.set.mockResolvedValue(true);

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.key.get).toHaveBeenCalledWith({ key: 'ratelimit:auth:192.168.1.1' });
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
        });

        it('should apply auth limit to logout endpoint', async () => {
            mockReq.params.fnName = 'logout';
            mockCache.key.get.mockResolvedValue(null);
            mockCache.key.set.mockResolvedValue(true);

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.key.get).toHaveBeenCalledWith({ key: 'ratelimit:auth:192.168.1.1' });
        });
    });

    describe('client IP handling', () => {
        it('should use IP from __device middleware', async () => {
            mockResults.__device = { ip: '10.0.0.1' };
            mockCache.key.get.mockResolvedValue(null);
            mockCache.key.set.mockResolvedValue(true);

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.key.get).toHaveBeenCalledWith({ key: 'ratelimit:global:10.0.0.1' });
        });

        it('should use "N/A" if IP not available', async () => {
            mockResults.__device = { ip: 'N/A' };
            mockCache.key.get.mockResolvedValue(null);
            mockCache.key.set.mockResolvedValue(true);

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.key.get).toHaveBeenCalledWith({ key: 'ratelimit:global:N/A' });
        });

        it('should handle N/A IP from __device middleware', async () => {
            mockResults = { __device: { ip: 'N/A' } };
            mockCache.key.get.mockResolvedValue(null);
            mockCache.key.set.mockResolvedValue(true);

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.key.get).toHaveBeenCalledWith({ key: 'ratelimit:global:N/A' });
        });
    });

    describe('Redis counter management', () => {
        it('should increment counter on each request', async () => {
            mockCache.key.get.mockResolvedValue('10');
            mockCache.key.set.mockResolvedValue(true);

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.key.set).toHaveBeenCalledWith({
                key: 'ratelimit:global:192.168.1.1',
                data: '11',
                ttl: 900
            });
        });

        it('should start from 1 if no existing count', async () => {
            mockCache.key.get.mockResolvedValue(null);
            mockCache.key.set.mockResolvedValue(true);

            await rateLimitMiddleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockCache.key.set).toHaveBeenCalledWith({
                key: 'ratelimit:global:192.168.1.1',
                data: '1',
                ttl: 900
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

            mockCache.key.get.mockResolvedValue(null);
            mockCache.key.set.mockResolvedValue(true);

            await middleware({ req: mockReq, res: mockRes, next: mockNext, results: mockResults });

            expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
        });
    });
});
