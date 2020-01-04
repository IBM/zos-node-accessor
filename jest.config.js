module.exports = {
    "roots": [
      "./"
    ],
    "testEnvironment": 'node',
    "restoreMocks": true,
    "testRegex": "(/test/.*|(\\.|/)(tests|spec))\\.js",
    "moduleFileExtensions": [
      "ts",
      "tsx",
      "js",
      "jsx",
      "json",
      "node"
    ],
    "collectCoverage": true,
    "collectCoverageFrom": [
      "**/*.ts"
    ],
    "coverageDirectory": "coverage"
  }
  