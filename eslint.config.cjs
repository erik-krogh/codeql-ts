// @ts-check

const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      eqeqeq: "error",

      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-namespace": "off",
      "no-unused-vars": ["off"], // Handled by @typescript-eslint/no-unused-vars
      "@typescript-eslint/no-unused-expressions": ["off"],
    },
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: [
          "./tsconfig.json",
          "./test/tsconfig.json",
          ".github/scripts/tsconfig.json",
        ],
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
  },
);
