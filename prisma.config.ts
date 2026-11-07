import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma CLI config (migrate, seed, generate).
// Migrations use Neon's DIRECT (unpooled) connection: the pooled endpoint runs
// PgBouncer in transaction mode, which breaks the advisory locks migrate needs.
// The app itself connects through the pooled DATABASE_URL (src/server/db.ts).
// process.env (not env()) so `prisma generate` still works where no DB URL is set.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
