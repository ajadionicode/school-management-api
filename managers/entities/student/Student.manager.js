module.exports = class Student {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config = config;
        this.cortex = cortex;
        this.validators = validators;
        this.mongomodels = mongomodels;
        this.responseDispatcher = managers.responseDispatcher;

        this.httpExposed = [
            'createStudent',
            'get=getStudent',
            'get=getStudents',
            'put=updateStudent',
            'delete=deleteStudent',
            'transferStudent',
            'put=assignClassroom'
        ];
    }

    async createStudent({
        __schoolToken, __schoolAdmin,
        firstName, lastName, email, dateOfBirth, gender,
        classroomId, guardianName, guardianPhone, guardianEmail, address
    }) {
        const { schoolId } = __schoolAdmin;
        const data = { firstName, lastName, email, dateOfBirth, gender, classroomId };

        // Validate input
        let result = await this.validators.student.createStudent(data);
        if (result) return { errors: result };

        // Verify school exists
        const school = await this.mongomodels.school.findOne({
            _id: schoolId,
            isDeleted: false
        });

        if (!school) {
            return { error: 'School not found', code: 404 };
        }

        // If classroomId provided, verify it belongs to the same school and has capacity
        if (classroomId) {
            const classroom = await this.mongomodels.classroom.findOne({
                _id: classroomId,
                schoolId: schoolId,
                isDeleted: false
            });

            if (!classroom) {
                return { error: 'Classroom not found in this school', code: 404 };
            }

            // Check capacity
            const currentStudentCount = await this.mongomodels.student.countDocuments({
                classroomId: classroomId,
                isDeleted: false
            });

            if (currentStudentCount >= classroom.capacity) {
                return { error: 'Classroom is at full capacity', code: 400 };
            }
        }

        // Create student
        const student = new this.mongomodels.student({
            firstName,
            lastName,
            email,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            gender,
            schoolId,
            classroomId,
            guardianName,
            guardianPhone,
            guardianEmail,
            address,
            createdBy: __schoolToken.userId
        });

        const savedStudent = await student.save();

        return {
            student: {
                id: savedStudent._id,
                firstName: savedStudent.firstName,
                lastName: savedStudent.lastName,
                email: savedStudent.email,
                dateOfBirth: savedStudent.dateOfBirth,
                gender: savedStudent.gender,
                schoolId: savedStudent.schoolId,
                classroomId: savedStudent.classroomId,
                status: savedStudent.status,
                enrollmentDate: savedStudent.enrollmentDate,
                createdAt: savedStudent.createdAt
            }
        };
    }

    async getStudent({ __schoolToken, __schoolAdmin, __query }) {
        const { schoolId } = __schoolAdmin;
        const id = __query.id || {};

        let result = await this.validators.student.getStudent({ id });
        if (result) return { errors: result };

        const student = await this.mongomodels.student.findOne({
            _id: id,
            schoolId: schoolId,
            isDeleted: false
        })
            .populate('schoolId', 'name')
            .populate('classroomId', 'name grade section')
            .populate('createdBy', 'username email');

        if (!student) {
            return { error: 'Student not found', code: 404 };
        }

        return {
            student: {
                id: student._id,
                firstName: student.firstName,
                lastName: student.lastName,
                fullName: `${student.firstName} ${student.lastName}`,
                email: student.email,
                dateOfBirth: student.dateOfBirth,
                gender: student.gender,
                school: student.schoolId,
                classroom: student.classroomId,
                status: student.status,
                enrollmentDate: student.enrollmentDate,
                guardianName: student.guardianName,
                guardianPhone: student.guardianPhone,
                guardianEmail: student.guardianEmail,
                address: student.address,
                transferHistory: student.transferHistory,
                createdBy: student.createdBy,
                createdAt: student.createdAt,
                updatedAt: student.updatedAt
            }
        };
    }

    async getStudents({
        __schoolToken, __schoolAdmin, __pagination, __query
    }) {
        const { classroomId, status, gender, search } = __query || {};
        const { schoolId } = __schoolAdmin;
        const { skip, limit, sort } = __pagination;

        const query = {
            schoolId: schoolId,
            isDeleted: false
        };

        if (classroomId) query.classroomId = classroomId;
        if (status) query.status = status;
        if (gender) query.gender = gender;
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const students = await this.mongomodels.student
            .find(query)
            .populate('classroomId', 'name grade section')
            .sort(sort)
            .skip(skip)
            .limit(limit);

        const total = await this.mongomodels.student.countDocuments(query);

        return {
            students: students.map(s => ({
                id: s._id,
                firstName: s.firstName,
                lastName: s.lastName,
                fullName: `${s.firstName} ${s.lastName}`,
                email: s.email,
                gender: s.gender,
                classroom: s.classroomId,
                status: s.status,
                enrollmentDate: s.enrollmentDate,
                createdAt: s.createdAt
            })),
            pagination: {
                page: __pagination.page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async updateStudent({
        __schoolToken, __schoolAdmin, id,
        firstName, lastName, email, dateOfBirth, gender,
        guardianName, guardianPhone, guardianEmail, address, status
    }) {
        const { schoolId } = __schoolAdmin;

        let result = await this.validators.student.updateStudent({
            id, firstName, lastName, email, dateOfBirth, gender, status
        });
        if (result) return { errors: result };

        const student = await this.mongomodels.student.findOne({
            _id: id,
            schoolId: schoolId,
            isDeleted: false
        });

        if (!student) {
            return { error: 'Student not found', code: 404 };
        }

        const updateData = {};
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (email) updateData.email = email;
        if (dateOfBirth) updateData.dateOfBirth = new Date(dateOfBirth);
        if (gender) updateData.gender = gender;
        if (guardianName) updateData.guardianName = guardianName;
        if (guardianPhone) updateData.guardianPhone = guardianPhone;
        if (guardianEmail) updateData.guardianEmail = guardianEmail;
        if (address) updateData.address = address;
        if (status) updateData.status = status;

        const updatedStudent = await this.mongomodels.student.findOneAndUpdate(
            { _id: id },
            { $set: updateData },
            { new: true }
        ).populate('classroomId', 'name grade section');

        return {
            student: {
                id: updatedStudent._id,
                firstName: updatedStudent.firstName,
                lastName: updatedStudent.lastName,
                fullName: `${updatedStudent.firstName} ${updatedStudent.lastName}`,
                email: updatedStudent.email,
                dateOfBirth: updatedStudent.dateOfBirth,
                gender: updatedStudent.gender,
                classroom: updatedStudent.classroomId,
                status: updatedStudent.status,
                updatedAt: updatedStudent.updatedAt
            }
        };
    }

    async deleteStudent({ __schoolToken, __schoolAdmin, __query }) {
        const id = __query.id || {};
        const { schoolId } = __schoolAdmin;

        let result = await this.validators.student.deleteStudent({ id });
        if (result) return { errors: result };

        const student = await this.mongomodels.student.findOneAndUpdate(
            { _id: id, schoolId: schoolId, isDeleted: false },
            {
                $set: {
                    isDeleted: true,
                    deletedAt: new Date()
                }
            },
            { new: true }
        );

        if (!student) {
            return { error: 'Student not found', code: 404 };
        }

        return { message: 'Student deleted successfully' };
    }

    async transferStudent({ __schoolToken, __schoolAdmin, studentId, toSchoolId, reason }) {
        let result = await this.validators.student.transferStudent({ studentId, toSchoolId, reason });
        if (result) return { errors: result };

        // Find student
        const student = await this.mongomodels.student.findOne({
            _id: studentId,
            isDeleted: false
        });

        if (!student) {
            return { error: 'Student not found', code: 404 };
        }

        // Verify target school exists
        const toSchool = await this.mongomodels.school.findOne({
            _id: toSchoolId,
            isDeleted: false
        });

        if (!toSchool) {
            return { error: 'Target school not found', code: 404 };
        }

        // Cannot transfer to the same school
        if (student.schoolId.toString() === toSchoolId) {
            return { error: 'Student is already in this school', code: 400 };
        }

        // Record transfer
        const fromSchoolId = student.schoolId;
        student.transferHistory.push({
            fromSchoolId,
            toSchoolId,
            transferDate: new Date(),
            reason: reason || ''
        });
        student.schoolId = toSchoolId;
        student.classroomId = null;
        student.status = 'transferred';

        await student.save();

        const updatedStudent = await this.mongomodels.student.findById(studentId)
            .populate('schoolId', 'name')
            .populate('transferHistory.fromSchoolId', 'name')
            .populate('transferHistory.toSchoolId', 'name');

        return {
            message: 'Student transferred successfully',
            student: {
                id: updatedStudent._id,
                firstName: updatedStudent.firstName,
                lastName: updatedStudent.lastName,
                school: updatedStudent.schoolId,
                status: updatedStudent.status,
                transferHistory: updatedStudent.transferHistory
            }
        };
    }

    async assignClassroom({ __schoolToken, __schoolAdmin, studentId, classroomId }) {
        const { schoolId } = __schoolAdmin;

        let result = await this.validators.student.assignClassroom({ studentId, classroomId });
        if (result) return { errors: result };

        // Find student
        const student = await this.mongomodels.student.findOne({
            _id: studentId,
            schoolId: schoolId,
            isDeleted: false
        });

        if (!student) {
            return { error: 'Student not found', code: 404 };
        }

        // Verify classroom belongs to the same school
        const classroom = await this.mongomodels.classroom.findOne({
            _id: classroomId,
            schoolId: schoolId,
            isDeleted: false
        });

        if (!classroom) {
            return { error: 'Classroom not found in this school', code: 404 };
        }

        // Check capacity (exclude current student if already in this classroom)
        const currentStudentCount = await this.mongomodels.student.countDocuments({
            classroomId: classroomId,
            _id: { $ne: studentId },
            isDeleted: false
        });

        if (currentStudentCount >= classroom.capacity) {
            return { error: 'Classroom is at full capacity', code: 400 };
        }

        // Update student's classroom
        student.classroomId = classroomId;
        if (student.status === 'transferred') {
            student.status = 'enrolled';
        }
        await student.save();

        return {
            message: 'Student assigned to classroom successfully',
            student: {
                id: student._id,
                firstName: student.firstName,
                lastName: student.lastName,
                classroomId: student.classroomId,
                status: student.status
            }
        };
    }
}
