import fs from "node:fs";
import path from "node:path";

/**
 * Monta o banco de teste do mesmo jeito que produção: aplicando `supabase/migrations` em ordem.
 * As migrations são a única fonte da verdade do schema; não existe um schema.sql paralelo.
 */

export const MIGRATIONS_DIR = path.resolve(__dirname, "../../../supabase/migrations");

/** Versão no padrão do Supabase CLI: 14 dígitos (AAAAMMDDHHMMSS) antes do primeiro "_". */
const NOME_MIGRATION = /^(\d{14})_([a-z0-9_]+)\.sql$/;

export type Migration = { versao: string; nome: string; arquivo: string; sql: string };

export function lerMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  const arquivos = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  return arquivos.map((arquivo) => {
    const m = NOME_MIGRATION.exec(arquivo);
    if (!m) {
      throw new Error(`Migration com nome fora do padrão AAAAMMDDHHMMSS_nome.sql: ${arquivo}`);
    }
    return { versao: m[1], nome: m[2], arquivo, sql: fs.readFileSync(path.join(dir, arquivo), "utf-8") };
  });
}

/**
 * O que o Supabase já traz pronto e as migrations pressupõem: schema `auth` com `auth.users`,
 * `auth.uid()`/`auth.role()`, extensões no schema `extensions`, os papéis da API e os
 * privilégios padrão que o Supabase dá a eles no schema public (tabelas, funções e sequências).
 */
export const SUPABASE_STUB_SQL = `
  create schema if not exists extensions;
  create extension if not exists "pgcrypto" with schema extensions;
  create schema if not exists auth;

  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz default now()
  );

  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;

  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

  create or replace function auth.uid() returns uuid
  language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;

  create or replace function auth.role() returns text
  language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
    )::text
  $$;
`;

/** Executor mínimo comum ao `pg.Client` e ao PGlite. */
export type ExecutorSql = (sql: string) => Promise<unknown>;

/** Aplica o stub do Supabase e todas as migrations, cada uma em sua transação. */
export async function montarBanco(executar: ExecutorSql, migrations: Migration[] = lerMigrations()) {
  await executar(SUPABASE_STUB_SQL);
  for (const migration of migrations) {
    try {
      await executar(`begin;\n${migration.sql}\ncommit;`);
    } catch (err) {
      await executar("rollback;").catch(() => undefined);
      const motivo = err instanceof Error ? err.message : String(err);
      throw new Error(`Falha ao aplicar a migration ${migration.arquivo}: ${motivo}`);
    }
  }
}
