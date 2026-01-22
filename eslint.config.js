import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    ignores: ["public/**/*.js"],
    languageOptions: {
      globals: globals.node,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      "no-console": "off",
    },
  },
  {
    files: ["public/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        Swal: "readonly",
        Razorpay: "readonly",
        bootstrap: "readonly",
      },
      ecmaVersion: "latest",
      sourceType: "script",
    },
    rules: {
      "no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      "no-console": "off",
      "no-undef": "error",
    },
  },
  js.configs.recommended,
]);
