import net from "node:net";
import { Client } from "pg";
import { montarBanco } from "./migrations";

/**
 * Setup global dos testes de integração.
 *
 * O banco é montado aplicando `supabase/migrations` em ordem, exatamente o que vai para
 * produção (ver ./migrations.ts).
 *
 * Motores de banco (variável INTEGRATION_DB):
 *  - "testcontainers": PostgreSQL 16 real em contêiner Docker (padrão no CI).
 *  - "pglite": PostgreSQL real em processo (WASM) exposto via socket TCP local; é o que roda
 *    em máquinas sem Docker. Os testes são os mesmos nos dois motores.
 *  - não definido: tenta Testcontainers e, se o Docker não estiver disponível, cai para PGlite.
 *
 * Se nenhum motor funcionar, lança erro (nunca executa contra o Supabase de produção).
 */

type Engine = "testcontainers" | "pglite";

let stopEngine: (() => Promise<void>) | null = null;

async function montarBancoViaClient(connectionUri: string) {
  const client = new Client({ connectionString: connectionUri });
  await client.connect();
  try {
    await montarBanco((sql) => client.query(sql));
  } finally {
    await client.end();
  }
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

async function startTestcontainers(): Promise<string> {
  const { PostgreSqlContainer } = await import("@testcontainers/postgresql");
  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("studyflow_test")
    .withUsername("postgres")
    .withPassword("postgres")
    .withCommand([
      "postgres",
      "-c", "fsync=off",
      "-c", "synchronous_commit=off",
      "-c", "full_page_writes=off",
    ])
    .withStartupTimeout(60_000)
    .start();

  stopEngine = async () => {
    await container.stop();
  };
  const uri = container.getConnectionUri();
  await montarBancoViaClient(uri);
  return uri;
}

async function startPglite(): Promise<string> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { pgcrypto } = await import("@electric-sql/pglite/contrib/pgcrypto");
  const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");

  const db = await PGlite.create({ extensions: { pgcrypto } });
  const port = await getFreePort();
  const server = new PGLiteSocketServer({
    db,
    port,
    host: "127.0.0.1",
    maxConnections: 20,
  });
  await server.start();

  stopEngine = async () => {
    await server.stop();
    await db.close();
  };

  // Migrations aplicadas direto na instância (mais rápido e sem depender da conexão TCP).
  await montarBanco((sql) => db.exec(sql));

  return `postgres://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
}

export async function setup() {
  const requested = (process.env.INTEGRATION_DB || "").toLowerCase();
  if (requested && requested !== "pglite" && requested !== "testcontainers") {
    throw new Error(`INTEGRATION_DB inválido: '${requested}' (use 'pglite' ou 'testcontainers')`);
  }

  const order: Engine[] =
    requested === "pglite" ? ["pglite"]
    : requested === "testcontainers" ? ["testcontainers"]
    : ["testcontainers", "pglite"];

  const errors: string[] = [];
  for (const engine of order) {
    try {
      const uri = engine === "testcontainers" ? await startTestcontainers() : await startPglite();
      process.env.DATABASE_URL = uri;
      process.env.INTEGRATION_DB_ENGINE = engine;
      process.env.TESTCONTAINERS_AVAILABLE = engine === "testcontainers" ? "true" : "false";
      console.log(`\n[Integration] Motor de banco: ${engine} -> ${uri.replace(/:\/\/.*@/, "://***@")}`);
      return;
    } catch (err: any) {
      errors.push(`${engine}: ${err?.message ?? err}`);
      if (stopEngine) {
        await stopEngine().catch(() => undefined);
        stopEngine = null;
      }
      console.warn(`[Integration] Motor '${engine}' indisponível (${err?.message ?? err}).`);
    }
  }

  delete process.env.DATABASE_URL;
  throw new Error(
    `Nenhum motor de banco disponível para os testes de integração. ${errors.join(" | ")}`
  );
}

export async function teardown() {
  if (stopEngine) {
    console.log("[Integration] Encerrando banco efêmero...");
    await stopEngine();
    stopEngine = null;
  }
}
