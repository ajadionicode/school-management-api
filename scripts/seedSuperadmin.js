#!/usr/bin/env node

/**
 * Superadmin Seed Script
 *
 * Usage:
 *   node scripts/seedSuperadmin.js --username admin --email admin@example.com --password SecurePass123
 *
 * Or with environment variables:
 *   SUPERADMIN_USERNAME=admin SUPERADMIN_EMAIL=admin@example.com SUPERADMIN_PASSWORD=SecurePass123 node scripts/seedSuperadmin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
    const index = args.indexOf(`--${name}`);
    return index !== -1 ? args[index + 1] : null;
};

const username = getArg('username') || process.env.SUPERADMIN_USERNAME || 'superadmin';
const email = getArg('email') || process.env.SUPERADMIN_EMAIL;
const password = getArg('password') || process.env.SUPERADMIN_PASSWORD;

// Validation
if (!email) {
    console.error('Error: Email is required. Use --email <email> or set SUPERADMIN_EMAIL environment variable.');
    process.exit(1);
}

if (!password) {
    console.error('Error: Password is required. Use --password <password> or set SUPERADMIN_PASSWORD environment variable.');
    process.exit(1);
}

if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters long.');
    process.exit(1);
}

// MongoDB URI
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/school_management';

// User Schema (simplified for seeding)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['superadmin', 'school_admin'], required: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },
    isSeeded: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function seedSuperadmin() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB.');

        // Check if superadmin already exists
        const existingUser = await User.findOne({
            $or: [{ username }, { email }],
            isDeleted: false
        });

        if (existingUser) {
            if (existingUser.username === username) {
                console.error(`Error: User with username "${username}" already exists.`);
            } else {
                console.error(`Error: User with email "${email}" already exists.`);
            }
            await mongoose.disconnect();
            process.exit(1);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create superadmin
        const superadmin = new User({
            username,
            email,
            password: hashedPassword,
            role: 'superadmin',
            schoolId: null,
            isSeeded: true
        });

        await superadmin.save();

        console.log('\n========================================');
        console.log('Superadmin created successfully!');
        console.log('========================================');
        console.log(`ID:       ${superadmin._id}`);
        console.log(`Username: ${superadmin.username}`);
        console.log(`Email:    ${superadmin.email}`);
        console.log(`Role:     ${superadmin.role}`);
        console.log('========================================\n');

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
        process.exit(0);

    } catch (error) {
        console.error('Error seeding superadmin:', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
}

seedSuperadmin();
