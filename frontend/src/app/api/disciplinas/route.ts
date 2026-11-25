import { NextResponse } from "next/server";
import { CreateDisciplinaInputSchema, DisciplinaOutputSchema } from "@studyflow/shared";
import { acessoDoToken } from "@/lib/repositorio-disciplinas";

/**
 * API REST de disciplinas. Autenticação: `Authorization: Bearer <access token do Supabase>`.
 * Validação estrita na entrada (Zod, 422) e na saída (só os campos do contrato).
 */

const erro = (status: number, code: string, message: string, extra?: Record<string, unknown>) =>
  NextResponse.json({ code, message, ...extra }, { status });

const naoAutenticado = () => erro(401, "AUTH_INVALID", "Token de autenticação ausente ou inválido");
/** Detalhes de falhas internas ficam no servidor: o cliente recebe só o código. */
const falhaInterna = () => erro(500, "INTERNAL_ERROR", "Não foi possível concluir a operação. Tente novamente.");

function autenticar(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  return token ? acessoDoToken(token) : Promise.resolve(null);
}

export async function POST(request: Request) {
  const acesso = await autenticar(request);
  if (!acesso) return naoAutenticado();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return erro(400, "MALFORMED_JSON", "O corpo da requisição deve ser um JSON válido");
  }

  const validacao = CreateDisciplinaInputSchema.safeParse(body);
  if (!validacao.success) {
    return erro(422, "VALIDATION_ERROR", "Dados fornecidos não atendem ao esquema estrito", {
      issues: validacao.error.issues,
    });
  }
  const input = validacao.data;

  try {
    if (await acesso.disciplinas.existeComNome(input.nome)) {
      return erro(409, "DUPLICATE_RESOURCE", `A disciplina '${input.nome}' já existe`);
    }
    const criada = await acesso.disciplinas.criar(input);
    return NextResponse.json(DisciplinaOutputSchema.parse(criada), { status: 201 });
  } catch (err) {
    console.error("[api/disciplinas] POST", err);
    return falhaInterna();
  }
}

export async function GET(request: Request) {
  const acesso = await autenticar(request);
  if (!acesso) return naoAutenticado();

  try {
    const lista = await acesso.disciplinas.listar();
    return NextResponse.json(lista.map((linha) => DisciplinaOutputSchema.parse(linha)));
  } catch (err) {
    console.error("[api/disciplinas] GET", err);
    return falhaInterna();
  }
}
