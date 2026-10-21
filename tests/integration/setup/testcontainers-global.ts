import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Client } from "pg";
import fs from "node:fs";
import path from "node:path";

let postgresContainer: StartedPostgreSqlContainer | null = null;

export async function setup() {
  console.log("\n[Testcontainers] Verificando disponibilidade do Docker...");

  try {
    // Configura container com otimizações em memória (Aula 02 - Slide 9 e 10)
    // - postgres:16-alpine
    // - fsync=off, synchronous_commit=off, full_page_writes=off para performance ultrarrápida
    const container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("studyflow_test")
      .withUsername("postgres")
      .withPassword("postgres")
      .withCommand([
        "postgres",
        "-c", "fsync=off",
        "-c", "synchronous_commit=off",
        "-c", "full_page_writes=off"
      ])
      .withStartupTimeout(60_000)
      .start();

    postgresContainer = container;
    const connectionUri = container.getConnectionUri();
    process.env.DATABASE_URL = connectionUri;
    process.env.TESTCONTAINERS_AVAILABLE = "true";

    console.log(`[Testcontainers] PostgreSQL 16 Alpine efêmero iniciado em: ${connectionUri}`);

    // Aplicar Migrations (Schema DDL)
    const client = new Client({ connectionString: connectionUri });
    await client.connect();

    // 1. Criar stub do schema auth exigido pelo Supabase
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text UNIQUE,
        created_at timestamptz DEFAULT now()
      );
    `);

    // 2. Executar schema.sql da aplicação
    const schemaPath = path.resolve(__dirname, "../../../supabase/schema.sql");
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, "utf-8");
      await client.query(sql);
      console.log("[Testcontainers] Migrations e schema do Supabase aplicados com sucesso.");
    }

    await client.end();
  } catch (err: any) {
    console.warn(
      `[Testcontainers] Docker daemon não disponível no ambiente atual (${err.message}). ` +
      `Os testes executarão em modo de compatibilidade/validação de fronteira.`
    );
    process.env.TESTCONTAINERS_AVAILABLE = "false";
  }
}

export async function teardown() {
  if (postgresContainer) {
    console.log("[Testcontainers] Encerrando contêiner PostgreSQL efêmero...");
    await postgresContainer.stop();
    postgresContainer = null;
  }
}
