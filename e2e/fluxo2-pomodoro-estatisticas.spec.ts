import { test, expect, criarUsuarioViaApi, evidencia } from "./support/fixtures";
import { LoginPage } from "./pages/auth.page";
import { DisciplinasPage } from "./pages/disciplinas.page";
import { EstatisticasPage, TimerPage } from "./pages/timer.page";

/**
 * Fluxo 2 (RF003 + RF011 + RF004): autenticar → sessão Pomodoro de foco em uma
 * disciplina → sessão contabilizada nas estatísticas.
 * O relógio do navegador é controlado (page.clock) para não esperar 25 minutos reais.
 */
test.describe("Fluxo 2: Pomodoro registrado nas estatísticas", () => {
  test("caminho feliz: sessão de foco concluída aparece nas estatísticas", async ({ page, usuario }, testInfo) => {
    await criarUsuarioViaApi(usuario);
    const login = new LoginPage(page);
    const disciplinas = new DisciplinasPage(page);
    const timer = new TimerPage(page);
    const estatisticas = new EstatisticasPage(page);

    await test.step("1. Login com usuário criado via API (data seeding)", async () => {
      await login.abrir();
      await login.entrar(usuario.email, usuario.senha);
      await expect(page).toHaveURL(/\/timer/);
      await evidencia(page, testInfo, "fluxo2-01-login");
    });

    await test.step("2. Cadastrar a disciplina a ser estudada", async () => {
      await disciplinas.abrir();
      await disciplinas.cadastrar("Engenharia de Software");
      await expect(disciplinas.linha("Engenharia de Software")).toBeVisible();
    });

    await test.step("3. Iniciar sessão de foco de 25 minutos", async () => {
      await page.clock.install();
      await timer.abrir();
      await timer.selecionarDisciplina("Engenharia de Software");
      await expect(timer.relogio()).toHaveText("25:00");
      await timer.iniciar();
      await page.clock.runFor(5_000);
      await expect(timer.relogio()).toHaveText("24:55");
      await evidencia(page, testInfo, "fluxo2-02-timer-rodando");
    });

    await test.step("4. Concluir o ciclo e receber o aviso de término", async () => {
      const aviso = page.waitForEvent("dialog");
      // A sessão é gravada em segundo plano; navegar antes da resposta cancelaria o insert.
      const gravacao = page.waitForResponse(
        (r) => r.url().includes("/rest/v1/sessoes_estudo") && r.request().method() === "POST",
      );
      await page.clock.runFor(25 * 60 * 1000);
      const dialogo = await aviso;
      expect(dialogo.message()).toContain('Sessão de foco em "Engenharia de Software" finalizada!');
      await dialogo.accept();
      expect((await gravacao).ok()).toBe(true);
      await expect(timer.relogio()).toHaveText("00:00");
      await evidencia(page, testInfo, "fluxo2-03-timer-concluido");
    });

    await test.step("5. Ver as horas contabilizadas nas estatísticas", async () => {
      await estatisticas.abrir();
      await expect(estatisticas.horasDaSemana()).toContainText("0.4H");
      await expect(page.getByText("Engenharia de Software").first()).toBeVisible();
      await evidencia(page, testInfo, "fluxo2-04-estatisticas");
    });
  });

  test("alternativo: sessão interrompida e reiniciada não é contabilizada", async ({ page, usuario }) => {
    await criarUsuarioViaApi(usuario);
    const login = new LoginPage(page);
    const timer = new TimerPage(page);

    await login.abrir();
    await login.entrar(usuario.email, usuario.senha);
    await expect(page).toHaveURL(/\/timer/);

    await page.clock.install();
    await timer.abrir();
    await timer.iniciar();
    await page.clock.runFor(10 * 60 * 1000);
    await timer.pausar();
    await expect(timer.relogio()).toHaveText("15:00");
    await timer.reiniciar();
    await expect(timer.relogio()).toHaveText("25:00");

    await new EstatisticasPage(page).abrir();
    await expect(new EstatisticasPage(page).horasDaSemana()).toContainText("0.0H");
  });

  test("alternativo: credenciais inválidas bloqueiam o acesso", async ({ page, usuario }, testInfo) => {
    await criarUsuarioViaApi(usuario);
    const login = new LoginPage(page);

    await login.abrir();
    await login.entrar(usuario.email, "senha-errada");
    await expect(login.mensagemErro()).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await evidencia(page, testInfo, "fluxo2-05-login-invalido");

    // Rota protegida sem sessão redireciona para o login.
    await page.goto("/estatisticas");
    await expect(page).toHaveURL(/\/$/);
  });
});
