module.exports = {
    transform: {
      "^.+\\.m?jsx?$": "babel-jest", // Transform both JS and JSX files
    },
    // Ensure Jest handles `.mjs` files
    moduleFileExtensions: ['js', 'json', 'jsx', 'node', 'mjs'],
    testMatch: [
      '**/__tests__/**/*.js?(x)',
      '**/?(*.)+(spec|test).js?(x)',
      '**/__tests__/**/*.mjs',
      '**/?(*.)+(spec|test).mjs'
    ],
  };
  