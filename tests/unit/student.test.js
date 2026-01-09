/**
 * Student Manager Unit Tests
 */

// Mock dependencies
const mockMongoModels = {
    school: {
        findOne: jest.fn()
    },
    classroom: {
        findOne: jest.fn()
    },
    student: {
        findOne: jest.fn(),
        findById: jest.fn(),
        find: jest.fn(),
        countDocuments: jest.fn(),
        findOneAndUpdate: jest.fn()
    }
};

const mockValidators = {
    student: {
        createStudent: jest.fn(),
        getStudent: jest.fn(),
        updateStudent: jest.fn(),
        deleteStudent: jest.fn(),
        transferStudent: jest.fn(),
        assignClassroom: jest.fn()
    }
};

// Import Student manager
const Student = require('../../managers/entities/student/Student.manager');

describe('Student Manager', () => {
    let studentManager;

    beforeEach(() => {
        jest.clearAllMocks();

        studentManager = new Student({
            config: {},
            managers: {
                responseDispatcher: { dispatch: jest.fn() }
            },
            validators: mockValidators,
            mongomodels: mockMongoModels
        });
    });

    describe('createStudent', () => {
        it('should return validation errors if validation fails', async () => {
            mockValidators.student.createStudent.mockResolvedValue([{ field: 'firstName', error: 'required' }]);

            const result = await studentManager.createStudent({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                firstName: ''
            });

            expect(result.errors).toBeDefined();
        });

        it('should return error if school not found', async () => {
            mockValidators.student.createStudent.mockResolvedValue(null);
            mockMongoModels.school.findOne.mockResolvedValue(null);

            const result = await studentManager.createStudent({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                firstName: 'John',
                lastName: 'Doe'
            });

            expect(result.error).toBe('School not found');
            expect(result.code).toBe(404);
        });

        it('should return error if classroom is at full capacity', async () => {
            mockValidators.student.createStudent.mockResolvedValue(null);
            mockMongoModels.school.findOne.mockResolvedValue({ _id: 'school123' });
            mockMongoModels.classroom.findOne.mockResolvedValue({ _id: 'class123', capacity: 30 });
            mockMongoModels.student.countDocuments.mockResolvedValue(30);

            const result = await studentManager.createStudent({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                firstName: 'John',
                lastName: 'Doe',
                classroomId: 'class123'
            });

            expect(result.error).toBe('Classroom is at full capacity');
            expect(result.code).toBe(400);
        });
    });

    describe('transferStudent', () => {
        it('should return error if student not found', async () => {
            mockValidators.student.transferStudent.mockResolvedValue(null);
            mockMongoModels.student.findOne.mockResolvedValue(null);

            const result = await studentManager.transferStudent({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                studentId: '507f1f77bcf86cd799439011',
                toSchoolId: '507f1f77bcf86cd799439012'
            });

            expect(result.error).toBe('Student not found');
            expect(result.code).toBe(404);
        });

        it('should return error if target school not found', async () => {
            mockValidators.student.transferStudent.mockResolvedValue(null);
            mockMongoModels.student.findOne.mockResolvedValue({
                _id: 'student123',
                schoolId: { toString: () => 'school123' }
            });
            mockMongoModels.school.findOne.mockResolvedValue(null);

            const result = await studentManager.transferStudent({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                studentId: '507f1f77bcf86cd799439011',
                toSchoolId: '507f1f77bcf86cd799439012'
            });

            expect(result.error).toBe('Target school not found');
            expect(result.code).toBe(404);
        });

        it('should return error when transferring to same school', async () => {
            mockValidators.student.transferStudent.mockResolvedValue(null);
            mockMongoModels.student.findOne.mockResolvedValue({
                _id: 'student123',
                schoolId: { toString: () => 'school123' }
            });
            mockMongoModels.school.findOne.mockResolvedValue({ _id: 'school123' });

            const result = await studentManager.transferStudent({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                studentId: '507f1f77bcf86cd799439011',
                toSchoolId: 'school123'
            });

            expect(result.error).toBe('Student is already in this school');
            expect(result.code).toBe(400);
        });
    });

    describe('assignClassroom', () => {
        it('should return error if classroom is at full capacity', async () => {
            mockValidators.student.assignClassroom.mockResolvedValue(null);
            mockMongoModels.student.findOne.mockResolvedValue({ _id: 'student123' });
            mockMongoModels.classroom.findOne.mockResolvedValue({ _id: 'class123', capacity: 30 });
            mockMongoModels.student.countDocuments.mockResolvedValue(30);

            const result = await studentManager.assignClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                studentId: '507f1f77bcf86cd799439011',
                classroomId: '507f1f77bcf86cd799439012'
            });

            expect(result.error).toBe('Classroom is at full capacity');
            expect(result.code).toBe(400);
        });
    });
});
