import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["housing"],
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
});
