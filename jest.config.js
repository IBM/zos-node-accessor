module.exports = {
    "roots": [
      "./"
    ],
    "transform": {
        "^.+\\.ts?$": "ts-jest"
    },
    "testEnvironment": 'node',
    "restoreMocks": true,
    "testRegex": "(/__test__/.*|(\\.|/)(test|spec))\\.ts",
    "moduleFileExtensions": [
      "ts",
      "js"
    ],
    "collectCoverage": true,
    "collectCoverageFrom": [
      "**/*.ts",
      "!src/__unit__/**/*.ts",
      "!src/__test__/**/*.ts"
    ],
    "coverageDirectory": "coverage",
    "coveragePathIgnorePatterns": [
        ".d.ts"
    ]
  }
  