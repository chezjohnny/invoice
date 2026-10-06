// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = defineConfig([
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        { type: "attribute", prefix: "app", style: "camelCase" },
      ],
      // Attribute selectors keep table semantics: th[appSortHeader] is the <th>.
      "@angular-eslint/component-selector": [
        "error",
        [
          { type: "element", prefix: "app", style: "kebab-case" },
          { type: "attribute", prefix: "app", style: "camelCase" },
        ],
      ],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      // `x != null` covers null and undefined, as in the TypeScript code.
      "@angular-eslint/template/eqeqeq": ["error", { allowNullOrUndefined: true }],
    },
  },
]);
