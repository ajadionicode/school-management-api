/**
 * Jest Test Setup
 *
 * This file runs before all tests to set up the test environment.
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Test database URI
const TEST_MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/school_management_test';

// Connect to test database before all tests
beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(TEST_MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
    }
});

// Clean up after each test
afterEach(async () => {
    // Clear all collections after each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});

// Disconnect after all tests
afterAll(async () => {
    await mongoose.connection.close();
});

// Increase timeout for database operations
jest.setTimeout(30000);
