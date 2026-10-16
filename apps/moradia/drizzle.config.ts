import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["moradia"],
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
});
