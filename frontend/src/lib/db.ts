import { Pool } from "pg";
import { supabase } from "./supabase";

let pool: Pool | null = null;

export function getDatabasePool(): Pool | null {
  if (process.env.DATABASE_URL) {
    if (!pool) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
    }
    return pool;
  }
  return null;
}

export async function closeDatabasePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
