/**
 * Classroom Manager Unit Tests
 */

// Mock classroom save function
const mockClassroomSave = jest.fn();

// Mock dependencies
const mockMongoModels = {
    school: {
        findOne: jest.fn()
    },
    classroom: jest.fn().mockImplementation(function(data) {
        return {
            ...data,
            _id: 'new-classroom-id',
            createdAt: new Date(),
            save: mockClassroomSave.mockResolvedValue({
                _id: 'new-classroom-id',
                ...data,
                createdAt: new Date()
            })
        };
    }),
    student: {
        countDocuments: jest.fn(),
        aggregate: jest.fn()
    }
};

// Add static methods to the classroom mock
mockMongoModels.classroom.findOne = jest.fn();
mockMongoModels.classroom.find = jest.fn();
mockMongoModels.classroom.countDocuments = jest.fn();
mockMongoModels.classroom.findOneAndUpdate = jest.fn();

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
        jest.resetAllMocks();

        // Re-setup classroom constructor mock after reset
        mockMongoModels.classroom.mockImplementation(function(data) {
            return {
                ...data,
                _id: 'new-classroom-id',
                createdAt: new Date(),
                save: mockClassroomSave.mockResolvedValue({
                    _id: 'new-classroom-id',
                    ...data,
                    createdAt: new Date()
                })
            };
        });

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

        it('should create classroom successfully', async () => {
            mockValidators.classroom.createClassroom.mockResolvedValue(null);
            mockMongoModels.school.findOne.mockResolvedValue({ _id: 'school123', name: 'Test School' });
            mockMongoModels.classroom.findOne.mockResolvedValue(null);

            const result = await classroomManager.createClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                name: 'Class A',
                capacity: 30,
                grade: '10',
                section: 'A'
            });

            expect(result.classroom).toBeDefined();
            expect(result.classroom.name).toBe('Class A');
            expect(result.classroom.capacity).toBe(30);
        });
    });

    describe('getClassroom', () => {
        it('should return validation errors if id is invalid', async () => {
            mockValidators.classroom.getClassroom.mockResolvedValue([{ field: 'id', error: 'invalid' }]);

            const result = await classroomManager.getClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                __query: { id: 'invalid' }
            });

            expect(result.errors).toBeDefined();
        });

        it('should return classroom with student count', async () => {
            mockValidators.classroom.getClassroom.mockResolvedValue(null);
            mockMongoModels.classroom.findOne.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockResolvedValue({
                        _id: 'class123',
                        name: 'Class A',
                        schoolId: { _id: 'school123', name: 'Test School' },
                        capacity: 30,
                        grade: '10',
                        section: 'A',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    })
                })
            });
            mockMongoModels.student.countDocuments.mockResolvedValue(20);

            const result = await classroomManager.getClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                __query: { id: 'class123' }
            });

            expect(result.classroom).toBeDefined();
            expect(result.classroom.studentCount).toBe(20);
            expect(result.classroom.availableSeats).toBe(10);
        });

        it('should return 404 for classroom not in admin school (RBAC)', async () => {
            mockValidators.classroom.getClassroom.mockResolvedValue(null);
            mockMongoModels.classroom.findOne.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockResolvedValue(null)
                })
            });

            const result = await classroomManager.getClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                __query: { id: 'class-from-other-school' }
            });

            expect(result.error).toBe('Classroom not found');
            expect(result.code).toBe(404);
        });
    });

    describe('getClassrooms', () => {
        it('should return paginated list of classrooms for school', async () => {
            const mockClassrooms = [
                { _id: 'class1', name: 'Class A', capacity: 30, grade: '10', section: 'A', createdAt: new Date() },
                { _id: 'class2', name: 'Class B', capacity: 25, grade: '10', section: 'B', createdAt: new Date() }
            ];

            mockMongoModels.classroom.find.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockClassrooms)
            });
            mockMongoModels.classroom.countDocuments.mockResolvedValue(2);
            mockMongoModels.student.aggregate.mockResolvedValue([
                { _id: 'class1', count: 20 },
                { _id: 'class2', count: 15 }
            ]);

            const result = await classroomManager.getClassrooms({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                __pagination: { page: 1, limit: 10, skip: 0, sort: { createdAt: -1 } }
            });

            expect(result.classrooms).toHaveLength(2);
            expect(result.pagination.total).toBe(2);
        });

        it('should filter classrooms by grade', async () => {
            mockMongoModels.classroom.find.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([
                    { _id: 'class1', name: 'Class A', capacity: 30, grade: '10', createdAt: new Date() }
                ])
            });
            mockMongoModels.classroom.countDocuments.mockResolvedValue(1);
            mockMongoModels.student.aggregate.mockResolvedValue([]);

            const result = await classroomManager.getClassrooms({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                __pagination: { page: 1, limit: 10, skip: 0, sort: { createdAt: -1 } },
                grade: '10'
            });

            expect(result.classrooms).toHaveLength(1);
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

        it('should update classroom successfully', async () => {
            mockValidators.classroom.updateClassroom.mockResolvedValue(null);
            // First findOne: check if classroom exists
            // Second findOne: check for duplicate name (returns null = no duplicate)
            mockMongoModels.classroom.findOne
                .mockResolvedValueOnce({ _id: 'class123', schoolId: 'school123', capacity: 30 })
                .mockResolvedValueOnce(null);
            mockMongoModels.student.countDocuments.mockResolvedValue(10);
            mockMongoModels.classroom.findOneAndUpdate.mockResolvedValue({
                _id: 'class123',
                name: 'Updated Class',
                capacity: 35,
                grade: '10',
                section: 'A',
                updatedAt: new Date()
            });

            const result = await classroomManager.updateClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                id: 'class123',
                name: 'Updated Class',
                capacity: 35
            });

            expect(result.classroom).toBeDefined();
            expect(result.classroom.name).toBe('Updated Class');
        });

        it('should return 404 for classroom not in admin school (RBAC)', async () => {
            mockValidators.classroom.updateClassroom.mockResolvedValue(null);
            // Classroom not found because schoolId doesn't match
            mockMongoModels.classroom.findOne.mockResolvedValueOnce(null);

            const result = await classroomManager.updateClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                id: 'class-from-other-school',
                name: 'Hacked Class'
            });

            expect(result.error).toBe('Classroom not found');
            expect(result.code).toBe(404);
        });

        it('should return error for duplicate name in school', async () => {
            mockValidators.classroom.updateClassroom.mockResolvedValue(null);
            mockMongoModels.classroom.findOne
                .mockResolvedValueOnce({ _id: 'class123', capacity: 30 })
                .mockResolvedValueOnce({ _id: 'other-class', name: 'Existing Name' });

            const result = await classroomManager.updateClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                id: 'class123',
                name: 'Existing Name'
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
                __query: { id: '507f1f77bcf86cd799439011' }
            });

            expect(result.error).toContain('Cannot delete classroom with 5 students');
            expect(result.code).toBe(400);
        });

        it('should delete empty classroom successfully', async () => {
            mockValidators.classroom.deleteClassroom.mockResolvedValue(null);
            mockMongoModels.classroom.findOne.mockResolvedValue({ _id: 'class123' });
            mockMongoModels.student.countDocuments.mockResolvedValue(0);
            mockMongoModels.classroom.findOneAndUpdate.mockResolvedValue({
                _id: 'class123',
                isDeleted: true,
                deletedAt: new Date()
            });

            const result = await classroomManager.deleteClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                __query: { id: 'class123' }
            });

            expect(result.message).toBe('Classroom deleted successfully');
        });

        it('should return 404 for classroom not in admin school (RBAC)', async () => {
            mockValidators.classroom.deleteClassroom.mockResolvedValue(null);
            mockMongoModels.classroom.findOne.mockResolvedValue(null);

            const result = await classroomManager.deleteClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                __query: { id: 'class-from-other-school' }
            });

            expect(result.error).toBe('Classroom not found');
            expect(result.code).toBe(404);
        });
    });
});
