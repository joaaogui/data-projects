import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const sql = neon(process.env.POSTGRES_URL!);
  return drizzle(sql, { schema });
}

let _db: ReturnType<typeof createDb>;

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    _db ??= createDb();
    return (_db as unknown as Record<string | symbol, unknown>)[prop];
  },
});
