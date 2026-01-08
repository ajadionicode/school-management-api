const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');
const md5 = require('md5');

module.exports = class Auth {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config = config;
        this.cortex = cortex;
        this.validators = validators;
        this.mongomodels = mongomodels;
        this.tokenManager = managers.token;
        this.responseDispatcher = managers.responseDispatcher;

        this.httpExposed = [
            'login',
            'post=refreshToken',
            'post=changePassword'
        ];
    }

    async login({ username, password, __device }) {
        // Validate input
        if (!username || !password) {
            return {
                error: 'Username and password are required',
                code: 400
            };
        }

        // Find user
        const user = await this.mongomodels.user.findOne({
            $or: [
                { username: username },
                { email: username }
            ],
            isDeleted: false
        });

        if (!user) {
            return {
                error: 'Invalid credentials',
                code: 401
            };
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return {
                error: 'Invalid credentials',
                code: 401
            };
        }

        // Generate tokens
        const userKey = user._id.toString();
        const longToken = this.tokenManager.genLongToken({
            userId: user._id.toString(),
            userKey,
            role: user.role,
            schoolId: user.schoolId ? user.schoolId.toString() : null
        });

        const shortToken = this.tokenManager.genShortToken({
            userId: user._id.toString(),
            userKey,
            sessionId: nanoid(),
            deviceId: md5(JSON.stringify(__device)),
            role: user.role,
            schoolId: user.schoolId ? user.schoolId.toString() : null
        });

        return {
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                schoolId: user.schoolId
            },
            longToken,
            shortToken
        };
    }

    async refreshToken({ __longToken, __device }) {
        if (!__longToken) {
            return {
                error: 'Long token is required',
                code: 401
            };
        }

        const shortToken = this.tokenManager.genShortToken({
            userId: __longToken.userId,
            userKey: __longToken.userKey,
            sessionId: nanoid(),
            deviceId: md5(JSON.stringify(__device)),
            role: __longToken.role,
            schoolId: __longToken.schoolId
        });

        return { shortToken };
    }

    async changePassword({ __schoolToken, currentPassword, newPassword }) {
        if (!currentPassword || !newPassword) {
            return {
                error: 'Current password and new password are required',
                code: 400
            };
        }

        if (newPassword.length < 8) {
            return {
                error: 'New password must be at least 8 characters long',
                code: 400
            };
        }

        // Find user
        const user = await this.mongomodels.user.findOne({
            _id: __schoolToken.userId,
            isDeleted: false
        });

        if (!user) {
            return {
                error: 'User not found',
                code: 404
            };
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return {
                error: 'Current password is incorrect',
                code: 401
            };
        }

        // Hash new password and update
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await this.mongomodels.user.updateOne(
            { _id: user._id },
            { $set: { password: hashedPassword } }
        );

        return { message: 'Password changed successfully' };
    }
}
