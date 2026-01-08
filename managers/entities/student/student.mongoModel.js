const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        minlength: 1,
        maxlength: 50
    },
    lastName: {
        type: String,
        required: true,
        minlength: 1,
        maxlength: 50
    },
    email: {
        type: String
    },
    dateOfBirth: {
        type: Date
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other']
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true,
        index: true
    },
    classroomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Classroom',
        index: true
    },
    enrollmentDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['enrolled', 'transferred', 'graduated', 'withdrawn'],
        default: 'enrolled'
    },
    guardianName: {
        type: String,
        maxlength: 100
    },
    guardianPhone: {
        type: String,
        maxlength: 20
    },
    guardianEmail: {
        type: String
    },
    address: {
        type: String,
        maxlength: 500
    },
    transferHistory: [{
        fromSchoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
        toSchoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
        transferDate: { type: Date },
        reason: { type: String }
    }],
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Student', studentSchema);
