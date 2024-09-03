export default {
    rootDir: "../",  
    moduleFileExtensions: ['js', 'json', 'jsx', 'node', 'mjs'],
    transform: {
        '^.+\\.m?js$': 'babel-jest',
    },
    testEnvironment: 'node',
    globalSetup: './jest_config/jest.setup.mjs',
    globalTeardown: './jest_config/jest.teardown.mjs',
    testMatch: [
        "__tests__/**/*.[jt]s?(x)", 
        "?(*.)+(spec|test).[jt]s?(x)", 
        "**/*.test.mjs" 
    ],
    testPathIgnorePatterns: [
        "__tests__/setup.mjs"  
    ]
};
