/**
 * API Integration Tests
 *
 * These tests require a running MongoDB instance.
 * Run with: npm test -- tests/integration/api.test.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Models
const User = require('../../managers/entities/user/user.mongoModel');
const School = require('../../managers/entities/school/school.mongoModel');
const Classroom = require('../../managers/entities/classroom/classroom.mongoModel');
const Student = require('../../managers/entities/student/student.mongoModel');

describe('API Integration Tests', () => {
    describe('Database Models', () => {
        it('should create a user with hashed password', async () => {
            const hashedPassword = await bcrypt.hash('testpassword123', 10);
            const user = new User({
                username: 'testadmin',
                email: 'testadmin@example.com',
                password: hashedPassword,
                role: 'superadmin'
            });

            const savedUser = await user.save();

            expect(savedUser._id).toBeDefined();
            expect(savedUser.username).toBe('testadmin');
            expect(savedUser.role).toBe('superadmin');
            expect(savedUser.isDeleted).toBe(false);
        });

        it('should create a school', async () => {
            const school = new School({
                name: 'Test High School',
                address: '123 Education Lane',
                phone: '+1234567890',
                email: 'info@testhighschool.com',
                principalName: 'Dr. Smith'
            });

            const savedSchool = await school.save();

            expect(savedSchool._id).toBeDefined();
            expect(savedSchool.name).toBe('Test High School');
            expect(savedSchool.isDeleted).toBe(false);
        });

        it('should create a classroom associated with a school', async () => {
            // Create school first
            const school = await new School({
                name: 'Test School for Classroom',
                address: '456 Learning St'
            }).save();

            const classroom = new Classroom({
                name: 'Grade 10-A',
                schoolId: school._id,
                capacity: 35,
                grade: '10',
                section: 'A'
            });

            const savedClassroom = await classroom.save();

            expect(savedClassroom._id).toBeDefined();
            expect(savedClassroom.schoolId.toString()).toBe(school._id.toString());
            expect(savedClassroom.capacity).toBe(35);
        });

        it('should create a student with enrollment', async () => {
            // Create school and classroom
            const school = await new School({
                name: 'Test School for Student'
            }).save();

            const classroom = await new Classroom({
                name: 'Class A',
                schoolId: school._id,
                capacity: 30
            }).save();

            const student = new Student({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@example.com',
                dateOfBirth: new Date('2005-05-15'),
                gender: 'male',
                schoolId: school._id,
                classroomId: classroom._id,
                guardianName: 'Jane Doe',
                guardianPhone: '+1234567890'
            });

            const savedStudent = await student.save();

            expect(savedStudent._id).toBeDefined();
            expect(savedStudent.firstName).toBe('John');
            expect(savedStudent.status).toBe('enrolled');
            expect(savedStudent.schoolId.toString()).toBe(school._id.toString());
        });

        it('should handle soft delete correctly', async () => {
            const school = await new School({
                name: 'School to Delete'
            }).save();

            // Soft delete
            school.isDeleted = true;
            school.deletedAt = new Date();
            await school.save();

            // Query should not find it when filtering by isDeleted
            const found = await School.findOne({
                _id: school._id,
                isDeleted: false
            });

            expect(found).toBeNull();

            // But it still exists in the database
            const stillExists = await School.findById(school._id);
            expect(stillExists).not.toBeNull();
            expect(stillExists.isDeleted).toBe(true);
        });

        it('should record transfer history for students', async () => {
            const school1 = await new School({ name: 'School A' }).save();
            const school2 = await new School({ name: 'School B' }).save();

            const student = await new Student({
                firstName: 'Transfer',
                lastName: 'Student',
                schoolId: school1._id
            }).save();

            // Simulate transfer
            student.transferHistory.push({
                fromSchoolId: school1._id,
                toSchoolId: school2._id,
                transferDate: new Date(),
                reason: 'Family relocation'
            });
            student.schoolId = school2._id;
            student.status = 'transferred';
            await student.save();

            const updatedStudent = await Student.findById(student._id);

            expect(updatedStudent.transferHistory).toHaveLength(1);
            expect(updatedStudent.transferHistory[0].reason).toBe('Family relocation');
            expect(updatedStudent.status).toBe('transferred');
        });
    });

    describe('Data Relationships', () => {
        it('should populate school data when querying classroom', async () => {
            const school = await new School({
                name: 'Relationship Test School'
            }).save();

            await new Classroom({
                name: 'Test Class',
                schoolId: school._id,
                capacity: 25
            }).save();

            const classroom = await Classroom.findOne({
                name: 'Test Class'
            }).populate('schoolId', 'name');

            expect(classroom.schoolId.name).toBe('Relationship Test School');
        });

        it('should populate classroom data when querying student', async () => {
            const school = await new School({ name: 'Student Pop School' }).save();
            const classroom = await new Classroom({
                name: 'Pop Class',
                schoolId: school._id,
                capacity: 20,
                grade: '11',
                section: 'B'
            }).save();

            await new Student({
                firstName: 'Pop',
                lastName: 'Test',
                schoolId: school._id,
                classroomId: classroom._id
            }).save();

            const student = await Student.findOne({
                firstName: 'Pop'
            }).populate('classroomId', 'name grade section');

            expect(student.classroomId.name).toBe('Pop Class');
            expect(student.classroomId.grade).toBe('11');
        });
    });
});
