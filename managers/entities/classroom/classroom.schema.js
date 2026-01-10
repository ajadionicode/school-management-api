const { label } = require("../../_common/schema.models");

module.exports = {
    createClassroom: [
        { model: 'text', path: 'name', label: 'Name', required: true },
        { model: 'capacity', label: 'Capacity', required: true },
        { model: 'grade', label: 'Grade', required: false },
        { model: 'section', label: 'Section', required: false }
    ],
    updateClassroom: [
        { model: 'mongoId', path: 'id', label: 'ID', required: true },
        { model: 'text', path: 'name', label: 'Name', required: false },
        { model: 'capacity', label: 'Capacity', required: false },
        { model: 'grade', label: 'Grade', required: false },
        { model: 'section', label: 'Section', required: false }
    ],
    getClassroom: [
        { model: 'mongoId', path: 'id', label: 'ID', required: true }
    ],
    deleteClassroom: [
        { model: 'mongoId', path: 'id', label: 'ID', required: true }
    ]
}
