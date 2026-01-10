const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');

module.exports = class User {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config = config;
        this.cortex = cortex;
        this.validators = validators;
        this.mongomodels = mongomodels;
        this.tokenManager = managers.token;
        this.responseDispatcher = managers.responseDispatcher;

        this.httpExposed = [
            'createUser',
            'get=getUser',
            'get=getUsers',
            'put=updateUser',
            'delete=deleteUser'
        ];
    }

    async createUser({ __schoolToken, __superadmin, username, email, password, role, schoolId }) {
        const data = { username, email, password, role, schoolId };

        let result = await this.validators.user.createUser(data);
        if (result) return { errors: result };

        // Check if username or email already exists
        const existingUser = await this.mongomodels.user.findOne({
            $or: [{ username }, { email }],
            isDeleted: false
        });

        if (existingUser) {
            return {
                error: existingUser.username === username
                    ? 'Username already exists'
                    : 'Email already exists',
                code: 400
            };
        }

        // Validate schoolId for school_admin role
        if (role === 'school_admin') {
            if (!schoolId) {
                return {
                    error: 'schoolId is required for school_admin role',
                    code: 400
                };
            }
            const school = await this.mongomodels.school.findOne({
                _id: schoolId,
                isDeleted: false
            });
            if (!school) {
                return {
                    error: 'School not found',
                    code: 404
                };
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = new this.mongomodels.user({
            username,
            email,
            password: hashedPassword,
            role: role || 'school_admin',
            schoolId: role === 'superadmin' ? null : schoolId
        });

        const savedUser = await user.save();

        // Generate tokens
        const userKey = savedUser._id.toString();
        const longToken = this.tokenManager.genLongToken({
            userId: savedUser._id.toString(),
            userKey,
            role: savedUser.role,
            schoolId: savedUser.schoolId ? savedUser.schoolId.toString() : null
        });

        return {
            user: {
                id: savedUser._id,
                username: savedUser.username,
                email: savedUser.email,
                role: savedUser.role,
                schoolId: savedUser.schoolId,
                createdAt: savedUser.createdAt
            },
            longToken
        };
    }

    async getUser({ __schoolToken, __superadmin, __query }) {
        const id = __query.id;
        if (!id) {
            return { error: 'User ID is required', code: 400 };
        }

        const user = await this.mongomodels.user.findOne({
            _id: id,
            isDeleted: false
        }).populate('schoolId', 'name');

        if (!user) {
            return { error: 'User not found', code: 404 };
        }

        return {
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                school: user.schoolId,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        };
    }

    async getUsers({ __schoolToken, __superadmin, __pagination, __query }) {
        const { role, schoolId } = __query || {};
        const { skip, limit, sort } = __pagination;

        const query = { isDeleted: false };
        if (role) query.role = role;
        if (schoolId) query.schoolId = schoolId;

        const users = await this.mongomodels.user
            .find(query)
            .select('-password')
            .populate('schoolId', 'name')
            .sort(sort)
            .skip(skip)
            .limit(limit);

        const total = await this.mongomodels.user.countDocuments(query);

        return {
            users: users.map(u => ({
                id: u._id,
                username: u.username,
                email: u.email,
                role: u.role,
                school: u.schoolId,
                createdAt: u.createdAt
            })),
            pagination: {
                page: __pagination.page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async updateUser({ __schoolToken, __superadmin, id, username, email, role, schoolId }) {
        if (!id) {
            return { error: 'User ID is required', code: 400 };
        }

        const user = await this.mongomodels.user.findOne({
            _id: id,
            isDeleted: false
        });

        if (!user) {
            return { error: 'User not found', code: 404 };
        }

        // Prevent modification of seeded accounts (demo protection)
        if (user.isSeeded) {
            return { error: 'Cannot modify this account', code: 403 };
        }

        // Check for duplicate username/email
        if (username || email) {
            const existingUser = await this.mongomodels.user.findOne({
                _id: { $ne: id },
                $or: [
                    ...(username ? [{ username }] : []),
                    ...(email ? [{ email }] : [])
                ],
                isDeleted: false
            });

            if (existingUser) {
                return {
                    error: existingUser.username === username
                        ? 'Username already exists'
                        : 'Email already exists',
                    code: 400
                };
            }
        }

        // Validate schoolId for school_admin role
        if (role === 'school_admin' && schoolId) {
            const school = await this.mongomodels.school.findOne({
                _id: schoolId,
                isDeleted: false
            });
            if (!school) {
                return { error: 'School not found', code: 404 };
            }
        }

        const updateData = {};
        if (username) updateData.username = username;
        if (email) updateData.email = email;
        if (role) {
            updateData.role = role;
            if (role === 'superadmin') {
                updateData.schoolId = null;
            }
        }
        if (schoolId && role !== 'superadmin') updateData.schoolId = schoolId;

        const updatedUser = await this.mongomodels.user.findOneAndUpdate(
            { _id: id },
            { $set: updateData },
            { new: true }
        ).populate('schoolId', 'name');

        return {
            user: {
                id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role,
                school: updatedUser.schoolId,
                updatedAt: updatedUser.updatedAt
            }
        };
    }

    async deleteUser({ __schoolToken, __superadmin, id }) {
        if (!id) {
            return { error: 'User ID is required', code: 400 };
        }

        // Prevent self-deletion
        if (id === __schoolToken.userId) {
            return { error: 'Cannot delete your own account', code: 400 };
        }

        // Check if user is seeded (demo protection)
        const userToDelete = await this.mongomodels.user.findOne({
            _id: id,
            isDeleted: false
        });

        if (!userToDelete) {
            return { error: 'User not found', code: 404 };
        }

        if (userToDelete.isSeeded) {
            return { error: 'Cannot delete this account', code: 403 };
        }

        const user = await this.mongomodels.user.findOneAndUpdate(
            { _id: id, isDeleted: false },
            {
                $set: {
                    isDeleted: true,
                    deletedAt: new Date()
                }
            },
            { new: true }
        );

        if (!user) {
            return { error: 'User not found', code: 404 };
        }

        return { message: 'User deleted successfully' };
    }
}
