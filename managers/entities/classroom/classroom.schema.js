module.exports = {
    createClassroom: [
        { model: 'text', path: 'name', required: true },
        { model: 'capacity', required: true },
        { model: 'grade', required: false },
        { model: 'section', required: false }
    ],
    updateClassroom: [
        { model: 'mongoId', path: 'id', required: true },
        { model: 'text', path: 'name', required: false },
        { model: 'capacity', required: false },
        { model: 'grade', required: false },
        { model: 'section', required: false }
    ],
    getClassroom: [
        { model: 'mongoId', path: 'id', required: true }
    ],
    deleteClassroom: [
        { model: 'mongoId', path: 'id', required: true }
    ]
}
