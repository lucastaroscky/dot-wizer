const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

const SERVER_ONLY = "O app não pode importar código de servidor. Use @pontinho/protocol ou @pontinho/rules.";
const ONE_WAY = "Imports seguem um sentido só: shared → features → app.";
const FEATURE_ALONE = "Uma feature não importa outra. Junte as duas na rota, em src/app.";

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
            { target: "./src/shared", from: "./src/features", message: ONE_WAY },
            { target: "./src/shared", from: "./src/app", message: ONE_WAY },
            { target: "./src/features", from: "./src/app", message: ONE_WAY },
            { target: "./src/features/lobby", from: "./src/features", except: ["./lobby"], message: FEATURE_ALONE },
            { target: "./src/features/match", from: "./src/features", except: ["./match"], message: FEATURE_ALONE },
          ],
        },
      ],
    },
  },
]);
