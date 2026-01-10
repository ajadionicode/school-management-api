module.exports = class Classroom {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config = config;
        this.cortex = cortex;
        this.validators = validators;
        this.mongomodels = mongomodels;
        this.responseDispatcher = managers.responseDispatcher;

        this.httpExposed = [
            'createClassroom',
            'get=getClassroom',
            'get=getClassrooms',
            'put=updateClassroom',
            'delete=deleteClassroom'
        ];
    }

    async createClassroom({ __schoolToken, __schoolAdmin, name, capacity, grade, section, resources }) {
        const { schoolId } = __schoolAdmin;
        const data = { name, capacity, grade, section };

        // Validate input
        let result = await this.validators.classroom.createClassroom(data);
        if (result) return { errors: result };

        // Verify school exists
        const school = await this.mongomodels.school.findOne({
            _id: schoolId,
            isDeleted: false
        });

        if (!school) {
            return { error: 'School not found', code: 404 };
        }

        // Check for duplicate classroom name in the same school
        const existingClassroom = await this.mongomodels.classroom.findOne({
            schoolId: schoolId,
            name: name,
            isDeleted: false
        });

        if (existingClassroom) {
            return { error: 'Classroom with this name already exists in this school', code: 400 };
        }

        // Create classroom
        const classroom = new this.mongomodels.classroom({
            name,
            schoolId,
            capacity,
            grade,
            section,
            resources: resources || [],
            createdBy: __schoolToken.userId
        });

        const savedClassroom = await classroom.save();

        return {
            classroom: {
                id: savedClassroom._id,
                name: savedClassroom.name,
                schoolId: savedClassroom.schoolId,
                capacity: savedClassroom.capacity,
                grade: savedClassroom.grade,
                section: savedClassroom.section,
                resources: savedClassroom.resources,
                createdAt: savedClassroom.createdAt
            }
        };
    }

    async getClassroom({ __schoolToken, __schoolAdmin, __query }) {
        const id = __query.id || {};
        const { schoolId } = __schoolAdmin;

        let result = await this.validators.classroom.getClassroom({ id });
        if (result) return { errors: result };

        const classroom = await this.mongomodels.classroom.findOne({
            _id: id,
            schoolId: schoolId,
            isDeleted: false
        }).populate('schoolId', 'name').populate('createdBy', 'username email');

        if (!classroom) {
            return { error: 'Classroom not found', code: 404 };
        }

        // Get student count for this classroom
        const studentCount = await this.mongomodels.student.countDocuments({
            classroomId: id,
            isDeleted: false
        });

        return {
            classroom: {
                id: classroom._id,
                name: classroom.name,
                school: classroom.schoolId,
                capacity: classroom.capacity,
                grade: classroom.grade,
                section: classroom.section,
                resources: classroom.resources,
                studentCount,
                availableSeats: classroom.capacity - studentCount,
                createdBy: classroom.createdBy,
                createdAt: classroom.createdAt,
                updatedAt: classroom.updatedAt
            }
        };
    }

    async getClassrooms({ __schoolToken, __schoolAdmin, __pagination, __query }) {
        const { grade, section, search } = __query || {};
        const { schoolId } = __schoolAdmin;
        const { skip, limit, sort } = __pagination;

        const query = {
            schoolId: schoolId,
            isDeleted: false
        };

        if (grade) query.grade = grade;
        if (section) query.section = section;
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const classrooms = await this.mongomodels.classroom
            .find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit);

        const total = await this.mongomodels.classroom.countDocuments(query);

        // Get student counts for each classroom
        const classroomIds = classrooms.map(c => c._id);
        const studentCounts = await this.mongomodels.student.aggregate([
            {
                $match: {
                    classroomId: { $in: classroomIds },
                    isDeleted: false
                }
            },
            {
                $group: {
                    _id: '$classroomId',
                    count: { $sum: 1 }
                }
            }
        ]);

        const countMap = {};
        studentCounts.forEach(sc => {
            countMap[sc._id.toString()] = sc.count;
        });

        return {
            classrooms: classrooms.map(c => ({
                id: c._id,
                name: c.name,
                capacity: c.capacity,
                grade: c.grade,
                section: c.section,
                studentCount: countMap[c._id.toString()] || 0,
                availableSeats: c.capacity - (countMap[c._id.toString()] || 0),
                createdAt: c.createdAt
            })),
            pagination: {
                page: __pagination.page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async updateClassroom({ __schoolToken, __schoolAdmin, id, name, capacity, grade, section, resources }) {
        const { schoolId } = __schoolAdmin;

        let result = await this.validators.classroom.updateClassroom({ id, name, capacity, grade, section });
        if (result) return { errors: result };

        // Check if classroom exists and belongs to the school
        const classroom = await this.mongomodels.classroom.findOne({
            _id: id,
            schoolId: schoolId,
            isDeleted: false
        });

        if (!classroom) {
            return { error: 'Classroom not found', code: 404 };
        }

        // Check for duplicate name
        if (name) {
            const existingClassroom = await this.mongomodels.classroom.findOne({
                _id: { $ne: id },
                schoolId: schoolId,
                name: name,
                isDeleted: false
            });

            if (existingClassroom) {
                return { error: 'Classroom with this name already exists in this school', code: 400 };
            }
        }

        // If capacity is being reduced, check current student count
        if (capacity) {
            const studentCount = await this.mongomodels.student.countDocuments({
                classroomId: id,
                isDeleted: false
            });

            if (capacity < studentCount) {
                return {
                    error: `Cannot reduce capacity below current student count (${studentCount})`,
                    code: 400
                };
            }
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (capacity) updateData.capacity = capacity;
        if (grade) updateData.grade = grade;
        if (section) updateData.section = section;
        if (resources) updateData.resources = resources;

        const updatedClassroom = await this.mongomodels.classroom.findOneAndUpdate(
            { _id: id },
            { $set: updateData },
            { new: true }
        );

        return {
            classroom: {
                id: updatedClassroom._id,
                name: updatedClassroom.name,
                capacity: updatedClassroom.capacity,
                grade: updatedClassroom.grade,
                section: updatedClassroom.section,
                resources: updatedClassroom.resources,
                updatedAt: updatedClassroom.updatedAt
            }
        };
    }

    async deleteClassroom({ __schoolToken, __schoolAdmin, __query }) {
        const id = __query.id || {};
        const { schoolId } = __schoolAdmin;

        let result = await this.validators.classroom.deleteClassroom({ id });
        if (result) return { errors: result };

        // Check if classroom exists and belongs to the school
        const classroom = await this.mongomodels.classroom.findOne({
            _id: id,
            schoolId: schoolId,
            isDeleted: false
        });

        if (!classroom) {
            return { error: 'Classroom not found', code: 404 };
        }

        // Check if there are students in the classroom
        const studentCount = await this.mongomodels.student.countDocuments({
            classroomId: id,
            isDeleted: false
        });

        if (studentCount > 0) {
            return {
                error: `Cannot delete classroom with ${studentCount} students. Please reassign students first.`,
                code: 400
            };
        }

        await this.mongomodels.classroom.findOneAndUpdate(
            { _id: id },
            {
                $set: {
                    isDeleted: true,
                    deletedAt: new Date()
                }
            }
        );

        return { message: 'Classroom deleted successfully' };
    }
}
