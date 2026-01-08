const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        minlength: 1,
        maxlength: 50
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true,
        index: true
    },
    capacity: {
        type: Number,
        required: true,
        min: 1
    },
    grade: {
        type: String,
        maxlength: 20
    },
    section: {
        type: String,
        maxlength: 10
    },
    resources: [{
        name: { type: String },
        quantity: { type: Number }
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

module.exports = mongoose.model('Classroom', classroomSchema);
