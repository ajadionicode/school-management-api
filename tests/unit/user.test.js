/**
 * User Manager Unit Tests
 */

const bcrypt = require('bcrypt');

// Mock user save function
const mockUserSave = jest.fn();

// Mock dependencies
const mockMongoModels = {
    user: jest.fn().mockImplementation(function(data) {
        return {
            ...data,
            _id: 'new-user-id',
            createdAt: new Date(),
            save: mockUserSave.mockResolvedValue({
                _id: 'new-user-id',
                ...data,
                createdAt: new Date()
            })
        };
    }),
    school: {
        findOne: jest.fn()
    }
};

// Add static methods to the user mock
mockMongoModels.user.findOne = jest.fn();
mockMongoModels.user.find = jest.fn();
mockMongoModels.user.countDocuments = jest.fn();
mockMongoModels.user.findOneAndUpdate = jest.fn();

const mockTokenManager = {
    genLongToken: jest.fn().mockReturnValue('mock-long-token')
};

const mockValidators = {
    user: {
        createUser: jest.fn()
    }
};

// Import User manager
const User = require('../../managers/entities/user/User.manager');

describe('User Manager', () => {
    let userManager;

    beforeEach(() => {
        jest.clearAllMocks();

        userManager = new User({
            config: {},
            managers: {
                token: mockTokenManager,
                responseDispatcher: { dispatch: jest.fn() }
            },
            validators: mockValidators,
            mongomodels: mockMongoModels
        });
    });

    describe('createUser', () => {
        it('should return validation errors if validation fails', async () => {
            mockValidators.user.createUser.mockResolvedValue([{ field: 'email', error: 'required' }]);

            const result = await userManager.createUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                username: 'newuser'
            });

            expect(result.errors).toBeDefined();
        });

        it('should return error if username already exists', async () => {
            mockValidators.user.createUser.mockResolvedValue(null);
            mockMongoModels.user.findOne.mockResolvedValue({ username: 'existinguser' });

            const result = await userManager.createUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                username: 'existinguser',
                email: 'new@example.com',
                password: 'Password123',
                role: 'superadmin'
            });

            expect(result.error).toBe('Username already exists');
            expect(result.code).toBe(400);
        });

        it('should return error if email already exists', async () => {
            mockValidators.user.createUser.mockResolvedValue(null);
            mockMongoModels.user.findOne.mockResolvedValue({
                username: 'otheruser',
                email: 'existing@example.com'
            });

            const result = await userManager.createUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                username: 'newuser',
                email: 'existing@example.com',
                password: 'Password123',
                role: 'superadmin'
            });

            expect(result.error).toBe('Email already exists');
            expect(result.code).toBe(400);
        });

        it('should return error if schoolId is missing for school_admin role', async () => {
            mockValidators.user.createUser.mockResolvedValue(null);
            mockMongoModels.user.findOne.mockResolvedValue(null);

            const result = await userManager.createUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                username: 'schooladmin',
                email: 'admin@school.com',
                password: 'Password123',
                role: 'school_admin'
            });

            expect(result.error).toBe('schoolId is required for school_admin role');
            expect(result.code).toBe(400);
        });

        it('should return error if school not found for school_admin', async () => {
            mockValidators.user.createUser.mockResolvedValue(null);
            mockMongoModels.user.findOne.mockResolvedValue(null);
            mockMongoModels.school.findOne.mockResolvedValue(null);

            const result = await userManager.createUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                username: 'schooladmin',
                email: 'admin@school.com',
                password: 'Password123',
                role: 'school_admin',
                schoolId: 'nonexistent-school'
            });

            expect(result.error).toBe('School not found');
            expect(result.code).toBe(404);
        });

        it('should create superadmin user successfully', async () => {
            mockValidators.user.createUser.mockResolvedValue(null);
            mockMongoModels.user.findOne.mockResolvedValue(null);

            const result = await userManager.createUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                username: 'newsuperadmin',
                email: 'super@example.com',
                password: 'Password123',
                role: 'superadmin'
            });

            expect(result.user).toBeDefined();
            expect(result.user.username).toBe('newsuperadmin');
            expect(result.user.role).toBe('superadmin');
            expect(result.longToken).toBe('mock-long-token');
        });

        it('should create school_admin user successfully', async () => {
            mockValidators.user.createUser.mockResolvedValue(null);
            mockMongoModels.user.findOne.mockResolvedValue(null);
            mockMongoModels.school.findOne.mockResolvedValue({ _id: 'school123', name: 'Test School' });

            const result = await userManager.createUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                username: 'schooladmin',
                email: 'admin@school.com',
                password: 'Password123',
                role: 'school_admin',
                schoolId: 'school123'
            });

            expect(result.user).toBeDefined();
            expect(result.user.username).toBe('schooladmin');
            expect(result.user.role).toBe('school_admin');
            expect(result.user.schoolId).toBe('school123');
        });
    });

    describe('getUser', () => {
        it('should return error if user ID is missing', async () => {
            const result = await userManager.getUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true }
            });

            expect(result.error).toBe('User ID is required');
            expect(result.code).toBe(400);
        });

        it('should return error if user not found', async () => {
            mockMongoModels.user.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue(null)
            });

            const result = await userManager.getUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'nonexistent-user'
            });

            expect(result.error).toBe('User not found');
            expect(result.code).toBe(404);
        });

        it('should return user successfully', async () => {
            mockMongoModels.user.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue({
                    _id: 'user123',
                    username: 'testuser',
                    email: 'test@example.com',
                    role: 'school_admin',
                    schoolId: { _id: 'school123', name: 'Test School' },
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
            });

            const result = await userManager.getUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'user123'
            });

            expect(result.user).toBeDefined();
            expect(result.user.username).toBe('testuser');
        });
    });

    describe('getUsers', () => {
        it('should return paginated list of users', async () => {
            const mockUsers = [
                { _id: 'u1', username: 'user1', email: 'u1@test.com', role: 'superadmin', createdAt: new Date() },
                { _id: 'u2', username: 'user2', email: 'u2@test.com', role: 'school_admin', createdAt: new Date() }
            ];

            mockMongoModels.user.find.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockUsers)
            });
            mockMongoModels.user.countDocuments.mockResolvedValue(2);

            const result = await userManager.getUsers({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                __pagination: { page: 1, limit: 10, skip: 0, sort: { createdAt: -1 } }
            });

            expect(result.users).toHaveLength(2);
            expect(result.pagination.total).toBe(2);
        });

        it('should filter users by role', async () => {
            mockMongoModels.user.find.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([
                    { _id: 'u1', username: 'admin1', role: 'superadmin', createdAt: new Date() }
                ])
            });
            mockMongoModels.user.countDocuments.mockResolvedValue(1);

            const result = await userManager.getUsers({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                __pagination: { page: 1, limit: 10, skip: 0, sort: { createdAt: -1 } },
                role: 'superadmin'
            });

            expect(result.users).toHaveLength(1);
        });
    });

    describe('updateUser', () => {
        it('should return error if user ID is missing', async () => {
            const result = await userManager.updateUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                username: 'newname'
            });

            expect(result.error).toBe('User ID is required');
            expect(result.code).toBe(400);
        });

        it('should return error if user not found', async () => {
            mockMongoModels.user.findOne.mockResolvedValue(null);

            const result = await userManager.updateUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'nonexistent-user',
                username: 'newname'
            });

            expect(result.error).toBe('User not found');
            expect(result.code).toBe(404);
        });

        it('should return error for duplicate username', async () => {
            mockMongoModels.user.findOne
                .mockResolvedValueOnce({ _id: 'user123', username: 'oldname' }) // First call - find user
                .mockResolvedValueOnce({ _id: 'other-user', username: 'existingname' }); // Second call - check duplicate

            const result = await userManager.updateUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'user123',
                username: 'existingname'
            });

            expect(result.error).toBe('Username already exists');
            expect(result.code).toBe(400);
        });

        it('should update user successfully', async () => {
            mockMongoModels.user.findOne
                .mockResolvedValueOnce({ _id: 'user123', username: 'oldname' })
                .mockResolvedValueOnce(null); // No duplicate
            mockMongoModels.user.findOneAndUpdate.mockReturnValue({
                populate: jest.fn().mockResolvedValue({
                    _id: 'user123',
                    username: 'newname',
                    email: 'test@example.com',
                    role: 'school_admin',
                    schoolId: { _id: 'school123', name: 'Test School' },
                    updatedAt: new Date()
                })
            });

            const result = await userManager.updateUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'user123',
                username: 'newname'
            });

            expect(result.user).toBeDefined();
            expect(result.user.username).toBe('newname');
        });

        it('should clear schoolId when changing role to superadmin', async () => {
            mockMongoModels.user.findOne
                .mockResolvedValueOnce({ _id: 'user123', username: 'admin', role: 'school_admin' })
                .mockResolvedValueOnce(null);
            mockMongoModels.user.findOneAndUpdate.mockReturnValue({
                populate: jest.fn().mockResolvedValue({
                    _id: 'user123',
                    username: 'admin',
                    role: 'superadmin',
                    schoolId: null,
                    updatedAt: new Date()
                })
            });

            const result = await userManager.updateUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'user123',
                role: 'superadmin'
            });

            expect(result.user).toBeDefined();
            expect(result.user.role).toBe('superadmin');
            expect(result.user.school).toBeNull();
        });
    });

    describe('deleteUser', () => {
        it('should return error if user ID is missing', async () => {
            const result = await userManager.deleteUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true }
            });

            expect(result.error).toBe('User ID is required');
            expect(result.code).toBe(400);
        });

        it('should return error when trying to delete own account', async () => {
            const result = await userManager.deleteUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'admin123'
            });

            expect(result.error).toBe('Cannot delete your own account');
            expect(result.code).toBe(400);
        });

        it('should return error if user not found', async () => {
            mockMongoModels.user.findOneAndUpdate.mockResolvedValue(null);

            const result = await userManager.deleteUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'nonexistent-user'
            });

            expect(result.error).toBe('User not found');
            expect(result.code).toBe(404);
        });

        it('should soft delete user successfully', async () => {
            mockMongoModels.user.findOne.mockResolvedValue({
                _id: 'user123',
                isDeleted: false,
                isSeeded: false
            });
            mockMongoModels.user.findOneAndUpdate.mockResolvedValue({
                _id: 'user123',
                isDeleted: true,
                deletedAt: new Date()
            });

            const result = await userManager.deleteUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'user123'
            });

            expect(result.message).toBe('User deleted successfully');
        });

        it('should return 403 when trying to delete seeded account', async () => {
            mockMongoModels.user.findOne.mockResolvedValue({
                _id: 'seeded-admin',
                isDeleted: false,
                isSeeded: true
            });

            const result = await userManager.deleteUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'seeded-admin'
            });

            expect(result.error).toBe('Cannot delete this account');
            expect(result.code).toBe(403);
        });
    });

    describe('seeded account protection', () => {
        it('should return 403 when trying to update seeded account', async () => {
            mockMongoModels.user.findOne.mockResolvedValue({
                _id: 'seeded-admin',
                username: 'superadmin',
                isDeleted: false,
                isSeeded: true
            });

            const result = await userManager.updateUser({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'seeded-admin',
                username: 'newname'
            });

            expect(result.error).toBe('Cannot modify this account');
            expect(result.code).toBe(403);
        });
    });
});
