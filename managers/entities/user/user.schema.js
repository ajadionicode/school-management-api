module.exports = {
    createUser: [
        { model: 'username', label: 'username', required: true },
        { model: 'email', label: 'email', required: true },
        { model: 'password', label: 'password', required: true },
        { model: 'role', label: 'role', required: true },
        { model: 'mongoId', label: 'schoolId', path: 'schoolId', required: false }
    ],
    updateUser: [
        { model: 'mongoId', path: 'id', label: 'id', required: true },
        { model: 'username', label: 'username', required: false },
        { model: 'email', label: 'email', required: false },
        { model: 'role', label: 'role', required: false },
        { model: 'mongoId', path: 'schoolId', label: 'schoolId', required: false }
    ],
    getUser: [
        { model: 'mongoId', path: 'id', label: 'id', required: true }
    ],
    deleteUser: [
        { model: 'mongoId', path: 'id', label: 'id', required: true }
    ]
}
