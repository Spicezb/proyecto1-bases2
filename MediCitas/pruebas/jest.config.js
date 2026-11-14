require("dotenv").config({
    path: require("path").join(__dirname, ".env.test")
});

module.exports = {
    testEnvironment: "node",
    testMatch: ["**/?(*.)+(test|spec).js"],
    testPathIgnorePatterns: ["/node_modules/"],
    clearMocks: true,
    verbose: false,
    reporters: [
        ["<rootDir>/reporter.js", {}]
    ]
};