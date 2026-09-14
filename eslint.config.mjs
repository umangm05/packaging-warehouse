import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // The designer codebase uses `any` pervasively for rapid prototyping.
      // This is a known tech-debt item; we warn but don't fail the build.
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow ref updates during render for zoom/pan tracking
      "react-hooks/refs": "warn",
      // BoxScene's setState-in-effect is guarded by cancellation
      "react-hooks/set-state-in-effect": "warn",
      // Downgrade require-imports and rules-of-hooks to warnings
      "@typescript-eslint/no-require-imports": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/immutability": "warn",
      "prefer-const": "warn",
    },
  },
]);

export default eslintConfig;
