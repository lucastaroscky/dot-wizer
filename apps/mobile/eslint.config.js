const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

const SERVER_ONLY = "O app não pode importar código de servidor. Use @pontinho/protocol ou @pontinho/rules.";

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", "dist-check/*"] },
  {
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@pontinho/game", "@pontinho/game/*", "@pontinho/api", "@pontinho/api/*"], message: SERVER_ONLY }] }],
      "import/no-restricted-paths": [
        "error",
        {
          basePath: __dirname,
          zones: [
            { target: "./src", from: "../game", message: SERVER_ONLY },
            { target: "./src", from: "../api", message: SERVER_ONLY },
          ],
        },
      ],
    },
  },
]);
