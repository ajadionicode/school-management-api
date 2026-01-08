const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 100
    },
    address: {
        type: String,
        maxlength: 500
    },
    phone: {
        type: String,
        maxlength: 20
    },
    email: {
        type: String
    },
    principalName: {
        type: String,
        maxlength: 100
    },
    establishedYear: {
        type: Number
    },
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

schoolSchema.index({ isDeleted: 1 });
schoolSchema.index({ name: 1, isDeleted: 1 });

module.exports = mongoose.model('School', schoolSchema);
