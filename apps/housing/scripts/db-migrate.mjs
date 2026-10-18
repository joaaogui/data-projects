#!/usr/bin/env node
// Applies drizzle/ migrations to Neon. Usage: node scripts/db-migrate.mjs (POSTGRES_URL from env or .env.local)
//
// The housing tables predate the migration history (they were created with drizzle-kit push), so the
// first run records 0000_baseline as applied instead of executing it when the schema already exists.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsFolder = join(appDir, "drizzle");

function envUrl() {
  const fromEnv = (process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "").trim();
  if (fromEnv) return fromEnv;
  const envFile = join(appDir, ".env.local");
  if (!existsSync(envFile)) return "";
  const match = /^(?:DATABASE_URL|POSTGRES_URL)=(.*)$/m.exec(readFileSync(envFile, "utf8"));
  return match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
}

const url = envUrl();
if (!url) {
  console.error("POSTGRES_URL not set");
  process.exit(2);
}
const sql = neon(url);

const journal = JSON.parse(readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8"));
const baseline = journal.entries.find((e) => e.tag === "0000_baseline");
await sql.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
await sql.query(
  'CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)',
);
const applied = await sql.query('SELECT count(*)::int AS n FROM "drizzle"."__drizzle_migrations"');
const existing = await sql.query(
  "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'housing' AND table_name = 'property_qa'",
);
if (baseline && applied[0].n === 0 && existing[0].n > 0) {
  const hash = createHash("sha256")
    .update(readFileSync(join(migrationsFolder, `${baseline.tag}.sql`), "utf8"))
    .digest("hex");
  await sql.query('INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)', [
    hash,
    baseline.when,
  ]);
  console.log("recorded 0000_baseline as applied (existing schema)");
}

await migrate(drizzle(sql), { migrationsFolder });
const rows = await sql.query('SELECT id, created_at FROM "drizzle"."__drizzle_migrations" ORDER BY id');
console.log(`migrations applied: ${rows.length}`);
