module.exports = {
    createStudent: [
        { model: 'firstName', required: true },
        { model: 'lastName', required: true },
        { model: 'email', required: false },
        { model: 'dateOfBirth', required: false },
        { model: 'gender', required: false },
        { model: 'mongoId', path: 'classroomId', required: false }
    ],
    updateStudent: [
        { model: 'mongoId', path: 'id', required: true },
        { model: 'firstName', required: false },
        { model: 'lastName', required: false },
        { model: 'email', required: false },
        { model: 'dateOfBirth', required: false },
        { model: 'gender', required: false },
        { model: 'studentStatus', path: 'status', required: false }
    ],
    getStudent: [
        { model: 'mongoId', path: 'id', required: true }
    ],
    deleteStudent: [
        { model: 'mongoId', path: 'id', required: true }
    ],
    transferStudent: [
        { model: 'mongoId', path: 'studentId', required: true },
        { model: 'mongoId', path: 'toSchoolId', required: true },
        { model: 'transferReason', required: false }
    ],
    assignClassroom: [
        { model: 'mongoId', path: 'studentId', required: true },
        { model: 'mongoId', path: 'classroomId', required: true }
    ]
}
