import tseslint from "typescript-eslint";
import noComments from "eslint-plugin-no-comments";

export default tseslint.config(
  { ignores: ["apps/mobile/**", "apps/api/src/generated/**", "**/build/**", "**/node_modules/**"] },
  tseslint.configs.recommended,
  {
    files: ["apps/api/**/*.ts"],
    plugins: { "no-comments": noComments },
    rules: {
      "no-comments/disallowComments": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-nested-ternary": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["apps/api/src/**/*.ts"],
    ignores: ["**/*.spec.ts"],
    rules: {
      "max-lines-per-function": ["error", { max: 20, skipBlankLines: true, skipComments: true }],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name=/^(delete|deleteMany)$/]:matches([callee.object.object.property.name=/^(prisma|client)$/], [callee.object.object.name='tx'])",
          message: "Não apague registro: desative com `active`. Se apagar for o certo, peça ao Lucas.",
        },
      ],
    },
  },
  {
    files: ["apps/api/src/**/*.repository.ts"],
    rules: { "max-lines-per-function": "off" },
  },
);
