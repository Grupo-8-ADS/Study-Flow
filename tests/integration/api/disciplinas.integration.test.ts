import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { POST, GET } from "@/app/api/disciplinas/route";
import { createRouteServer } from "../setup/http-adapter";
import { DisciplinaOutputSchema } from "@studyflow/shared";
import { DisciplinaBuilder } from "@studyflow/shared/testing/disciplina.builder";
import { getTestPool, cleanTables, seedProfile, closeTestPool } from "../setup/db-helper";
import { tokenDeTeste } from "../setup/repositorio-disciplinas-pg";

// A rota real, com o banco real: só o acesso ao Supabase (Auth + PostgREST) é trocado pelo
// adaptador que fala direto com o Postgres de integração, rodando como o usuário (RLS ligado).
vi.mock("@/lib/repositorio-disciplinas", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/repositorio-disciplinas")>();
  const { acessoPeloPostgres } = await import("../setup/repositorio-disciplinas-pg");
  return { ...real, acessoDoToken: acessoPeloPostgres(real) };
});

function pool() {
  const p = getTestPool();
  if (!p) throw new Error("DATABASE_URL não definido: banco de integração indisponível");
  return p;
}

describe("Testes de Integração de Rotas HTTP: /api/disciplinas", () => {
  const server = createRouteServer({ POST, GET });
  const testUserId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const validAuthHeader = `Bearer ${tokenDeTeste(testUserId)}`;

  beforeAll(async () => {
    await cleanTables(["disciplinas", "profiles", "auth.users"]);
    await seedProfile(testUserId, "Carlos Estudante", "carlos@unifei.edu.br");
  });

  afterAll(async () => {
    await cleanTables(["disciplinas", "profiles", "auth.users"]);
    await closeTestPool();
  });

  beforeEach(async () => {
    // Limpeza de disciplinas entre testes para isolamento de estado (Slide 11)
    await pool().query("DELETE FROM public.disciplinas WHERE user_id = $1;", [testUserId]);
  });

  describe("Dimensão 1 & 2: Status Code Semântico e Cabeçalhos de Resposta", () => {
    it("deve retornar 401 Unauthorized quando o token de autorização estiver ausente", async () => {
      const payload = DisciplinaBuilder.aDisciplina().build();

      const response = await request(server)
        .post("/api/disciplinas")
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(response.body).toEqual({
        code: "AUTH_INVALID",
        message: expect.any(String),
      });
    });

    it("deve retornar 401 Unauthorized quando o token for inválido", async () => {
      const payload = DisciplinaBuilder.aDisciplina().build();

      const response = await request(server)
        .post("/api/disciplinas")
        .set("Authorization", "Bearer invalid")
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
    });

    it("deve retornar 422 Unprocessable Content ao violar schema estrito com campos desconhecidos (Mass Assignment)", async () => {
      // Padrão Test Data Builder com injeção proposital de campo estranho
      const payload = DisciplinaBuilder.aDisciplina().buildWithUnknownField({
        isAdmin: true,
        role: "superuser",
      });

      const response = await request(server)
        .post("/api/disciplinas")
        .set("Authorization", validAuthHeader)
        .send(payload);

      expect(response.status).toBe(422);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(response.body.issues).toBeInstanceOf(Array);
      // Confirma que o erro decorre de campos não reconhecidos pelo .strict()
      const unrecognizedKeys = response.body.issues.map((i: { code: string }) => i.code);
      expect(unrecognizedKeys).toContain("unrecognized_keys");
    });

    it("deve retornar 422 Unprocessable Content quando campos obrigatórios forem inválidos", async () => {
      const payload = DisciplinaBuilder.aDisciplina().withNome("A").build(); // Menos de 2 caracteres

      const response = await request(server)
        .post("/api/disciplinas")
        .set("Authorization", validAuthHeader)
        .send(payload);

      expect(response.status).toBe(422);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Dimensão 3 & 4: Serialização Zod e Efeito Colateral Físico na Base", () => {
    it("deve criar a disciplina com sucesso (201 Created), blindar a saída com Zod e persistir fisicamente no PostgreSQL", async () => {
      const builder = DisciplinaBuilder.aDisciplina()
        .withNome("Arquitetura e Desenho de Software III")
        .withProfessor("Prof. Dr. Wendell Diniz")
        .withDatas("10/02/2026", "15/07/2026")
        .withAnotacoes({ cargaHoraria: 64, sala: "Lab 2" });

      const payload = builder.build();

      const response = await request(server)
        .post("/api/disciplinas")
        .set("Authorization", validAuthHeader)
        .send(payload);

      // Dimensão 1: Status Code Semântico 201 Created
      expect(response.status).toBe(201);

      // Dimensão 2: Cabeçalho JSON estrito
      expect(response.headers["content-type"]).toMatch(/application\/json/);

      // Dimensão 3: Corpo validado contra o Zod Output Schema
      const validatedBody = DisciplinaOutputSchema.safeParse(response.body);
      expect(validatedBody.success).toBe(true);
      expect(response.body.nome).toBe("Arquitetura e Desenho de Software III");
      expect(response.body.professor).toBe("Prof. Dr. Wendell Diniz");
      expect(response.body.data_inicio).toBe("2026-02-10");
      expect(response.body.data_fim).toBe("2026-07-15");
      expect(response.body.anotacoes).toEqual({ cargaHoraria: 64, sala: "Lab 2" });
      expect(response.body.user_id).toBe(testUserId);
      expect(response.body.id).toBeDefined();

      // Dimensão 4: Efeito Colateral Físico (A Essência da Integração - Slide 14)
      const dbResult = await pool().query("SELECT * FROM public.disciplinas WHERE id = $1;", [response.body.id]);

      expect(dbResult.rows.length).toBe(1);
      const row = dbResult.rows[0];
      expect(row.nome).toBe("Arquitetura e Desenho de Software III");
      expect(row.professor).toBe("Prof. Dr. Wendell Diniz");
      expect(row.user_id).toBe(testUserId);
    });

    it("deve retornar 409 Conflict ao tentar cadastrar disciplina com o mesmo nome para o mesmo usuário", async () => {
      const payload = DisciplinaBuilder.aDisciplina()
        .withNome("Engenharia de Software")
        .build();

      // Primeira inserção: 201 Created
      const firstResponse = await request(server)
        .post("/api/disciplinas")
        .set("Authorization", validAuthHeader)
        .send(payload);

      expect(firstResponse.status).toBe(201);

      // Segunda inserção com o mesmo nome (em outra caixa): 409 Conflict
      const secondResponse = await request(server)
        .post("/api/disciplinas")
        .set("Authorization", validAuthHeader)
        .send({ ...payload, nome: "ENGENHARIA DE SOFTWARE" });

      expect(secondResponse.status).toBe(409);
      expect(secondResponse.body.code).toBe("DUPLICATE_RESOURCE");
    });

    it("não trata * ou % do nome como curinga ao checar duplicidade", async () => {
      await request(server).post("/api/disciplinas").set("Authorization", validAuthHeader).send(DisciplinaBuilder.aDisciplina().withNome("Cálculo I").build());

      for (const nome of ["C*", "C%"]) {
        const response = await request(server)
          .post("/api/disciplinas")
          .set("Authorization", validAuthHeader)
          .send(DisciplinaBuilder.aDisciplina().withNome(nome).build());
        expect(response.status).toBe(201);
      }
    });

    it("deve listar disciplinas persistidas com 200 OK via GET", async () => {
      const disciplina1 = DisciplinaBuilder.aDisciplina().withNome("Banco de Dados").build();
      const disciplina2 = DisciplinaBuilder.aDisciplina().withNome("Algoritmos").build();

      await request(server).post("/api/disciplinas").set("Authorization", validAuthHeader).send(disciplina1);
      await request(server).post("/api/disciplinas").set("Authorization", validAuthHeader).send(disciplina2);

      const response = await request(server)
        .get("/api/disciplinas")
        .set("Authorization", validAuthHeader);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0].nome).toBe("Algoritmos");
      expect(response.body[1].nome).toBe("Banco de Dados");
      expect(response.body.every((d: unknown) => DisciplinaOutputSchema.safeParse(d).success)).toBe(true);
    });
  });

  describe("Dimensão 5: Autenticação, isolamento entre usuários e JSON malformado", () => {
    it("deve retornar 401 no GET quando o token de autorização estiver ausente", async () => {
      const response = await request(server).get("/api/disciplinas");

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("AUTH_INVALID");
    });

    it("deve retornar 401 quando o token não pertencer a nenhum usuário", async () => {
      const response = await request(server)
        .get("/api/disciplinas")
        .set("Authorization", `Bearer ${tokenDeTeste("c3d4e5f6-a7b8-4901-8cde-f12345678902")}`);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("AUTH_INVALID");
    });

    it("deve retornar 400 Bad Request quando o corpo da requisição for um JSON malformado", async () => {
      const response = await request(server)
        .post("/api/disciplinas")
        .set("Authorization", validAuthHeader)
        .set("Content-Type", "application/json")
        .send("{ nome: 'quebrado'");

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("MALFORMED_JSON");
    });

    it("deve listar somente as disciplinas do usuário autenticado (isolamento entre usuários)", async () => {
      const outroUserId = "b2c3d4e5-f6a7-4890-8bcd-ef1234567891";
      const outroAuthHeader = `Bearer ${tokenDeTeste(outroUserId)}`;
      await seedProfile(outroUserId, "Outra Pessoa", "outra@unifei.edu.br");
      const minha = DisciplinaBuilder.aDisciplina().withNome("Minha Disciplina").build();
      const alheia = DisciplinaBuilder.aDisciplina().withNome("Disciplina Alheia").build();

      try {
        await request(server).post("/api/disciplinas").set("Authorization", validAuthHeader).send(minha);
        await request(server).post("/api/disciplinas").set("Authorization", outroAuthHeader).send(alheia);

        const responseMinha = await request(server).get("/api/disciplinas").set("Authorization", validAuthHeader);
        const responseOutro = await request(server).get("/api/disciplinas").set("Authorization", outroAuthHeader);

        expect(responseMinha.status).toBe(200);
        expect(responseMinha.body.map((d: { nome: string }) => d.nome)).toEqual(["Minha Disciplina"]);
        expect(responseOutro.body.map((d: { nome: string }) => d.nome)).toEqual(["Disciplina Alheia"]);
        expect(responseOutro.body[0].user_id).toBe(outroUserId);
      } finally {
        await pool().query("DELETE FROM auth.users WHERE id = $1;", [outroUserId]);
      }
    });

    it("o RLS barra um usuário de gravar disciplina em nome de outro, mesmo indo direto ao banco", async () => {
      const outroUserId = "d4e5f6a7-b8c9-4012-8def-123456789013";
      await seedProfile(outroUserId, "Terceira Pessoa", "terceira@unifei.edu.br");
      const conexao = await pool().connect();
      try {
        await conexao.query("begin");
        await conexao.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: testUserId, role: "authenticated" })]);
        await conexao.query("set local role authenticated");
        await expect(
          conexao.query("insert into public.disciplinas (user_id, nome) values ($1, 'Invasão')", [outroUserId]),
        ).rejects.toMatchObject({ code: "42501" });
      } finally {
        await conexao.query("rollback");
        conexao.release();
        await pool().query("DELETE FROM auth.users WHERE id = $1;", [outroUserId]);
      }
    });
  });
});
