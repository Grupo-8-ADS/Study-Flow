import { test, expect, criarUsuarioViaApi, evidencia } from "./support/fixtures";
import { CadastroPage, LoginPage } from "./pages/auth.page";
import { DisciplinasPage } from "./pages/disciplinas.page";
import { RotinaPage } from "./pages/rotina.page";

/**
 * Fluxo 1 (RF001 + RF005 + RF006 + RF008 + RF009): criar usuário → cadastrar
 * disciplinas → cadastrar rotina semanal → gerar cronograma automatizado →
 * confirmar e ver os blocos no calendário.
 */
test.describe("Fluxo 1: cronograma automatizado", () => {
  test("caminho feliz: do cadastro ao cronograma salvo no calendário", async ({ page, usuario }, testInfo) => {
    const cadastro = new CadastroPage(page);
    const disciplinas = new DisciplinasPage(page);
    const rotina = new RotinaPage(page);

    await test.step("1. Criar usuário pela tela de cadastro", async () => {
      await cadastro.abrir();
      await cadastro.preencher(usuario);
      await evidencia(page, testInfo, "fluxo1-01-cadastro");
      await cadastro.enviar();
      await expect(cadastro.mensagemSucesso()).toBeVisible();
      await expect(page).toHaveURL(/\/timer/);
    });

    await test.step("2. Cadastrar duas disciplinas", async () => {
      await disciplinas.abrir();
      await disciplinas.cadastrar("Banco de Dados");
      await expect(disciplinas.linha("Banco de Dados")).toBeVisible();
      await disciplinas.cadastrar("Redes de Computadores");
      await expect(disciplinas.linha("Redes de Computadores")).toBeVisible();
      await evidencia(page, testInfo, "fluxo1-02-disciplinas");
    });

    await test.step("3. Cadastrar a rotina semanal de estudos", async () => {
      await rotina.abrir();
      await rotina.adicionarHorario("Segunda-feira", "19:00", "21:00");
      await rotina.adicionarHorario("Quarta-feira", "19:00", "21:00");
      await expect(rotina.horario("Segunda-feira", "19:00", "21:00")).toBeVisible();
      await expect(rotina.horario("Quarta-feira", "19:00", "21:00")).toBeVisible();
      await evidencia(page, testInfo, "fluxo1-03-rotina");
    });

    await test.step("4. Gerar a prévia do cronograma (1 semana, blocos de 50 min)", async () => {
      await rotina.gerar(1, 50);
      await expect(page.getByRole("heading", { name: "Prévia do cronograma" })).toBeVisible();
      // 2 horários de 2h → 2 blocos de 50 min (+10 min de intervalo) por horário.
      await expect(rotina.linhasDaPrevia()).toHaveCount(4);
      await expect(rotina.previa()).toContainText("Banco de Dados");
      await expect(rotina.previa()).toContainText("Redes de Computadores");
      await evidencia(page, testInfo, "fluxo1-04-previa");
    });

    await test.step("5. Confirmar e salvar no cronograma", async () => {
      await rotina.confirmar();
      await expect(rotina.status()).toContainText("4 blocos de estudo adicionados");
      await evidencia(page, testInfo, "fluxo1-05-salvo");
      await page.getByRole("link", { name: "Ver no calendário" }).click();
      await expect(page).toHaveURL(/\/calendario/);
      // O primeiro bloco gerado cai no dia selecionado por padrão ou em um dia seguinte da semana.
      const primeiroBloco = page.getByText(/Estudo: (Banco de Dados|Redes de Computadores)/).first();
      await expect(primeiroBloco).toBeVisible();
      await evidencia(page, testInfo, "fluxo1-06-calendario");
    });
  });

  test("alternativo: gerar sem disciplinas orienta o usuário a cadastrá-las", async ({ page, usuario }, testInfo) => {
    await criarUsuarioViaApi(usuario);
    const login = new LoginPage(page);
    const rotina = new RotinaPage(page);

    await login.abrir();
    await login.entrar(usuario.email, usuario.senha);
    await expect(page).toHaveURL(/\/timer/);

    await rotina.abrir();
    await rotina.adicionarHorario("Terça-feira", "08:00", "10:00");
    await rotina.gerar();
    await expect(
      rotina.alerta("Cadastre ao menos uma disciplina antes de gerar o cronograma."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para Disciplinas" })).toHaveAttribute("href", /\/disciplinas/);
    await expect(rotina.previa()).toHaveCount(0);
    await evidencia(page, testInfo, "fluxo1-07-sem-disciplinas");
  });

  test("alternativo: horário de rotina inválido é rejeitado", async ({ page, usuario }, testInfo) => {
    await criarUsuarioViaApi(usuario);
    const login = new LoginPage(page);
    const rotina = new RotinaPage(page);

    await login.abrir();
    await login.entrar(usuario.email, usuario.senha);
    await expect(page).toHaveURL(/\/timer/);

    await rotina.abrir();
    await rotina.adicionarHorario("Sexta-feira", "21:00", "19:00");
    await expect(
      rotina.alerta("O horário de fim deve ser posterior ao horário de início."),
    ).toBeVisible();
    await expect(rotina.horario("Sexta-feira", "21:00", "19:00")).toHaveCount(0);
    await evidencia(page, testInfo, "fluxo1-08-rotina-invalida");
  });

  test("alternativo: senhas divergentes impedem o cadastro", async ({ page, usuario }) => {
    const cadastro = new CadastroPage(page);
    await cadastro.abrir();
    await cadastro.preencher(usuario, "outra-senha");
    await cadastro.enviar();
    await expect(page.getByText("As senhas não coincidem.")).toBeVisible();
    await expect(page).toHaveURL(/\/cadastro/);
  });
});
