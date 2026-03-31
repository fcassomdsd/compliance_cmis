export default [
  {
    languageOptions: {
      ecmaVersion: 5,
      sourceType: "script",
      globals: {
        logger: "readonly",
        document: "readonly",
        companyhome: "readonly",
        importScript: "readonly"
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
