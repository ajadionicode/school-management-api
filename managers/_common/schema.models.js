const emojis = require('../../public/emojis.data.json');

module.exports = {
    id: {
        path: "id",
        type: "string",
        length: { min: 1, max: 50 },
    },
    mongoId: {
        type: 'string',
        length: { min: 24, max: 24 },
        custom: 'mongoId',
    },
    username: {
        path: 'username',
        type: 'string',
        length: {min: 3, max: 20},
        custom: 'username',
    },
    password: {
        path: 'password',
        type: 'string',
        length: {min: 8, max: 100},
    },
    email: {
        path: 'email',
        type: 'string',
        length: {min:3, max: 100},
        regex: /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    },
    title: {
        path: 'title',
        type: 'string',
        length: {min: 3, max: 300}
    },
    label: {
        path: 'label',
        type: 'string',
        length: {min: 3, max: 100}
    },
    shortDesc: {
        path: 'desc',
        type: 'string',
        length: {min:3, max: 300}
    },
    longDesc: {
        path: 'desc',
        type: 'string',
        length: {min:3, max: 2000}
    },
    url: {
        path: 'url',
        type: 'string',
        length: {min: 9, max: 300},
    },
    emoji: {
        path: 'emoji',
        type: 'Array',
        items: {
            type: 'string',
            length: {min: 1, max: 10},
            oneOf: emojis.value,
        }
    },
    price: {
        path: 'price',
        type: 'number',
    },
    avatar: {
        path: 'avatar',
        type: 'string',
        length: {min: 8, max: 100},
    },
    text: {
        type: 'String',
        length: {min: 3, max:15},
    },
    longText: {
        type: 'String',
        length: {min: 3, max:250},
    },
    paragraph: {
        type: 'String',
        length: {min: 3, max:10000},
    },
    phone: {
        type: 'String',
        length: 13,
    },
    // email: {
    //     type: 'String',
    //     regex: /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    // },
    number: {
        type: 'Number',
        length: {min: 1, max:6},
    },
    arrayOfStrings: {
        type: 'Array',
        items: {
            type: 'String',
            length: { min: 3, max: 100}
        }
    },
    obj: {
        type: 'Object',
    },
    bool: {
        type: 'Boolean',
    },

    // School Management Models
    schoolName: {
        path: 'name',
        type: 'string',
        length: { min: 2, max: 100 },
    },
    schoolAddress: {
        path: 'address',
        type: 'string',
        length: { min: 0, max: 500 },
    },
    capacity: {
        path: 'capacity',
        type: 'number',
    },
    grade: {
        path: 'grade',
        type: 'string',
        length: { min: 1, max: 20 },
    },
    section: {
        path: 'section',
        type: 'string',
        length: { min: 1, max: 10 },
    },
    firstName: {
        path: 'firstName',
        type: 'string',
        length: { min: 1, max: 50 },
    },
    lastName: {
        path: 'lastName',
        type: 'string',
        length: { min: 1, max: 50 },
    },
    dateOfBirth: {
        path: 'dateOfBirth',
        type: 'string',
        custom: 'dateString',
    },
    gender: {
        path: 'gender',
        type: 'string',
        oneOf: ['male', 'female', 'other'],
    },
    studentStatus: {
        path: 'status',
        type: 'string',
        oneOf: ['enrolled', 'transferred', 'graduated', 'withdrawn'],
    },
    role: {
        path: 'role',
        type: 'string',
        oneOf: ['superadmin', 'school_admin'],
    },
    principalName: {
        path: 'principalName',
        type: 'string',
        length: { min: 2, max: 100 },
    },
    guardianName: {
        path: 'guardianName',
        type: 'string',
        length: { min: 2, max: 100 },
    },
    guardianPhone: {
        path: 'guardianPhone',
        type: 'string',
        length: { min: 7, max: 20 },
    },
    guardianEmail: {
        path: 'guardianEmail',
        type: 'string',
        regex: /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    },
    studentAddress: {
        path: 'address',
        type: 'string',
        length: { min: 0, max: 500 },
    },
    transferReason: {
        path: 'reason',
        type: 'string',
        length: { min: 0, max: 500 },
    },
}