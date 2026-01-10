module.exports = class School {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config = config;
        this.cortex = cortex;
        this.validators = validators;
        this.mongomodels = mongomodels;
        this.responseDispatcher = managers.responseDispatcher;

        this.httpExposed = [
            'createSchool',
            'get=getSchool',
            'get=getSchools',
            'get=getStatistics',
            'put=updateSchool',
            'delete=deleteSchool'
        ];
    }

    async createSchool({ __schoolToken, __superadmin, name, address, phone, email, principalName, establishedYear }) {
        const data = { name, address, phone, email, principalName };

        // Validate input
        let result = await this.validators.school.createSchool(data);
        if (result) return { errors: result };

        // Check for duplicate school name
        const existingSchool = await this.mongomodels.school.findOne({
            name: name,
            isDeleted: false
        });

        if (existingSchool) {
            return { error: 'School with this name already exists', code: 400 };
        }

        // Create school
        const school = new this.mongomodels.school({
            name,
            address,
            phone,
            email,
            principalName,
            establishedYear,
            createdBy: __schoolToken.userId
        });

        const savedSchool = await school.save();

        return {
            school: {
                id: savedSchool._id,
                name: savedSchool.name,
                address: savedSchool.address,
                phone: savedSchool.phone,
                email: savedSchool.email,
                principalName: savedSchool.principalName,
                establishedYear: savedSchool.establishedYear,
                createdAt: savedSchool.createdAt
            }
        };
    }

    async getSchool({ __schoolToken, __superadmin, __query }) {
        const id = __query.id || {};
        let result = await this.validators.school.getSchool({ id });
        if (result) return { errors: result };

        const school = await this.mongomodels.school.findOne({
            _id: id,
            isDeleted: false
        }).populate('createdBy', 'username email');

        if (!school) {
            return { error: 'School not found', code: 404 };
        }

        return {
            school: {
                id: school._id,
                name: school.name,
                address: school.address,
                phone: school.phone,
                email: school.email,
                principalName: school.principalName,
                establishedYear: school.establishedYear,
                createdBy: school.createdBy,
                createdAt: school.createdAt,
                updatedAt: school.updatedAt
            }
        };
    }

    async getSchools({ __schoolToken, __superadmin, __pagination, __query }) {
        const { search } = __query || {};
        const { skip, limit, sort } = __pagination;

        const query = { isDeleted: false };
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } }
            ];
        }

        const schools = await this.mongomodels.school
            .find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit);

        const total = await this.mongomodels.school.countDocuments(query);

        return {
            schools: schools.map(s => ({
                id: s._id,
                name: s.name,
                address: s.address,
                phone: s.phone,
                email: s.email,
                principalName: s.principalName,
                establishedYear: s.establishedYear,
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

    async updateSchool({ __schoolToken, __superadmin, id, name, address, phone, email, principalName, establishedYear }) {
        let result = await this.validators.school.updateSchool({ id, name, address, phone, email, principalName });
        if (result) return { errors: result };

        // Check for duplicate name
        if (name) {
            const existingSchool = await this.mongomodels.school.findOne({
                _id: { $ne: id },
                name: name,
                isDeleted: false
            });

            if (existingSchool) {
                return { error: 'School with this name already exists', code: 400 };
            }
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (address) updateData.address = address;
        if (phone) updateData.phone = phone;
        if (email) updateData.email = email;
        if (principalName) updateData.principalName = principalName;
        if (establishedYear) updateData.establishedYear = establishedYear;

        const school = await this.mongomodels.school.findOneAndUpdate(
            { _id: id, isDeleted: false },
            { $set: updateData },
            { new: true }
        );

        if (!school) {
            return { error: 'School not found', code: 404 };
        }

        return {
            school: {
                id: school._id,
                name: school.name,
                address: school.address,
                phone: school.phone,
                email: school.email,
                principalName: school.principalName,
                establishedYear: school.establishedYear,
                updatedAt: school.updatedAt
            }
        };
    }

    async deleteSchool({ __schoolToken, __superadmin, __query }) {
        const id = __query.id || {}; 
        let result = await this.validators.school.deleteSchool({ id });
        if (result) return { errors: result };

        const school = await this.mongomodels.school.findOneAndUpdate(
            { _id: id, isDeleted: false },
            {
                $set: {
                    isDeleted: true,
                    deletedAt: new Date()
                }
            },
            { new: true }
        );

        if (!school) {
            return { error: 'School not found', code: 404 };
        }

        return { message: 'School deleted successfully' };
    }

    async getStatistics({ __schoolToken, __schoolAdmin, __query }) {
        const { id } = __query;

        // Determine which school to get statistics for
        let schoolId = id;

        // If school admin, they can only view their own school's statistics
        // if (__schoolAdmin && !__superadmin) {
        //     if (id && id !== __schoolAdmin.schoolId) {
        //         return { error: 'Access denied', code: 403 };
        //     }
        //     schoolId = __schoolAdmin.schoolId;
        // }

        schoolId = __schoolAdmin.schoolId;

        if (!schoolId) {
            return { error: 'School ID is required', code: 400 };
        }

        // Verify school exists
        const school = await this.mongomodels.school.findOne({
            _id: schoolId,
            isDeleted: false
        });

        if (!school) {
            return { error: 'School not found', code: 404 };
        }

        // Get classroom statistics
        const classrooms = await this.mongomodels.classroom.find({
            schoolId: schoolId,
            isDeleted: false
        });

        const totalClassrooms = classrooms.length;
        const totalCapacity = classrooms.reduce((sum, c) => sum + (c.capacity || 0), 0);

        // Get student statistics
        const students = await this.mongomodels.student.find({
            schoolId: schoolId,
            isDeleted: false
        });

        const totalStudents = students.length;
        const activeStudents = students.filter(s => s.status === 'enrolled' || s.status === 'active').length;

        // Student status distribution
        const statusDistribution = {};
        students.forEach(s => {
            const status = s.status || 'unknown';
            statusDistribution[status] = (statusDistribution[status] || 0) + 1;
        });

        // Student gender distribution
        const genderDistribution = {};
        students.forEach(s => {
            const gender = s.gender || 'unspecified';
            genderDistribution[gender] = (genderDistribution[gender] || 0) + 1;
        });

        // Breakdown by grade level
        const gradeBreakdown = {};
        for (const classroom of classrooms) {
            const grade = classroom.grade || 'unassigned';
            if (!gradeBreakdown[grade]) {
                gradeBreakdown[grade] = { classrooms: 0, students: 0, capacity: 0 };
            }
            gradeBreakdown[grade].classrooms += 1;
            gradeBreakdown[grade].capacity += classroom.capacity || 0;

            // Count students in this classroom
            const classroomStudents = students.filter(s =>
                s.classroomId && s.classroomId.toString() === classroom._id.toString()
            );
            gradeBreakdown[grade].students += classroomStudents.length;
        }

        // Breakdown by classroom
        const classroomBreakdown = await Promise.all(classrooms.map(async (classroom) => {
            const studentCount = await this.mongomodels.student.countDocuments({
                classroomId: classroom._id,
                schoolId: schoolId,
                isDeleted: false
            });

            return {
                id: classroom._id,
                name: classroom.name,
                grade: classroom.grade,
                section: classroom.section,
                capacity: classroom.capacity,
                studentCount,
                availableSeats: classroom.capacity - studentCount,
                utilizationRate: classroom.capacity > 0
                    ? Math.round((studentCount / classroom.capacity) * 100)
                    : 0
            };
        }));

        // Calculate overall utilization rate
        const utilizationRate = totalCapacity > 0
            ? Math.round((activeStudents / totalCapacity) * 100)
            : 0;

        return {
            school: {
                id: school._id,
                name: school.name
            },
            statistics: {
                totalClassrooms,
                totalStudents,
                activeStudents,
                totalCapacity,
                availableSeats: totalCapacity - activeStudents,
                utilizationRate,
                statusDistribution,
                genderDistribution,
                gradeBreakdown,
                classroomBreakdown
            }
        };
    }
}
