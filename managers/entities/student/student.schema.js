const { label } = require("../../_common/schema.models");

module.exports = {
    createStudent: [
        { model: 'firstName', label: 'firstName', required: true },
        { model: 'lastName', label: 'lastName', required: true },
        { model: 'email', label: 'email', required: false },
        { model: 'dateOfBirth', label: 'dateOfBirth', required: false },
        { model: 'gender', label: 'gender', required: false },
        { model: 'mongoId', path: 'classroomId', label: 'classroomId', required: false }
    ],
    updateStudent: [
        { model: 'mongoId', path: 'id', label: 'id', required: true },
        { model: 'firstName', label: 'firstName', required: false },
        { model: 'lastName', label: 'lastName', required: false },
        { model: 'email', label: 'email', required: false },
        { model: 'dateOfBirth', label: 'dateOfBirth', required: false },
        { model: 'gender', label: 'gender', required: false },
        { model: 'studentStatus', path: 'status', label: 'status', required: false }
    ],
    getStudent: [
        { model: 'mongoId', path: 'id', label: 'id', required: true }
    ],
    deleteStudent: [
        { model: 'mongoId', path: 'id', label: 'id', required: true }
    ],
    transferStudent: [
        { model: 'mongoId', path: 'studentId', label: 'studentId', required: true },
        { model: 'mongoId', path: 'toSchoolId', label: 'toSchoolId', required: true },
        { model: 'transferReason', label: 'transferReason', required: false }
    ],
    assignClassroom: [
        { model: 'mongoId', path: 'studentId', label: 'studentId', required: true },
        { model: 'mongoId', path: 'classroomId', label: 'classroomId', required: true }
    ]
}
