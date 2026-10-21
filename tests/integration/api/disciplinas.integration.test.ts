import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { POST, GET } from "@/app/api/disciplinas/route";
import { createRouteServer } from "../setup/http-adapter";
import { DisciplinaBuilder, DisciplinaOutputSchema } from "@studyflow/shared";
import { getTestPool, cleanTables, seedProfile } from "../setup/db-helper";

describe("Testes de Integração de Rotas HTTP: /api/disciplinas", () => {
  const server = createRouteServer({ POST, GET });
  const testUserId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const validAuthHeader = `Bearer ${testUserId}`;

  beforeAll(async () => {
    // Se o banco estiver ativo (Testcontainers ou DATABASE_URL)
    const pool = getTestPool();
    if (pool) {
      await cleanTables(["disciplinas", "profiles"]);
      await seedProfile(testUserId, "Carlos Estudante", "carlos@unifei.edu.br");
    }
  });

  afterAll(async () => {
    const pool = getTestPool();
    if (pool) {
      await cleanTables(["disciplinas", "profiles"]);
    }
  });

  beforeEach(async () => {
    const pool = getTestPool();
    if (pool) {
      // Limpeza de disciplinas entre testes para isolamento de estado (Slide 11)
      await pool.query("DELETE FROM public.disciplinas WHERE user_id = $1;", [testUserId]);
    }
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
      const unrecognizedKeys = response.body.issues.map((i: any) => i.code);
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
      expect(response.body.user_id).toBe(testUserId);
      expect(response.body.id).toBeDefined();

      // Dimensão 4: Efeito Colateral Físico (A Essência da Integração - Slide 14)
      const pool = getTestPool();
      if (pool) {
        const dbResult = await pool.query(
          "SELECT * FROM public.disciplinas WHERE id = $1;",
          [response.body.id]
        );

        expect(dbResult.rows.length).toBe(1);
        const row = dbResult.rows[0];
        expect(row.nome).toBe("Arquitetura e Desenho de Software III");
        expect(row.professor).toBe("Prof. Dr. Wendell Diniz");
        expect(row.user_id).toBe(testUserId);
      }
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

      // Segunda inserção com o mesmo nome: 409 Conflict
      const secondResponse = await request(server)
        .post("/api/disciplinas")
        .set("Authorization", validAuthHeader)
        .send(payload);

      expect(secondResponse.status).toBe(409);
      expect(secondResponse.body.code).toBe("DUPLICATE_RESOURCE");
    });

    it("deve listar disciplinas persistidas com 200 OK via GET", async () => {
      const disciplina1 = DisciplinaBuilder.aDisciplina().withNome("Algoritmos").build();
      const disciplina2 = DisciplinaBuilder.aDisciplina().withNome("Banco de Dados").build();

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
    });
  });
});
