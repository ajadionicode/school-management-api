module.exports = {
    createSchool: [
        { model: 'schoolName', required: true },
        { model: 'schoolAddress', required: false },
        { model: 'phone', required: false },
        { model: 'email', required: false },
        { model: 'principalName', required: false }
    ],
    updateSchool: [
        { model: 'mongoId', path: 'id', required: true },
        { model: 'schoolName', required: false },
        { model: 'schoolAddress', required: false },
        { model: 'phone', required: false },
        { model: 'email', required: false },
        { model: 'principalName', required: false }
    ],
    getSchool: [
        { model: 'mongoId', path: 'id', required: true }
    ],
    deleteSchool: [
        { model: 'mongoId', path: 'id', required: true }
    ]
}
