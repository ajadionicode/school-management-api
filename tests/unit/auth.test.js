/**
 * Auth Manager Unit Tests
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock dependencies
const mockMongoModels = {
    user: {
        findOne: jest.fn()
    }
};

const mockTokenManager = {
    genLongToken: jest.fn(),
    genShortToken: jest.fn()
};

const mockConfig = {
    dotEnv: {
        LONG_TOKEN_SECRET: 'test-long-secret',
        SHORT_TOKEN_SECRET: 'test-short-secret'
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
                schoolId: null
            });

            const result = await authManager.login({
                username: 'testuser',
                password: 'wrongpassword',
                __device: {}
            });

            expect(result.error).toBe('Invalid credentials');
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
    });
});
