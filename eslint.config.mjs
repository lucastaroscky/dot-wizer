import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["apps/mobile/**", "**/build/**", "**/node_modules/**"] },
  tseslint.configs.recommended,
);
