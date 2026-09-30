// Prisma CLI configuration (migrations, generate). The app connects through
// the pg driver adapter in src/lib/server/db.ts.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations need a direct (unpooled) connection; Neon on Vercel provides
    // DATABASE_URL_UNPOOLED. Locally there is only DATABASE_URL.
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"],
  },
});
