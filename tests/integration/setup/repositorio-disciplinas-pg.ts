import type * as Real from "@/lib/repositorio-disciplinas";
import type { AcessoDisciplinas, RepositorioDisciplinas } from "@/lib/repositorio-disciplinas";
import { getTestPool } from "./db-helper";

/**
 * Adaptador de teste do repositório de disciplinas: o mesmo contrato da produção, mas direto no
 * Postgres de integração em vez de passar pelo PostgREST (que não roda nos testes).
 *
 * Fiel ao que o Supabase faz com o JWT do usuário: cada consulta roda como o papel
 * `authenticated`, com o `sub` nas claims, então o RLS das migrations decide o que é visível.
 * O papel do Supabase Auth fica com o token falso `teste:<uuid>`, aceito só se o usuário existir.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIXO = "teste:";

export const tokenDeTeste = (userId: string) => `${PREFIXO}${userId}`;

function pool() {
  const p = getTestPool();
  if (!p) throw new Error("DATABASE_URL não definido: banco de integração indisponível");
  return p;
}

async function comoUsuario(userId: string, sql: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  const conexao = await pool().connect();
  try {
    await conexao.query("begin");
    await conexao.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    await conexao.query("set local role authenticated");
    const { rows } = await conexao.query(sql, params);
    await conexao.query("commit");
    return rows;
  } catch (err) {
    await conexao.query("rollback");
    throw err;
  } finally {
    conexao.release();
  }
}

/** Colunas e regra de nome repetido vêm do módulo real, para o contrato ser um só. */
export function acessoPeloPostgres({ COLUNAS_DISCIPLINA: colunas, mesmoNome }: Pick<typeof Real, "COLUNAS_DISCIPLINA" | "mesmoNome">) {
  return async function acessoDoToken(token: string): Promise<AcessoDisciplinas | null> {
    const userId = token.startsWith(PREFIXO) ? token.slice(PREFIXO.length) : "";
    if (!UUID.test(userId)) return null;
    const { rowCount } = await pool().query("select 1 from auth.users where id = $1", [userId]);
    if (!rowCount) return null;

    // to_jsonb serializa datas e timestamps como o PostgREST (texto ISO), não como Date do pg.
    const disciplinas: RepositorioDisciplinas = {
      async listar() {
        const rows = await comoUsuario(
          userId,
          `select to_jsonb(d) as linha from (select ${colunas} from public.disciplinas where user_id = $1) d order by d.nome`,
          [userId],
        );
        return rows.map((r) => r.linha);
      },
      async existeComNome(nome) {
        const rows = await comoUsuario(userId, "select nome from public.disciplinas where user_id = $1", [userId]);
        return rows.some((r) => mesmoNome(r.nome as string, nome));
      },
      async criar(dados) {
        const rows = await comoUsuario(
          userId,
          `with nova as (
             insert into public.disciplinas (user_id, nome, professor, data_inicio, data_fim, anotacoes)
             values ($1, $2, $3, $4, $5, $6)
             returning ${colunas}
           )
           select to_jsonb(nova) as linha from nova`,
          [userId, dados.nome, dados.professor ?? null, dados.data_inicio ?? null, dados.data_fim ?? null, JSON.stringify(dados.anotacoes ?? {})],
        );
        return rows[0].linha;
      },
    };
    return { userId, disciplinas };
  };
}
