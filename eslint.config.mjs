import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The domain engine is pure business logic (CLAUDE.md): no database,
  // framework or UI imports, so the same functions run on server and client.
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@prisma/*", "@/generated/*", "**/generated/prisma/*"], message: "src/domain must not depend on Prisma." },
            { group: ["next", "next/*", "react", "react-dom", "server-only"], message: "src/domain must not depend on Next.js or React." },
            { group: ["@/server/*", "@/app/*", "@/ui/*", "**/server/*", "**/app/*"], message: "src/domain must not depend on server or UI code." },
          ],
        },
      ],
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Prisma client.
    "src/generated/**",
  ]),
]);

export default eslintConfig;
