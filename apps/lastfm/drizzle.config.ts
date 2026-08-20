import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Confine every drizzle-kit operation to this app's namespace. Without it,
  // push would see the youtube app's tables in `public` as drift and offer to
  // drop them.
  schemaFilter: ["lastfm"],
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
});
