import { NextResponse } from "next/server";
import {
  CreateDisciplinaInputSchema,
  DisciplinaOutputSchema,
} from "@studyflow/shared";
import { getDatabasePool } from "@/lib/db";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabase, SUPABASE_FALLBACK_URL, SUPABASE_FALLBACK_KEY } from "@/lib/supabase";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AuthContext {
  userId: string;
  /** Cliente Supabase com o JWT do usuario (RLS aplicada). Nulo em modo pool/teste. */
  client: SupabaseClient | null;
}

function createUserClient(authHeader: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_FALLBACK_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    SUPABASE_FALLBACK_KEY;
  return createClient(url, key, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authenticate(authHeader: string | null): Promise<AuthContext | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  // Modo pool (DATABASE_URL, apenas testes de integracao): token e o proprio UUID do usuario.
  if (getDatabasePool()) {
    return UUID_REGEX.test(token) ? { userId: token, client: null } : null;
  }

  // Modo Supabase: valida o token no servidor de autenticacao.
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }
    return { userId: data.user.id, client: createUserClient(`Bearer ${token}`) };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const auth = await authenticate(authHeader);

  // 1. Dimensão: Autenticação na Fronteira (401)
  if (!auth) {
    return NextResponse.json(
      { code: "AUTH_INVALID", message: "Token de autenticação ausente ou inválido" },
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  const { userId, client } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "MALFORMED_JSON", message: "O corpo da requisição deve ser um JSON válido" },
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. Dimensão: Validação Estrita de Fronteira com Zod (422)
  const validationResult = CreateDisciplinaInputSchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        code: "VALIDATION_ERROR",
        message: "Dados fornecidos não atendem ao esquema estrito",
        issues: validationResult.error.issues,
      },
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  const input = validationResult.data;
  const pool = getDatabasePool();

  if (pool) {
    // Modo Integração / Testcontainers com PostgreSQL físico
    try {
      // Garantir existência do usuário (stub auth.users) e do perfil para a chave estrangeira.
      // O trigger handle_new_user cria o perfil; o INSERT abaixo é apenas defensivo.
      await pool.query(
        `INSERT INTO auth.users (id, email)
         VALUES ($1, $2)
         ON CONFLICT (id) DO NOTHING`,
        [userId, `user_${userId.slice(0, 8)}@unifei.edu.br`]
      );
      await pool.query(
        `INSERT INTO public.profiles (id, nome, username, email)
         VALUES ($1, 'Usuário Teste', $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [userId, `user_${userId.slice(0, 8)}`, `user_${userId.slice(0, 8)}@unifei.edu.br`]
      );

      // Verificação de conflito/duplicidade para o usuário (409 Conflict)
      const existing = await pool.query(
        `SELECT id FROM public.disciplinas WHERE user_id = $1 AND LOWER(nome) = LOWER($2)`,
        [userId, input.nome]
      );

      if (existing.rows.length > 0) {
        return NextResponse.json(
          {
            code: "DUPLICATE_RESOURCE",
            message: `A disciplina '${input.nome}' já existe para este usuário`,
          },
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }

      // Efeito colateral físico no PostgreSQL
      const result = await pool.query(
        `INSERT INTO public.disciplinas (user_id, nome, professor, data_inicio, data_fim, anotacoes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id, nome, professor, data_inicio, data_fim, anotacoes, created_at, updated_at`,
        [
          userId,
          input.nome,
          input.professor || null,
          input.data_inicio || null,
          input.data_fim || null,
          JSON.stringify(input.anotacoes || {}),
        ]
      );

      const created = result.rows[0];

      // 3. Dimensão: Blindagem e Serialização de Saída via Zod
      const output = DisciplinaOutputSchema.parse({
        id: created.id,
        user_id: created.user_id,
        nome: created.nome,
        professor: created.professor,
        data_inicio: created.data_inicio ? new Date(created.data_inicio).toISOString().slice(0, 10) : null,
        data_fim: created.data_fim ? new Date(created.data_fim).toISOString().slice(0, 10) : null,
        anotacoes: typeof created.anotacoes === "string" ? JSON.parse(created.anotacoes) : created.anotacoes,
        created_at: new Date(created.created_at).toISOString(),
        updated_at: new Date(created.updated_at).toISOString(),
      });

      return NextResponse.json(output, {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      if (err.code === "23505") {
        return NextResponse.json(
          { code: "DUPLICATE_RESOURCE", message: "Restrição de unicidade violada no banco" },
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }
      return NextResponse.json(
        { code: "INTERNAL_ERROR", message: err.message },
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Modo Produção / Supabase client (com JWT do usuário, RLS aplicada)
  const db = client as SupabaseClient;
  try {
    const { data: existing } = await db
      .from("disciplinas")
      .select("id")
      .eq("user_id", userId)
      .ilike("nome", input.nome);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { code: "DUPLICATE_RESOURCE", message: `A disciplina '${input.nome}' já existe` },
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await db
      .from("disciplinas")
      .insert({
        user_id: userId,
        nome: input.nome,
        professor: input.professor,
        data_inicio: input.data_inicio,
        data_fim: input.data_fim,
        anotacoes: input.anotacoes,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ code: "DB_ERROR", message: error.message }, { status: 500 });
    }

    const output = DisciplinaOutputSchema.parse(data);
    return NextResponse.json(output, {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return NextResponse.json({ code: "INTERNAL_ERROR", message: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const auth = await authenticate(authHeader);

  if (!auth) {
    return NextResponse.json(
      { code: "AUTH_INVALID", message: "Token de autenticação ausente ou inválido" },
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  const { userId, client } = auth;

  const pool = getDatabasePool();
  if (pool) {
    const result = await pool.query(
      `SELECT id, user_id, nome, professor, data_inicio, data_fim, anotacoes, created_at, updated_at
       FROM public.disciplinas
       WHERE user_id = $1
       ORDER BY nome ASC`,
      [userId]
    );

    const formattedList = result.rows.map((row) =>
      DisciplinaOutputSchema.parse({
        id: row.id,
        user_id: row.user_id,
        nome: row.nome,
        professor: row.professor,
        data_inicio: row.data_inicio ? new Date(row.data_inicio).toISOString().slice(0, 10) : null,
        data_fim: row.data_fim ? new Date(row.data_fim).toISOString().slice(0, 10) : null,
        anotacoes: typeof row.anotacoes === "string" ? JSON.parse(row.anotacoes) : row.anotacoes,
        created_at: new Date(row.created_at).toISOString(),
        updated_at: new Date(row.updated_at).toISOString(),
      })
    );

    return NextResponse.json(formattedList, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = client as SupabaseClient;
  const { data, error } = await db
    .from("disciplinas")
    .select("*")
    .eq("user_id", userId)
    .order("nome", { ascending: true });

  if (error) {
    return NextResponse.json({ code: "DB_ERROR", message: error.message }, { status: 500 });
  }

  return NextResponse.json(data, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
