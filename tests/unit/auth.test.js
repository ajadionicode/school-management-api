/**
 * Auth Manager Unit Tests
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock dependencies
const mockMongoModels = {
    user: {
        findOne: jest.fn(),
        updateOne: jest.fn()
    }
};

const mockTokenManager = {
    genLongToken: jest.fn(),
    genShortToken: jest.fn()
};

const mockCache = {
    key: {
        get: jest.fn(),
        set: jest.fn()
    }
};

const mockConfig = {
    dotEnv: {
        LONG_TOKEN_SECRET: 'test-long-secret',
        SHORT_TOKEN_SECRET: 'test-short-secret',
        MAX_LOGIN_ATTEMPTS: '5',
        LOCKOUT_DURATION_MS: '900000'
    }
};

// Import Auth manager
const Auth = require('../../managers/auth/Auth.manager');

describe('Auth Manager', () => {
    let authManager;

    beforeEach(() => {
        jest.clearAllMocks();

        authManager = new Auth({
            config: mockConfig,
            cache: mockCache,
            managers: {
                token: mockTokenManager,
                responseDispatcher: { dispatch: jest.fn() }
            },
            validators: {},
            mongomodels: mockMongoModels
        });
    });

    describe('login', () => {
        it('should return error if username is missing', async () => {
            const result = await authManager.login({
                password: 'password123',
                __device: {}
            });

            expect(result.error).toBe('Username and password are required');
            expect(result.code).toBe(400);
        });

        it('should return error if password is missing', async () => {
            const result = await authManager.login({
                username: 'testuser',
                __device: {}
            });

            expect(result.error).toBe('Username and password are required');
            expect(result.code).toBe(400);
        });

        it('should return error for invalid credentials (user not found)', async () => {
            mockMongoModels.user.findOne.mockResolvedValue(null);

            const result = await authManager.login({
                username: 'nonexistent',
                password: 'password123',
                __device: {}
            });

            expect(result.error).toBe('Invalid credentials');
            expect(result.code).toBe(401);
        });

        it('should return error for wrong password', async () => {
            const hashedPassword = await bcrypt.hash('correctpassword', 10);
            mockMongoModels.user.findOne.mockResolvedValue({
                _id: 'user123',
                username: 'testuser',
                email: 'test@example.com',
                password: hashedPassword,
                role: 'superadmin',
                schoolId: null,
                failedLoginAttempts: 0
            });
            mockMongoModels.user.updateOne.mockResolvedValue({});

            const result = await authManager.login({
                username: 'testuser',
                password: 'wrongpassword',
                __device: {}
            });

            expect(result.error).toContain('Invalid credentials');
            expect(result.code).toBe(401);
        });

        it('should return tokens for valid credentials', async () => {
            const hashedPassword = await bcrypt.hash('correctpassword', 10);
            mockMongoModels.user.findOne.mockResolvedValue({
                _id: 'user123',
                username: 'testuser',
                email: 'test@example.com',
                password: hashedPassword,
                role: 'superadmin',
                schoolId: null
            });
            mockMongoModels.user.updateOne.mockResolvedValue({});

            mockTokenManager.genLongToken.mockReturnValue('long-token-123');
            mockTokenManager.genShortToken.mockReturnValue('short-token-123');

            const result = await authManager.login({
                username: 'testuser',
                password: 'correctpassword',
                __device: { ip: '127.0.0.1' }
            });

            expect(result.user).toBeDefined();
            expect(result.user.username).toBe('testuser');
            expect(result.longToken).toBe('long-token-123');
            expect(result.shortToken).toBe('short-token-123');
        });
    });

    describe('login - account lockout', () => {
        it('should show remaining attempts after failed login', async () => {
            const hashedPassword = await bcrypt.hash('correctpassword', 10);
            mockMongoModels.user.findOne.mockResolvedValue({
                _id: 'user123',
                username: 'testuser',
                password: hashedPassword,
                failedLoginAttempts: 2
            });
            mockMongoModels.user.updateOne.mockResolvedValue({});

            const result = await authManager.login({
                username: 'testuser',
                password: 'wrongpassword',
                __device: {}
            });

            expect(result.error).toContain('attempt(s) remaining');
            expect(result.code).toBe(401);
        });

        it('should lock account after 5 failed attempts', async () => {
            const hashedPassword = await bcrypt.hash('correctpassword', 10);
            mockMongoModels.user.findOne.mockResolvedValue({
                _id: 'user123',
                username: 'testuser',
                password: hashedPassword,
                failedLoginAttempts: 4
            });
            mockMongoModels.user.updateOne.mockResolvedValue({});

            const result = await authManager.login({
                username: 'testuser',
                password: 'wrongpassword',
                __device: {}
            });

            expect(result.error).toContain('Account locked');
            expect(result.code).toBe(401);
        });

        it('should reject login while account is locked', async () => {
            const hashedPassword = await bcrypt.hash('correctpassword', 10);
            mockMongoModels.user.findOne.mockResolvedValue({
                _id: 'user123',
                username: 'testuser',
                password: hashedPassword,
                failedLoginAttempts: 5,
                lockoutUntil: new Date(Date.now() + 900000) // 15 min from now
            });

            const result = await authManager.login({
                username: 'testuser',
                password: 'correctpassword',
                __device: {}
            });

            expect(result.error).toContain('Account is locked');
            expect(result.code).toBe(401);
        });

        it('should allow login after lockout expires', async () => {
            const hashedPassword = await bcrypt.hash('correctpassword', 10);
            mockMongoModels.user.findOne.mockResolvedValue({
                _id: 'user123',
                username: 'testuser',
                email: 'test@example.com',
                password: hashedPassword,
                role: 'superadmin',
                failedLoginAttempts: 5,
                lockoutUntil: new Date(Date.now() - 1000) // Expired 1 second ago
            });
            mockMongoModels.user.updateOne.mockResolvedValue({});
            mockTokenManager.genLongToken.mockReturnValue('long-token-123');
            mockTokenManager.genShortToken.mockReturnValue('short-token-123');

            const result = await authManager.login({
                username: 'testuser',
                password: 'correctpassword',
                __device: {}
            });

            expect(result.user).toBeDefined();
            expect(result.longToken).toBe('long-token-123');
        });
    });

    describe('refreshToken', () => {
        it('should return new short token with valid long token', async () => {
            mockMongoModels.user.findOne.mockResolvedValue({
                _id: 'user123',
                isDeleted: false
            });
            mockTokenManager.genShortToken.mockReturnValue('new-short-token');

            const result = await authManager.refreshToken({
                __longToken: {
                    userId: 'user123',
                    userKey: 'user123',
                    role: 'superadmin',
                    schoolId: null
                },
                __device: { ip: '127.0.0.1' }
            });

            expect(result.shortToken).toBe('new-short-token');
        });

        it('should return 401 if long token is missing', async () => {
            const result = await authManager.refreshToken({
                __device: {}
            });

            expect(result.error).toBe('Long token is required');
            expect(result.code).toBe(401);
        });

        it('should return 401 if user is deleted', async () => {
            mockMongoModels.user.findOne.mockResolvedValue(null);

            const result = await authManager.refreshToken({
                __longToken: {
                    userId: 'user123',
                    userKey: 'user123',
                    role: 'superadmin'
                },
                __device: {}
            });

            expect(result.error).toBe('User not found');
            expect(result.code).toBe(401);
        });
    });

    describe('logout', () => {
        it('should invalidate session in Redis', async () => {
            mockCache.key.set.mockResolvedValue(true);

            const result = await authManager.logout({
                __schoolToken: {
                    userId: 'user123',
                    sessionId: 'session-123'
                }
            });

            expect(result.message).toBe('Logged out successfully');
            expect(result.code).toBe(204);
            expect(mockCache.key.set).toHaveBeenCalledWith({
                key: 'invalidated:session:session-123',
                data: '1',
                ttl: 365 * 24 * 60 * 60
            });
        });

        it('should return 401 if not authenticated', async () => {
            const result = await authManager.logout({});

            expect(result.error).toBe('Authentication required');
            expect(result.code).toBe(401);
        });
    });

    describe('me', () => {
        it('should return user profile for authenticated user', async () => {
            mockMongoModels.user.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue({
                    _id: 'user123',
                    username: 'testuser',
                    email: 'test@example.com',
                    role: 'superadmin',
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
            });

            const result = await authManager.me({
                __schoolToken: { userId: 'user123' }
            });

            expect(result.user).toBeDefined();
            expect(result.user.username).toBe('testuser');
            expect(result.user.email).toBe('test@example.com');
        });

        it('should include school info for school_admin', async () => {
            mockMongoModels.user.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue({
                    _id: 'user123',
                    username: 'schooladmin',
                    email: 'admin@school.com',
                    role: 'school_admin',
                    schoolId: { _id: 'school123', name: 'Test School' },
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
            });

            const result = await authManager.me({
                __schoolToken: { userId: 'user123' }
            });

            expect(result.user.school).toBeDefined();
            expect(result.user.school.name).toBe('Test School');
        });

        it('should return 401 if not authenticated', async () => {
            const result = await authManager.me({});

            expect(result.error).toBe('Authentication required');
            expect(result.code).toBe(401);
        });

        it('should return 404 if user not found', async () => {
            mockMongoModels.user.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue(null)
            });

            const result = await authManager.me({
                __schoolToken: { userId: 'deleted-user' }
            });

            expect(result.error).toBe('User not found');
            expect(result.code).toBe(404);
        });
    });

    describe('changePassword', () => {
        it('should return error if currentPassword is missing', async () => {
            const result = await authManager.changePassword({
                __schoolToken: { userId: 'user123' },
                newPassword: 'newpassword123'
            });

            expect(result.error).toBe('Current password and new password are required');
            expect(result.code).toBe(400);
        });

        it('should return error if newPassword is too short', async () => {
            const result = await authManager.changePassword({
                __schoolToken: { userId: 'user123' },
                currentPassword: 'oldpassword',
                newPassword: 'short'
            });

            expect(result.error).toBe('New password must be at least 8 characters long');
            expect(result.code).toBe(400);
        });

        it('should return error if password lacks complexity', async () => {
            const result = await authManager.changePassword({
                __schoolToken: { userId: 'user123' },
                currentPassword: 'oldpassword',
                newPassword: 'alllowercase'
            });

            expect(result.error).toContain('uppercase');
            expect(result.code).toBe(400);
        });

        it('should change password successfully', async () => {
            const hashedPassword = await bcrypt.hash('OldPassword1', 10);
            mockMongoModels.user.findOne.mockResolvedValue({
                _id: 'user123',
                password: hashedPassword,
                isDeleted: false
            });
            mockMongoModels.user.updateOne.mockResolvedValue({});

            const result = await authManager.changePassword({
                __schoolToken: { userId: 'user123' },
                currentPassword: 'OldPassword1',
                newPassword: 'NewPassword1'
            });

            expect(result.message).toBe('Password changed successfully');
        });

        it('should return error for incorrect current password', async () => {
            const hashedPassword = await bcrypt.hash('correctpassword', 10);
            mockMongoModels.user.findOne.mockResolvedValue({
                _id: 'user123',
                password: hashedPassword,
                isDeleted: false
            });

            const result = await authManager.changePassword({
                __schoolToken: { userId: 'user123' },
                currentPassword: 'wrongpassword',
                newPassword: 'NewPassword1'
            });

            expect(result.error).toBe('Current password is incorrect');
            expect(result.code).toBe(401);
        });

        it('should return 403 for seeded account password change', async () => {
            mockMongoModels.user.findOne.mockResolvedValue({
                _id: 'seeded-admin',
                password: 'hashed',
                isDeleted: false,
                isSeeded: true
            });

            const result = await authManager.changePassword({
                __schoolToken: { userId: 'seeded-admin' },
                currentPassword: 'OldPassword1',
                newPassword: 'NewPassword1'
            });

            expect(result.error).toBe('Cannot change password for this account');
            expect(result.code).toBe(403);
        });
    });
});
