const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        minlength: 3,
        maxlength: 20
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['superadmin', 'school_admin'],
        required: true,
        default: 'school_admin'
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        default: null
    },
    // Account lockout fields
    failedLoginAttempts: {
        type: Number,
        default: 0
    },
    lockoutUntil: {
        type: Date,
        default: null
    },
    // Token management
    tokenVersion: {
        type: Number,
        default: 0
    },
    // Seeded account protection (cannot change password or delete)
    isSeeded: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

userSchema.index({ email: 1, isDeleted: 1 });
userSchema.index({ username: 1, isDeleted: 1 });

module.exports = mongoose.model('User', userSchema);
