/**
 * School Manager Unit Tests
 */

// Mock school save function
const mockSchoolSave = jest.fn();

// Mock dependencies
const mockMongoModels = {
    school: jest.fn().mockImplementation(function(data) {
        return {
            ...data,
            _id: 'new-school-id',
            createdAt: new Date(),
            save: mockSchoolSave.mockResolvedValue({
                _id: 'new-school-id',
                ...data,
                createdAt: new Date()
            })
        };
    }),
    classroom: {
        find: jest.fn()
    },
    student: {
        find: jest.fn(),
        countDocuments: jest.fn()
    }
};

// Add static methods to the mock
mockMongoModels.school.findOne = jest.fn();
mockMongoModels.school.find = jest.fn();
mockMongoModels.school.countDocuments = jest.fn();
mockMongoModels.school.findOneAndUpdate = jest.fn();

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

        it('should create school successfully', async () => {
            mockValidators.school.createSchool.mockResolvedValue(null);
            mockMongoModels.school.findOne.mockResolvedValue(null);

            const result = await schoolManager.createSchool({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                name: 'New School',
                address: '123 Main St',
                email: 'school@example.com'
            });

            expect(result.school).toBeDefined();
            expect(result.school.name).toBe('New School');
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

        it('should return school successfully', async () => {
            mockValidators.school.getSchool.mockResolvedValue(null);
            mockMongoModels.school.findOne.mockReturnValue({
                populate: jest.fn().mockResolvedValue({
                    _id: 'school123',
                    name: 'Test School',
                    address: '123 Main St',
                    email: 'test@school.com',
                    createdBy: { username: 'admin', email: 'admin@test.com' },
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
            });

            const result = await schoolManager.getSchool({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'school123'
            });

            expect(result.school).toBeDefined();
            expect(result.school.name).toBe('Test School');
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

        it('should filter schools by search query', async () => {
            const mockSchools = [
                { _id: 'school1', name: 'Primary School', createdAt: new Date() }
            ];

            mockMongoModels.school.find.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockSchools)
            });
            mockMongoModels.school.countDocuments.mockResolvedValue(1);

            const result = await schoolManager.getSchools({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                __pagination: { page: 1, limit: 10, skip: 0, sort: { createdAt: -1 } },
                search: 'Primary'
            });

            expect(result.schools).toHaveLength(1);
            expect(result.schools[0].name).toBe('Primary School');
        });
    });

    describe('updateSchool', () => {
        it('should update school successfully', async () => {
            mockValidators.school.updateSchool.mockResolvedValue(null);
            mockMongoModels.school.findOne.mockResolvedValue(null); // No duplicate
            mockMongoModels.school.findOneAndUpdate.mockResolvedValue({
                _id: 'school123',
                name: 'Updated School',
                address: 'New Address',
                updatedAt: new Date()
            });

            const result = await schoolManager.updateSchool({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'school123',
                name: 'Updated School',
                address: 'New Address'
            });

            expect(result.school).toBeDefined();
            expect(result.school.name).toBe('Updated School');
        });

        it('should return error for duplicate name', async () => {
            mockValidators.school.updateSchool.mockResolvedValue(null);
            mockMongoModels.school.findOne.mockResolvedValue({ _id: 'other-school', name: 'Existing School' });

            const result = await schoolManager.updateSchool({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'school123',
                name: 'Existing School'
            });

            expect(result.error).toBe('School with this name already exists');
            expect(result.code).toBe(400);
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

    describe('getStatistics', () => {
        const setupStatisticsMocks = (schoolId = 'school123') => {
            mockMongoModels.school.findOne.mockResolvedValue({
                _id: schoolId,
                name: 'Test School',
                isDeleted: false
            });

            mockMongoModels.classroom.find.mockResolvedValue([
                { _id: 'class1', name: 'Grade 1-A', grade: '1', capacity: 30 },
                { _id: 'class2', name: 'Grade 2-A', grade: '2', capacity: 25 }
            ]);

            mockMongoModels.student.find.mockResolvedValue([
                { _id: 's1', status: 'enrolled', gender: 'male', classroomId: { toString: () => 'class1' } },
                { _id: 's2', status: 'enrolled', gender: 'female', classroomId: { toString: () => 'class1' } },
                { _id: 's3', status: 'enrolled', gender: 'male', classroomId: { toString: () => 'class2' } }
            ]);

            mockMongoModels.student.countDocuments.mockResolvedValue(2);
        };

        it('should return statistics for superadmin', async () => {
            setupStatisticsMocks();

            const result = await schoolManager.getStatistics({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'school123'
            });

            expect(result.school).toBeDefined();
            expect(result.statistics).toBeDefined();
            expect(result.statistics.totalClassrooms).toBe(2);
            expect(result.statistics.totalStudents).toBe(3);
            expect(result.statistics.totalCapacity).toBe(55);
        });

        it('should return statistics for school admin accessing own school', async () => {
            setupStatisticsMocks('school123');

            const result = await schoolManager.getStatistics({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                id: 'school123'
            });

            expect(result.school).toBeDefined();
            expect(result.statistics).toBeDefined();
        });

        it('should return 403 for school admin accessing other school', async () => {
            const result = await schoolManager.getStatistics({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                id: 'other-school'
            });

            expect(result.error).toBe('Access denied');
            expect(result.code).toBe(403);
        });

        it('should return 404 for non-existent school', async () => {
            mockMongoModels.school.findOne.mockResolvedValue(null);

            const result = await schoolManager.getStatistics({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'non-existent'
            });

            expect(result.error).toBe('School not found');
            expect(result.code).toBe(404);
        });

        it('should return 400 if school ID is missing', async () => {
            const result = await schoolManager.getStatistics({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true }
            });

            expect(result.error).toBe('School ID is required');
            expect(result.code).toBe(400);
        });

        it('should include correct status and gender distributions', async () => {
            setupStatisticsMocks();

            const result = await schoolManager.getStatistics({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'school123'
            });

            expect(result.statistics.statusDistribution.enrolled).toBe(3);
            expect(result.statistics.genderDistribution.male).toBe(2);
            expect(result.statistics.genderDistribution.female).toBe(1);
        });

        it('should include grade breakdown', async () => {
            setupStatisticsMocks();

            const result = await schoolManager.getStatistics({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                id: 'school123'
            });

            expect(result.statistics.gradeBreakdown['1']).toBeDefined();
            expect(result.statistics.gradeBreakdown['2']).toBeDefined();
        });
    });
});
