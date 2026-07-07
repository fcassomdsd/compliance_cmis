export default [
  {
    ignores: ["node_modules/", "data/", "data.1/"]
  },
  {
    files: ["webscripts/**/*.js", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 5,
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
        TemplateGeneration: "readonly",
        context: "readonly",
        args: "readonly",
        url: "readonly",
        json: "readonly",
        people: "readonly",
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
  }
];
