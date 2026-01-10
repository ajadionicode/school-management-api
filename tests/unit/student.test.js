/**
 * Student Manager Unit Tests
 */

// Mock student save function
const mockStudentSave = jest.fn();

// Mock dependencies
const mockMongoModels = {
    school: {
        findOne: jest.fn()
    },
    classroom: {
        findOne: jest.fn()
    },
    student: jest.fn().mockImplementation(function(data) {
        return {
            ...data,
            _id: 'new-student-id',
            status: 'enrolled',
            enrollmentDate: new Date(),
            createdAt: new Date(),
            transferHistory: [],
            save: mockStudentSave.mockResolvedValue({
                _id: 'new-student-id',
                ...data,
                status: 'enrolled',
                enrollmentDate: new Date(),
                createdAt: new Date()
            })
        };
    })
};

// Add static methods to the student mock
mockMongoModels.student.findOne = jest.fn();
mockMongoModels.student.findById = jest.fn();
mockMongoModels.student.find = jest.fn();
mockMongoModels.student.countDocuments = jest.fn();
mockMongoModels.student.findOneAndUpdate = jest.fn();

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

        it('should create student successfully without classroom', async () => {
            mockValidators.student.createStudent.mockResolvedValue(null);
            mockMongoModels.school.findOne.mockResolvedValue({ _id: 'school123' });

            const result = await studentManager.createStudent({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com'
            });

            expect(result.student).toBeDefined();
            expect(result.student.firstName).toBe('John');
            expect(result.student.lastName).toBe('Doe');
        });

        it('should create student with classroom assignment', async () => {
            mockValidators.student.createStudent.mockResolvedValue(null);
            mockMongoModels.school.findOne.mockResolvedValue({ _id: 'school123' });
            mockMongoModels.classroom.findOne.mockResolvedValue({ _id: 'class123', capacity: 30 });
            mockMongoModels.student.countDocuments.mockResolvedValue(10);

            const result = await studentManager.createStudent({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                firstName: 'John',
                lastName: 'Doe',
                classroomId: 'class123'
            });

            expect(result.student).toBeDefined();
            expect(result.student.classroomId).toBe('class123');
        });
    });

    describe('getStudent', () => {
        it('should return student with populated fields', async () => {
            mockValidators.student.getStudent.mockResolvedValue(null);
            mockMongoModels.student.findOne.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        populate: jest.fn().mockResolvedValue({
                            _id: 'student123',
                            firstName: 'John',
                            lastName: 'Doe',
                            email: 'john@example.com',
                            schoolId: { _id: 'school123', name: 'Test School' },
                            classroomId: { _id: 'class123', name: 'Grade 10-A', grade: '10' },
                            status: 'enrolled',
                            transferHistory: [],
                            createdAt: new Date()
                        })
                    })
                })
            });

            const result = await studentManager.getStudent({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                __query: { id: 'student123' }
            });

            expect(result.student).toBeDefined();
            expect(result.student.fullName).toBe('John Doe');
        });

        it('should return 404 for student not in admin school (RBAC)', async () => {
            mockValidators.student.getStudent.mockResolvedValue(null);
            mockMongoModels.student.findOne.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        populate: jest.fn().mockResolvedValue(null)
                    })
                })
            });

            const result = await studentManager.getStudent({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                __query: { id: 'student-from-other-school' }
            });

            expect(result.error).toBe('Student not found');
            expect(result.code).toBe(404);
        });
    });

    describe('getStudents', () => {
        it('should return paginated list of students', async () => {
            const mockStudents = [
                { _id: 's1', firstName: 'John', lastName: 'Doe', status: 'enrolled', createdAt: new Date() },
                { _id: 's2', firstName: 'Jane', lastName: 'Smith', status: 'enrolled', createdAt: new Date() }
            ];

            mockMongoModels.student.find.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockStudents)
            });
            mockMongoModels.student.countDocuments.mockResolvedValue(2);

            const result = await studentManager.getStudents({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                __pagination: { page: 1, limit: 10, skip: 0, sort: { createdAt: -1 } }
            });

            expect(result.students).toHaveLength(2);
            expect(result.pagination.total).toBe(2);
        });

        it('should filter students by status', async () => {
            mockMongoModels.student.find.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([
                    { _id: 's1', firstName: 'John', lastName: 'Doe', status: 'enrolled', createdAt: new Date() }
                ])
            });
            mockMongoModels.student.countDocuments.mockResolvedValue(1);

            const result = await studentManager.getStudents({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                __pagination: { page: 1, limit: 10, skip: 0, sort: { createdAt: -1 } },
                status: 'enrolled'
            });

            expect(result.students).toHaveLength(1);
        });
    });

    describe('updateStudent', () => {
        it('should update student successfully', async () => {
            mockValidators.student.updateStudent.mockResolvedValue(null);
            mockMongoModels.student.findOne.mockResolvedValue({ _id: 'student123' });
            mockMongoModels.student.findOneAndUpdate.mockReturnValue({
                populate: jest.fn().mockResolvedValue({
                    _id: 'student123',
                    firstName: 'Johnny',
                    lastName: 'Doe',
                    email: 'johnny@example.com',
                    status: 'enrolled',
                    updatedAt: new Date()
                })
            });

            const result = await studentManager.updateStudent({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                id: 'student123',
                firstName: 'Johnny'
            });

            expect(result.student).toBeDefined();
            expect(result.student.firstName).toBe('Johnny');
        });

        it('should return 404 for student not in admin school (RBAC)', async () => {
            mockValidators.student.updateStudent.mockResolvedValue(null);
            mockMongoModels.student.findOne.mockResolvedValue(null);

            const result = await studentManager.updateStudent({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                id: 'student-from-other-school',
                firstName: 'Hacked'
            });

            expect(result.error).toBe('Student not found');
            expect(result.code).toBe(404);
        });
    });

    describe('deleteStudent', () => {
        it('should soft delete student successfully', async () => {
            mockValidators.student.deleteStudent.mockResolvedValue(null);
            mockMongoModels.student.findOneAndUpdate.mockResolvedValue({
                _id: 'student123',
                isDeleted: true,
                deletedAt: new Date()
            });

            const result = await studentManager.deleteStudent({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                __query: { id: 'student123' }
            });

            expect(result.message).toBe('Student deleted successfully');
        });

        it('should return 404 for student not in admin school (RBAC)', async () => {
            mockValidators.student.deleteStudent.mockResolvedValue(null);
            mockMongoModels.student.findOneAndUpdate.mockResolvedValue(null);

            const result = await studentManager.deleteStudent({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                __query: { id: 'student-from-other-school' }
            });

            expect(result.error).toBe('Student not found');
            expect(result.code).toBe(404);
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

        it('should transfer student successfully (superadmin only)', async () => {
            const mockStudent = {
                _id: 'student123',
                firstName: 'John',
                lastName: 'Doe',
                schoolId: { toString: () => 'school1' },
                classroomId: 'class1',
                status: 'enrolled',
                transferHistory: [],
                save: jest.fn().mockResolvedValue(true)
            };

            mockValidators.student.transferStudent.mockResolvedValue(null);
            mockMongoModels.student.findOne.mockResolvedValue(mockStudent);
            mockMongoModels.school.findOne.mockResolvedValue({ _id: 'school2', name: 'School 2' });
            mockMongoModels.student.findById.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        populate: jest.fn().mockResolvedValue({
                            _id: 'student123',
                            firstName: 'John',
                            lastName: 'Doe',
                            schoolId: { _id: 'school2', name: 'School 2' },
                            status: 'transferred',
                            transferHistory: [
                                { fromSchoolId: { name: 'School 1' }, toSchoolId: { name: 'School 2' } }
                            ]
                        })
                    })
                })
            });

            const result = await studentManager.transferStudent({
                __schoolToken: { userId: 'admin123' },
                __superadmin: { isSuperadmin: true },
                studentId: 'student123',
                toSchoolId: 'school2',
                reason: 'Family relocation'
            });

            expect(result.message).toBe('Student transferred successfully');
            expect(mockStudent.save).toHaveBeenCalled();
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

        it('should assign student to classroom successfully', async () => {
            const mockStudent = {
                _id: 'student123',
                firstName: 'John',
                lastName: 'Doe',
                status: 'enrolled',
                save: jest.fn().mockResolvedValue(true)
            };

            mockValidators.student.assignClassroom.mockResolvedValue(null);
            mockMongoModels.student.findOne.mockResolvedValue(mockStudent);
            mockMongoModels.classroom.findOne.mockResolvedValue({ _id: 'class123', capacity: 30 });
            mockMongoModels.student.countDocuments.mockResolvedValue(10);

            const result = await studentManager.assignClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                studentId: 'student123',
                classroomId: 'class123'
            });

            expect(result.message).toBe('Student assigned to classroom successfully');
            expect(mockStudent.save).toHaveBeenCalled();
        });

        it('should return 404 for student not in admin school (RBAC)', async () => {
            mockValidators.student.assignClassroom.mockResolvedValue(null);
            mockMongoModels.student.findOne.mockResolvedValue(null);

            const result = await studentManager.assignClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                studentId: 'student-from-other-school',
                classroomId: 'class123'
            });

            expect(result.error).toBe('Student not found');
            expect(result.code).toBe(404);
        });

        it('should return 404 for classroom not in admin school', async () => {
            mockValidators.student.assignClassroom.mockResolvedValue(null);
            mockMongoModels.student.findOne.mockResolvedValue({ _id: 'student123' });
            mockMongoModels.classroom.findOne.mockResolvedValue(null);

            const result = await studentManager.assignClassroom({
                __schoolToken: { userId: 'admin123' },
                __schoolAdmin: { schoolId: 'school123', userId: 'admin123' },
                studentId: 'student123',
                classroomId: 'class-from-other-school'
            });

            expect(result.error).toBe('Classroom not found in this school');
            expect(result.code).toBe(404);
        });
    });
});
