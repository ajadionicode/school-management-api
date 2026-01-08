module.exports = {
    createUser: [
        { model: 'username', required: true },
        { model: 'email', required: true },
        { model: 'password', required: true },
        { model: 'role', required: true },
        { model: 'mongoId', path: 'schoolId', required: false }
    ],
    updateUser: [
        { model: 'mongoId', path: 'id', required: true },
        { model: 'username', required: false },
        { model: 'email', required: false },
        { model: 'role', required: false },
        { model: 'mongoId', path: 'schoolId', required: false }
    ],
    getUser: [
        { model: 'mongoId', path: 'id', required: true }
    ],
    deleteUser: [
        { model: 'mongoId', path: 'id', required: true }
    ]
}
