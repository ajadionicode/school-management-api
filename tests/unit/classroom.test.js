/**
 * Classroom Manager Unit Tests
 */

// Mock dependencies
const mockMongoModels = {
    school: {
        findOne: jest.fn()
    },
    classroom: {
        findOne: jest.fn(),
        find: jest.fn(),
        countDocuments: jest.fn(),
        findOneAndUpdate: jest.fn()
    },
    student: {
        countDocuments: jest.fn(),
        aggregate: jest.fn()
    }
};

const mockValidators = {
    classroom: {
        createClassroom: jest.fn(),
        getClassroom: jest.fn(),
        updateClassroom: jest.fn(),
        deleteClassroom: jest.fn()
    }
};

// Import Classroom manager
const Classroom = require('../../managers/entities/classroom/Classroom.manager');

describe('Classroom Manager', () => {
    let classroomManager;

    beforeEach(() => {
        jest.clearAllMocks();

        classroomManager = new Classroom({
            config: {},
            managers: {
                responseDispatcher: { dispatch: jest.fn() }
            },
            validators: mockValidators,
            mongomodels: mockMongoModels
        });
    });

    describe('createClassroom', () => {
        it('should return validation errors if validation fails', async () => {
            mockValidators.classroom.createClassroom.mockResolvedValue([{ field: 'name', error: 'required' }]);

            const result = await classroomManager.createClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                name: ''
            });

            expect(result.errors).toBeDefined();
        });

        it('should return error if school not found', async () => {
            mockValidators.classroom.createClassroom.mockResolvedValue(null);
            mockMongoModels.school.findOne.mockResolvedValue(null);

            const result = await classroomManager.createClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                name: 'Class A',
                capacity: 30
            });

            expect(result.error).toBe('School not found');
            expect(result.code).toBe(404);
        });

        it('should return error if classroom name already exists in school', async () => {
            mockValidators.classroom.createClassroom.mockResolvedValue(null);
            mockMongoModels.school.findOne.mockResolvedValue({ _id: 'school123', name: 'Test School' });
            mockMongoModels.classroom.findOne.mockResolvedValue({ name: 'Class A' });

            const result = await classroomManager.createClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                name: 'Class A',
                capacity: 30
            });

            expect(result.error).toBe('Classroom with this name already exists in this school');
            expect(result.code).toBe(400);
        });
    });

    describe('deleteClassroom', () => {
        it('should return error if classroom has students', async () => {
            mockValidators.classroom.deleteClassroom.mockResolvedValue(null);
            mockMongoModels.classroom.findOne.mockResolvedValue({ _id: 'class123' });
            mockMongoModels.student.countDocuments.mockResolvedValue(5);

            const result = await classroomManager.deleteClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                id: '507f1f77bcf86cd799439011'
            });

            expect(result.error).toContain('Cannot delete classroom with 5 students');
            expect(result.code).toBe(400);
        });
    });

    describe('updateClassroom', () => {
        it('should return error when reducing capacity below student count', async () => {
            mockValidators.classroom.updateClassroom.mockResolvedValue(null);
            mockMongoModels.classroom.findOne
                .mockResolvedValueOnce({ _id: 'class123', capacity: 30 })
                .mockResolvedValueOnce(null);
            mockMongoModels.student.countDocuments.mockResolvedValue(25);

            const result = await classroomManager.updateClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                id: '507f1f77bcf86cd799439011',
                capacity: 20
            });

            expect(result.error).toContain('Cannot reduce capacity below current student count');
            expect(result.code).toBe(400);
        });
    });
});
