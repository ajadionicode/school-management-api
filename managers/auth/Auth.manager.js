const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');
const md5 = require('md5');

module.exports = class Auth {

    constructor({ utils, cache, config, cortex, managers, validators, mongomodels } = {}) {
        this.config = config;
        this.cortex = cortex;
        this.cache = cache;
        this.validators = validators;
        this.mongomodels = mongomodels;
        this.tokenManager = managers.token;
        this.responseDispatcher = managers.responseDispatcher;

        // Read config from environment (with defaults)
        this.maxLoginAttempts = parseInt(config.dotEnv.MAX_LOGIN_ATTEMPTS) || 5;
        this.lockoutDurationMs = parseInt(config.dotEnv.LOCKOUT_DURATION_MS) || 15 * 60 * 1000;

        this.httpExposed = [
            'login',
            'post=refreshToken',
            'post=logout',
            'post=changePassword',
            'get=me'
        ];
    }

    /**
     * Check if account is locked
     */
    _isAccountLocked(user) {
        if (!user.lockoutUntil) return false;
        if (new Date() > new Date(user.lockoutUntil)) {
            return false; // Lockout expired
        }
        return true;
    }

    /**
     * Handle failed login attempt
     */
    async _handleFailedLogin(user) {
        const attempts = (user.failedLoginAttempts || 0) + 1;
        const updateData = { failedLoginAttempts: attempts };

        if (attempts >= this.maxLoginAttempts) {
            updateData.lockoutUntil = new Date(Date.now() + this.lockoutDurationMs);
        }

        await this.mongomodels.user.updateOne(
            { _id: user._id },
            { $set: updateData }
        );

        return attempts;
    }

    /**
     * Reset failed login attempts on successful login
     */
    async _resetFailedAttempts(user) {
        await this.mongomodels.user.updateOne(
            { _id: user._id },
            { $set: { failedLoginAttempts: 0, lockoutUntil: null } }
        );
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

        // Check if account is locked
        if (this._isAccountLocked(user)) {
            const remainingMs = new Date(user.lockoutUntil) - new Date();
            const remainingMins = Math.ceil(remainingMs / 60000);
            return {
                error: `Account is locked. Try again in ${remainingMins} minute(s)`,
                code: 401
            };
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            const attempts = await this._handleFailedLogin(user);
            const remaining = this.maxLoginAttempts - attempts;
            const lockoutMins = Math.ceil(this.lockoutDurationMs / 60000);

            if (remaining <= 0) {
                return {
                    error: `Account locked due to too many failed attempts. Try again in ${lockoutMins} minutes`,
                    code: 401
                };
            }

            return {
                error: `Invalid credentials. ${remaining} attempt(s) remaining`,
                code: 401
            };
        }

        // Reset failed attempts on successful login
        await this._resetFailedAttempts(user);

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

        // Verify user still exists
        const user = await this.mongomodels.user.findOne({
            _id: __longToken.userId,
            isDeleted: false
        });

        if (!user) {
            return {
                error: 'User not found',
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

    async logout({ __schoolToken }) {
        if (!__schoolToken) {
            return {
                error: 'Authentication required',
                code: 401
            };
        }

        // Store invalidated session in Redis with TTL (1 year = token expiry)
        const sessionKey = `invalidated:session:${__schoolToken.sessionId}`;
        await this.cache.key.set({
            key: sessionKey,
            data: '1',
            ttl: 365 * 24 * 60 * 60  // 1 year (matches short token expiry)
        });

        return {
            message: 'Logged out successfully',
            code: 204
        };
    }

    async me({ __schoolToken }) {
        if (!__schoolToken) {
            return {
                error: 'Authentication required',
                code: 401
            };
        }

        const user = await this.mongomodels.user.findOne({
            _id: __schoolToken.userId,
            isDeleted: false
        }).populate('schoolId', 'name');

        if (!user) {
            return {
                error: 'User not found',
                code: 404
            };
        }

        const response = {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };

        // Include school info for school_admin
        if (user.role === 'school_admin' && user.schoolId) {
            response.school = {
                id: user.schoolId._id,
                name: user.schoolId.name
            };
        }

        return { user: response };
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

        // Validate password strength
        const hasUppercase = /[A-Z]/.test(newPassword);
        const hasLowercase = /[a-z]/.test(newPassword);
        const hasNumber = /[0-9]/.test(newPassword);

        if (!hasUppercase || !hasLowercase || !hasNumber) {
            return {
                error: 'Password must contain at least 1 uppercase, 1 lowercase, and 1 number',
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

        // Prevent password change for seeded accounts (demo protection)
        if (user.isSeeded) {
            return {
                error: 'Cannot change password for this account',
                code: 403
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
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await this.mongomodels.user.updateOne(
            { _id: user._id },
            { $set: { password: hashedPassword } }
        );

        return { message: 'Password changed successfully' };
    }
}
