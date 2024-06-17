export default {
    rootDir: "../",  // Points to the project root from the jest_config directory
    moduleFileExtensions: ['js', 'json', 'jsx', 'node', 'mjs'],
    transform: {
        '^.+\\.m?js$': 'babel-jest',
    },
    testEnvironment: 'node',
    globalSetup: './jest_config/jest.setup.mjs',
    globalTeardown: './jest_config/jest.teardown.mjs',
    testMatch: [
        "__tests__/**/*.[jt]s?(x)",  // Correctly matching JavaScript and TypeScript test files in __tests__ directories
        "?(*.)+(spec|test).[jt]s?(x)", // Correctly matching spec and test files
        "**/*.test.mjs" // Add this line to match .mjs test files
    ],
    testPathIgnorePatterns: [
        "__tests__/setup.mjs"  // Correctly ignoring setup.mjs in the __tests__ directory
    ]
};
