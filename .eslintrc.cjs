const path = require("path");

module.exports = {
    root: true,
    env: {
        browser: true,
        es2021: true,
    },
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
            jsx: true,
        },
        project: [
            path.join(__dirname, "./tsconfig.app.json"),
            path.join(__dirname, "./tsconfig.node.json"),
        ],
        tsconfigRootDir: __dirname,
    },
    ignorePatterns: ["dist/", "node_modules/"],
    plugins: ["@typescript-eslint", "react-hooks"],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:react-hooks/recommended",
    ],
    rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
    },
};
