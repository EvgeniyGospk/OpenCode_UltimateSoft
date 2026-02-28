import js from "@eslint/js";
import globals from "globals";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      },
      globals: {
        ...globals.browser
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      // Disable base rule — it flags TS interface/type params incorrectly
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true
        }
      ],
      ...reactHooks.configs.recommended.rules,
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true }
      ],
      "@typescript-eslint/no-explicit-any": "error"
    }
  },
  {
    // Config files run in Node, not browser
    files: ["vitest.config.ts", "vite.config.ts"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-undef": "off"
    }
  },
  {
    // Test files use vitest globals
    files: ["src/test/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    ignores: ["dist/**", "eslint.config.js"]
  }
];
