import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getTestPool, cleanTables, closeTestPool } from "../setup/db-helper";

/**
 * Regras de negócio implementadas no banco (supabase/migrations/20261103_regras_negocio.sql):
 * RF003, RNF001, RF004, RF010 e RF012. As chamadas "como usuário" rodam com o papel
 * authenticated e o JWT simulado, exatamente como o PostgREST do Supabase faz.
 */
describe("Regras de negócio no banco (RPCs, triggers e RLS)", () => {
  const pool = () => {
    const p = getTestPool();
    if (!p) throw new Error("DATABASE_URL não definido: banco de integração indisponível");
    return p;
  };

  const tabelas = ["notificacoes", "user_conquistas", "sessoes_estudo", "itens_cronograma", "disciplinas", "sinc_gmail_tokens", "profiles", "auth.users"];

  async function criarUsuario(email: string, username = email.split("@")[0]): Promise<string> {
    const id = randomUUID();
    await pool().query(
      "INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3::jsonb)",
      [id, email, JSON.stringify({ nome: username, username })]
    );
    return id;
  }

  /** Executa `fn` como o usuário autenticado (papel authenticated + JWT), em transação desfeita no fim. */
  async function comoUsuario<T>(userId: string | null, fn: (c: PoolClient) => Promise<T>, commit = false): Promise<T> {
    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL ROLE ${userId ? "authenticated" : "anon"}`);
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(userId ? { sub: userId, role: "authenticated" } : { role: "anon" }),
      ]);
      const result = await fn(client);
      await client.query(commit ? "COMMIT" : "ROLLBACK");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async function concluirSessao(userId: string, minutos: number, exp: number, disciplinaId: string | null = null) {
    await pool().query(
      `INSERT INTO public.sessoes_estudo (user_id, disciplina_id, duracao_efetiva_min, status, exp)
       VALUES ($1, $2, $3, 'concluida', $4)`,
      [userId, disciplinaId, minutos, exp]
    );
  }

  async function perfil(userId: string) {
    const { rows } = await pool().query("SELECT xp, nivel_atual, last_achievement FROM public.profiles WHERE id = $1", [userId]);
    return rows[0];
  }

  async function conquistasDe(userId: string): Promise<string[]> {
    const { rows } = await pool().query(
      `SELECT c.nome FROM public.user_conquistas uc JOIN public.conquistas c ON c.id = uc.conquista_id
       WHERE uc.user_id = $1 ORDER BY c.nome`,
      [userId]
    );
    return rows.map((r) => r.nome);
  }

  beforeAll(async () => {
    // Espelha os privilégios padrão do Supabase (o RLS é quem isola os dados).
    await pool().query(`
      GRANT USAGE ON SCHEMA public TO anon, authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
      REVOKE ALL ON public.sinc_gmail_tokens FROM anon, authenticated;
    `);
    await cleanTables(tabelas);
  });

  beforeEach(async () => {
    await cleanTables(tabelas);
  });

  afterAll(async () => {
    await cleanTables(tabelas);
    await closeTestPool();
  });

  describe("RF003 - get_email_by_username", () => {
    it("deve devolver o e-mail ignorando maiúsculas e espaços, mesmo para o papel anon", async () => {
      await criarUsuario("ana@unifei.edu.br", "Ana_Souza");

      const email = await comoUsuario(null, async (c) => {
        const { rows } = await c.query("SELECT public.get_email_by_username($1) AS email", ["  ana_souza "]);
        return rows[0].email;
      });

      expect(email).toBe("ana@unifei.edu.br");
    });

    it("deve devolver null para username inexistente ou perfil marcado como excluído", async () => {
      const id = await criarUsuario("bia@unifei.edu.br", "bia");
      await pool().query("UPDATE public.profiles SET deleted = true WHERE id = $1", [id]);

      const { rows } = await pool().query(
        "SELECT public.get_email_by_username('bia') AS excluido, public.get_email_by_username('ninguem') AS inexistente"
      );

      expect(rows[0]).toEqual({ excluido: null, inexistente: null });
    });

    it("não deve permitir que o anon leia a tabela profiles diretamente (RLS)", async () => {
      await criarUsuario("cris@unifei.edu.br", "cris");
      await pool().query("GRANT SELECT ON public.profiles TO anon");

      const total = await comoUsuario(null, async (c) => {
        const { rows } = await c.query("SELECT count(*)::int AS total FROM public.profiles");
        return rows[0].total;
      });

      expect(total).toBe(0);
    });
  });

  describe("RNF001 - delete_own_account", () => {
    it("deve apagar o usuário e todos os dados dele em cascata, sem afetar outros usuários", async () => {
      const alvo = await criarUsuario("alvo@unifei.edu.br");
      const outro = await criarUsuario("outro@unifei.edu.br");
      await pool().query("INSERT INTO public.disciplinas (user_id, nome) VALUES ($1, 'Cálculo'), ($2, 'Física')", [alvo, outro]);
      await concluirSessao(alvo, 25, 25);

      await comoUsuario(alvo, (c) => c.query("SELECT public.delete_own_account()"), true);

      const { rows } = await pool().query(
        `SELECT
           (SELECT count(*)::int FROM auth.users WHERE id = $1) AS auth,
           (SELECT count(*)::int FROM public.profiles WHERE id = $1) AS perfil,
           (SELECT count(*)::int FROM public.disciplinas WHERE user_id = $1) AS disciplinas,
           (SELECT count(*)::int FROM public.sessoes_estudo WHERE user_id = $1) AS sessoes,
           (SELECT count(*)::int FROM public.disciplinas WHERE user_id = $2) AS disciplinas_outro`,
        [alvo, outro]
      );
      expect(rows[0]).toEqual({ auth: 0, perfil: 0, disciplinas: 0, sessoes: 0, disciplinas_outro: 1 });
    });

    it("deve recusar a chamada sem usuário autenticado (42501)", async () => {
      await expect(pool().query("SELECT public.delete_own_account()")).rejects.toMatchObject({ code: "42501" });
    });
  });

  describe("RF004 - XP, nível e conquistas (trigger on_sessao_concluida)", () => {
    it("deve somar o XP da sessão e o bônus da primeira conquista, recalculando o nível", async () => {
      const id = await criarUsuario("xp@unifei.edu.br");

      await concluirSessao(id, 25, 25);

      // 25 da sessão + 50 de "Foco inicial"
      expect(await perfil(id)).toEqual({ xp: 75, nivel_atual: 1, last_achievement: "Foco inicial" });
      expect(await conquistasDe(id)).toEqual(["Foco inicial"]);
    });

    it("deve conceder 'Estudante dedicado' na quinta sessão concluída, uma única vez", async () => {
      const id = await criarUsuario("dedicado@unifei.edu.br");

      for (let i = 0; i < 6; i++) await concluirSessao(id, 25, 25);

      expect(await conquistasDe(id)).toEqual(["Estudante dedicado", "Foco inicial"]);
      // 6*25 + 50 + 120 = 320 XP -> nível 4
      expect(await perfil(id)).toMatchObject({ xp: 320, nivel_atual: 4 });
    });

    it("deve conceder 'Mestre do Tempo' ao acumular 600 minutos", async () => {
      const id = await criarUsuario("tempo@unifei.edu.br");

      await concluirSessao(id, 300, 0);
      expect(await conquistasDe(id)).not.toContain("Mestre do Tempo");
      await concluirSessao(id, 300, 0);

      expect(await conquistasDe(id)).toContain("Mestre do Tempo");
    });

    it("deve conceder a conquista de disciplina só com sessão na disciplina do critério", async () => {
      const id = await criarUsuario("historia@unifei.edu.br");
      const { rows } = await pool().query(
        "INSERT INTO public.disciplinas (user_id, nome) VALUES ($1, 'Geografia'), ($1, 'história') RETURNING id, nome",
        [id]
      );
      const geografia = rows.find((r) => r.nome === "Geografia").id;
      const historia = rows.find((r) => r.nome === "história").id;

      await concluirSessao(id, 25, 0, geografia);
      expect(await conquistasDe(id)).not.toContain("Especialista em História I");
      await concluirSessao(id, 25, 0, historia);

      expect(await conquistasDe(id)).toContain("Especialista em História I");
    });

    it("não deve dar XP para sessão cancelada, e deve dar ao mudar o status para concluída", async () => {
      const id = await criarUsuario("status@unifei.edu.br");
      const { rows } = await pool().query(
        "INSERT INTO public.sessoes_estudo (user_id, duracao_efetiva_min, status, exp) VALUES ($1, 25, 'ativa', 25) RETURNING id",
        [id]
      );
      expect((await perfil(id)).xp).toBe(0);

      await pool().query("UPDATE public.sessoes_estudo SET status = 'concluida' WHERE id = $1", [rows[0].id]);
      await pool().query("UPDATE public.sessoes_estudo SET notas = 'revisão' WHERE id = $1", [rows[0].id]);

      expect((await perfil(id)).xp).toBe(75);
    });

    it("deve notificar a conquista apenas quando o usuário aceita notificações", async () => {
      const comAviso = await criarUsuario("aviso@unifei.edu.br");
      const semAviso = await criarUsuario("silencio@unifei.edu.br");
      await pool().query("UPDATE public.profiles SET recebe_notificacao_pref = false WHERE id = $1", [semAviso]);

      await concluirSessao(comAviso, 25, 25);
      await concluirSessao(semAviso, 25, 25);

      const { rows } = await pool().query(
        "SELECT user_id, mensagem, tipo_evento FROM public.notificacoes WHERE user_id = ANY($1)",
        [[comAviso, semAviso]]
      );
      expect(rows).toEqual([{ user_id: comAviso, mensagem: "Conquista desbloqueada: Foco inicial", tipo_evento: "conquista" }]);
      expect(await conquistasDe(semAviso)).toEqual(["Foco inicial"]);
    });
  });

  describe("RF010 - gerar_notificacoes_prazos", () => {
    async function criarItem(userId: string, nome: string, tipo: string, emHoras: number, completed = false) {
      await pool().query(
        `INSERT INTO public.itens_cronograma (user_id, nome, tipo, data_fim, completed)
         VALUES ($1, $2, $3, now() + make_interval(hours => $4), $5)`,
        [userId, nome, tipo, emHoras, completed]
      );
    }

    it("deve avisar só prazos pendentes nos próximos 3 dias, sem duplicar em chamadas repetidas", async () => {
      const id = await criarUsuario("prazo@unifei.edu.br");
      await criarItem(id, "P1 de Cálculo", "Prova", 30);
      await criarItem(id, "Relatório", "trabalho", 60);
      await criarItem(id, "Projeto final", "entrega", 24 * 10); // longe demais
      await criarItem(id, "Lista feita", "atividade", 5, true); // já concluída
      await criarItem(id, "Revisão", "estudo", 5); // estudo não é prazo
      await criarItem(id, "Prova passada", "prova", -5); // já venceu

      const primeira = await comoUsuario(id, async (c) => (await c.query("SELECT public.gerar_notificacoes_prazos() AS n")).rows[0].n, true);
      const segunda = await comoUsuario(id, async (c) => (await c.query("SELECT public.gerar_notificacoes_prazos() AS n")).rows[0].n, true);

      expect([primeira, segunda]).toEqual([2, 0]);
      const { rows } = await pool().query(
        "SELECT mensagem FROM public.notificacoes WHERE user_id = $1 AND tipo_evento = 'prazo' ORDER BY mensagem",
        [id]
      );
      expect(rows.map((r) => r.mensagem)).toEqual([
        expect.stringMatching(/^Prova "P1 de Cálculo" (é hoje|vence em \d{2}\/\d{2})$/),
        expect.stringMatching(/^Trabalho "Relatório" (é hoje|vence em \d{2}\/\d{2})$/),
      ]);
    });

    it("chamada pelo usuário deve gerar apenas os avisos dele; a do agendamento gera para todos", async () => {
      const ana = await criarUsuario("ana.prazo@unifei.edu.br");
      const beto = await criarUsuario("beto.prazo@unifei.edu.br");
      await criarItem(ana, "Prova da Ana", "prova", 10);
      await criarItem(beto, "Prova do Beto", "prova", 10);

      await comoUsuario(ana, (c) => c.query("SELECT public.gerar_notificacoes_prazos()"), true);
      const soAna = await pool().query("SELECT user_id FROM public.notificacoes WHERE tipo_evento = 'prazo'");
      expect(soAna.rows).toEqual([{ user_id: ana }]);

      await pool().query("SELECT public.gerar_notificacoes_prazos()"); // contexto do pg_cron (sem JWT)
      const todos = await pool().query("SELECT count(*)::int AS total FROM public.notificacoes WHERE tipo_evento = 'prazo'");
      expect(todos.rows[0].total).toBe(2);
    });

    it("não deve avisar quem desligou as notificações", async () => {
      const id = await criarUsuario("mudo@unifei.edu.br");
      await pool().query("UPDATE public.profiles SET recebe_notificacao_pref = false WHERE id = $1", [id]);
      await criarItem(id, "Prova", "prova", 10);

      const { rows } = await pool().query("SELECT public.gerar_notificacoes_prazos() AS n");

      expect(rows[0].n).toBe(0);
    });
  });

  describe("Isolamento por RLS", () => {
    it("um usuário não deve ver nem marcar como lidas as notificações de outro", async () => {
      const dono = await criarUsuario("dono@unifei.edu.br");
      const intruso = await criarUsuario("intruso@unifei.edu.br");
      await pool().query("INSERT INTO public.notificacoes (user_id, mensagem, tipo_evento) VALUES ($1, 'aviso', 'teste')", [dono]);

      const { visiveis, alteradas } = await comoUsuario(intruso, async (c) => ({
        visiveis: (await c.query("SELECT count(*)::int AS n FROM public.notificacoes")).rows[0].n,
        alteradas: (await c.query("UPDATE public.notificacoes SET read_at = now()")).rowCount,
      }));

      expect({ visiveis, alteradas }).toEqual({ visiveis: 0, alteradas: 0 });
    });

    it("o dono deve conseguir marcar a própria notificação como lida", async () => {
      const dono = await criarUsuario("leitor@unifei.edu.br");
      await pool().query("INSERT INTO public.notificacoes (user_id, mensagem) VALUES ($1, 'aviso')", [dono]);

      await comoUsuario(dono, (c) => c.query("UPDATE public.notificacoes SET read_at = now()"), true);

      const { rows } = await pool().query("SELECT read_at FROM public.notificacoes WHERE user_id = $1", [dono]);
      expect(rows[0].read_at).not.toBeNull();
    });
  });

  describe("RF012 - armazenamento do token do Gmail", () => {
    it("o próprio usuário não deve conseguir ler o refresh token (somente o servidor)", async () => {
      const id = await criarUsuario("gmail@unifei.edu.br");
      await pool().query("INSERT INTO public.sinc_gmail_tokens (user_id, refresh_token) VALUES ($1, 'segredo')", [id]);

      await expect(
        comoUsuario(id, (c) => c.query("SELECT refresh_token FROM public.sinc_gmail_tokens"))
      ).rejects.toMatchObject({ code: "42501" });
    });

    it("deve impedir itens duplicados vindos do mesmo e-mail (origem_externa_id)", async () => {
      const id = await criarUsuario("dup@unifei.edu.br");
      const sql = "INSERT INTO public.itens_cronograma (user_id, nome, tipo, origem_externa_id) VALUES ($1, 'Prova', 'prova', 'gmail:abc')";
      await pool().query(sql, [id]);

      await expect(pool().query(sql, [id])).rejects.toMatchObject({ code: "23505" });
    });
  });
});
