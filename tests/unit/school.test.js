/**
 * School Manager Unit Tests
 */

// Mock dependencies
const mockMongoModels = {
    school: {
        findOne: jest.fn(),
        find: jest.fn(),
        countDocuments: jest.fn(),
        findOneAndUpdate: jest.fn()
    }
};

const mockValidators = {
    school: {
        createSchool: jest.fn(),
        getSchool: jest.fn(),
        updateSchool: jest.fn(),
        deleteSchool: jest.fn()
    }
};

// Import School manager
const School = require('../../managers/entities/school/School.manager');

describe('School Manager', () => {
    let schoolManager;

    beforeEach(() => {
        jest.clearAllMocks();

        schoolManager = new School({
            config: {},
            managers: {
                responseDispatcher: { dispatch: jest.fn() }
            },
            validators: mockValidators,
            mongomodels: mockMongoModels
        });
    });

    describe('createSchool', () => {
        it('should return validation errors if validation fails', async () => {
            mockValidators.school.createSchool.mockResolvedValue([{ field: 'name', error: 'required' }]);

            const result = await schoolManager.createSchool({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                name: ''
            });

            expect(result.errors).toBeDefined();
        });

        it('should return error if school name already exists', async () => {
            mockValidators.school.createSchool.mockResolvedValue(null);
            mockMongoModels.school.findOne.mockResolvedValue({ name: 'Test School' });

            const result = await schoolManager.createSchool({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                name: 'Test School',
                address: '123 Main St'
            });

            expect(result.error).toBe('School with this name already exists');
            expect(result.code).toBe(400);
        });
    });

    describe('getSchool', () => {
        it('should return validation errors if id is invalid', async () => {
            mockValidators.school.getSchool.mockResolvedValue([{ field: 'id', error: 'invalid' }]);

            const result = await schoolManager.getSchool({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'invalid'
            });

            expect(result.errors).toBeDefined();
        });

        it('should return error if school not found', async () => {
            mockValidators.school.getSchool.mockResolvedValue(null);
            mockMongoModels.school.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue(null)
            });

            const result = await schoolManager.getSchool({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: '507f1f77bcf86cd799439011'
            });

            expect(result.error).toBe('School not found');
            expect(result.code).toBe(404);
        });
    });

    describe('getSchools', () => {
        it('should return paginated list of schools', async () => {
            const mockSchools = [
                { _id: 'school1', name: 'School 1', createdAt: new Date() },
                { _id: 'school2', name: 'School 2', createdAt: new Date() }
            ];

            mockMongoModels.school.find.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockSchools)
            });
            mockMongoModels.school.countDocuments.mockResolvedValue(2);

            const result = await schoolManager.getSchools({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                __pagination: { page: 1, limit: 10, skip: 0, sort: { createdAt: -1 } }
            });

            expect(result.schools).toHaveLength(2);
            expect(result.pagination.total).toBe(2);
        });
    });

    describe('deleteSchool', () => {
        it('should return error if school not found', async () => {
            mockValidators.school.deleteSchool.mockResolvedValue(null);
            mockMongoModels.school.findOneAndUpdate.mockResolvedValue(null);

            const result = await schoolManager.deleteSchool({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: '507f1f77bcf86cd799439011'
            });

            expect(result.error).toBe('School not found');
            expect(result.code).toBe(404);
        });

        it('should soft delete school successfully', async () => {
            mockValidators.school.deleteSchool.mockResolvedValue(null);
            mockMongoModels.school.findOneAndUpdate.mockResolvedValue({
                _id: 'school123',
                isDeleted: true,
                deletedAt: new Date()
            });

            const result = await schoolManager.deleteSchool({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: '507f1f77bcf86cd799439011'
            });

            expect(result.message).toBe('School deleted successfully');
        });
    });
});
