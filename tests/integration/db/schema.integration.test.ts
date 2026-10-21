import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { DisciplinaBuilder } from "@studyflow/shared";
import { getTestPool, cleanTables, closeTestPool } from "../setup/db-helper";

describe("Testes de Integração do Schema PostgreSQL (triggers, constraints e cascade)", () => {
  const pool = () => {
    const p = getTestPool();
    if (!p) throw new Error("DATABASE_URL não definido: banco de integração indisponível");
    return p;
  };

  async function criarUsuario(email: string, meta: Record<string, string> = {}): Promise<string> {
    const id = randomUUID();
    await pool().query(
      "INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3::jsonb)",
      [id, email, JSON.stringify(meta)]
    );
    return id;
  }

  async function criarDisciplina(userId: string, nome: string): Promise<string> {
    const input = DisciplinaBuilder.aDisciplina().withNome(nome).build();
    const result = await pool().query(
      "INSERT INTO public.disciplinas (user_id, nome, professor) VALUES ($1, $2, $3) RETURNING id",
      [userId, input.nome, input.professor]
    );
    return result.rows[0].id;
  }

  const tabelas = ["palavras_chave", "disciplinas", "profiles", "auth.users"];

  beforeAll(async () => {
    await cleanTables(tabelas);
  });

  beforeEach(async () => {
    await cleanTables(tabelas);
  });

  afterAll(async () => {
    await cleanTables(tabelas);
    await closeTestPool();
  });

  describe("Trigger handle_new_user", () => {
    it("deve criar automaticamente o perfil com nome e username vindos de raw_user_meta_data", async () => {
      // Arrange & Act
      const userId = await criarUsuario("ana@unifei.edu.br", { nome: "Ana Souza", username: "ana_souza" });

      // Assert
      const result = await pool().query("SELECT nome, username, email FROM public.profiles WHERE id = $1", [userId]);
      expect(result.rows).toEqual([{ nome: "Ana Souza", username: "ana_souza", email: "ana@unifei.edu.br" }]);
    });

    it("deve usar a parte local do e-mail como nome/username quando não houver metadados", async () => {
      const userId = await criarUsuario("joao.silva@unifei.edu.br");

      const result = await pool().query("SELECT nome, username FROM public.profiles WHERE id = $1", [userId]);

      expect(result.rows).toEqual([{ nome: "joao.silva", username: "joao.silva" }]);
    });
  });

  describe("Trigger set_updated_at", () => {
    it("deve atualizar updated_at (e preservar created_at) ao atualizar uma disciplina", async () => {
      const userId = await criarUsuario("upd@unifei.edu.br");
      const disciplinaId = await criarDisciplina(userId, "Cálculo I");
      const antes = await pool().query("SELECT created_at, updated_at FROM public.disciplinas WHERE id = $1", [disciplinaId]);
      await new Promise((resolve) => setTimeout(resolve, 20));

      await pool().query("UPDATE public.disciplinas SET nome = 'Cálculo II' WHERE id = $1", [disciplinaId]);

      const depois = await pool().query("SELECT nome, created_at, updated_at FROM public.disciplinas WHERE id = $1", [disciplinaId]);
      expect(depois.rows[0].nome).toBe("Cálculo II");
      expect(new Date(depois.rows[0].updated_at).getTime()).toBeGreaterThan(new Date(antes.rows[0].updated_at).getTime());
      expect(new Date(depois.rows[0].created_at).getTime()).toBe(new Date(antes.rows[0].created_at).getTime());
    });
  });

  describe("Integridade referencial", () => {
    it("deve remover em cascata as disciplinas ao excluir o perfil", async () => {
      const userId = await criarUsuario("cascata@unifei.edu.br");
      await criarDisciplina(userId, "Física I");
      await criarDisciplina(userId, "Química");

      await pool().query("DELETE FROM public.profiles WHERE id = $1", [userId]);

      const result = await pool().query("SELECT count(*)::int AS total FROM public.disciplinas WHERE user_id = $1", [userId]);
      expect(result.rows[0].total).toBe(0);
    });

    it("deve rejeitar disciplina cujo user_id não possui perfil (violação de FK 23503)", async () => {
      await expect(criarDisciplina(randomUUID(), "Órfã")).rejects.toMatchObject({ code: "23503" });
    });
  });

  describe("Constraints e tipos enumerados", () => {
    it("deve rejeitar palavra-chave duplicada para (user_id, palavra, localizacao) com erro 23505", async () => {
      const userId = await criarUsuario("kw@unifei.edu.br");
      const sql = "INSERT INTO public.palavras_chave (user_id, palavra, localizacao) VALUES ($1, $2, $3)";
      await pool().query(sql, [userId, "prova", "assunto"]);

      await expect(pool().query(sql, [userId, "prova", "assunto"])).rejects.toMatchObject({ code: "23505" });
      // mesma palavra em outra localização continua permitida
      await expect(pool().query(sql, [userId, "prova", "corpo"])).resolves.toBeDefined();
    });

    it("deve rejeitar valor inválido para o enum email_localizacao com erro 22P02", async () => {
      const userId = await criarUsuario("enum@unifei.edu.br");

      await expect(
        pool().query(
          "INSERT INTO public.palavras_chave (user_id, palavra, localizacao) VALUES ($1, $2, $3)",
          [userId, "trabalho", "cabecalho_inexistente"]
        )
      ).rejects.toMatchObject({ code: "22P02" });
    });
  });
});
