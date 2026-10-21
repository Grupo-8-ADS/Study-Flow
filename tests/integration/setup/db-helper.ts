import { Pool, PoolClient } from "pg";

let testPool: Pool | null = null;

export function getTestPool(): Pool | null {
  if (process.env.DATABASE_URL) {
    if (!testPool) {
      testPool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
    }
    return testPool;
  }
  return null;
}

export async function closeTestPool() {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

/**
 * Truncate seletivo das tabelas de negócio para limpeza de estado entre testes (Aula 02 - Slide 11)
 */
export async function cleanTables(tables: string[] = ["disciplinas", "profiles", "auth.users"]) {
  const pool = getTestPool();
  if (!pool) return;

  try {
    for (const table of tables) {
      const qualified = table.includes(".") ? table : `public.${table}`;
      await pool.query(`TRUNCATE TABLE ${qualified} CASCADE;`);
    }
  } catch (err: any) {
    console.warn(`[db-helper] Aviso ao limpar tabelas: ${err.message}`);
  }
}

/**
 * Insere um perfil fake diretamente na base de testes para satisfazer FK de user_id
 */
export async function seedProfile(userId: string, nome: string = "Estudante Teste", email: string = "teste@unifei.edu.br") {
  const pool = getTestPool();
  if (!pool) return;

  // profiles.id referencia auth.users(id); o trigger handle_new_user cria o perfil automaticamente
  await pool.query(
    `INSERT INTO auth.users (id, email, raw_user_meta_data)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, email, JSON.stringify({ nome, username: `user_${userId.slice(0, 8)}` })]
  );
}
