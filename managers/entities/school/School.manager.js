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

    async getSchool({ __schoolToken, __superadmin, id }) {
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

    async getSchools({ __schoolToken, __superadmin, __pagination, search }) {
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

    async deleteSchool({ __schoolToken, __superadmin, id }) {
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
}
