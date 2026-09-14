export default [
  {
    ignores: ["node_modules/", "data/", "data.1/"]
  },
  {
    files: ["webscripts/**/*.js", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        logger: "readonly",
        document: "readonly",
        companyhome: "readonly",
        importScript: "readonly",
        jsonUtils: "readonly",
        status: "readonly",
        model: "readonly",
        __VSO_PATHS: "readonly",
        __VSO_FOLLOW_UP_HELPERS: "readonly",
        __VSO_SECURITY: "readonly",
        TemplateGeneration: "readonly",
        context: "readonly",
        args: "readonly",
        url: "readonly",
        json: "readonly",
        people: "readonly",
        person: "readonly",
        search: "readonly",
        space: "readonly"
      }
    },
    rules: {
      "no-empty": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "semi": ["warn", "always"],
      "quotes": ["warn", "double"],
      "indent": ["warn", 2],
      "eqeqeq": ["warn", "always"]
    }
  },
  {
    // Operator scripts that need ESM (the domain-rule checker is shared with
    // the vendored-spec tooling). Kept separate so the Rhino webscripts stay
    // in script mode.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "semi": ["warn", "always"],
      // The checker mirrors the single-quoted style used by the vendored-spec
      // tooling in the consumer repositories.
      "quotes": "off",
      "indent": ["warn", 2],
      "eqeqeq": ["warn", "always"]
    }
  }
];
