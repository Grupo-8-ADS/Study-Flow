import { test, expect, criarUsuarioViaApi, evidencia } from "./support/fixtures";
import { LoginPage } from "./pages/auth.page";
import { TimerPage } from "./pages/timer.page";

/**
 * Fluxo 4 (RF004 + RF010): concluir a primeira sessão de foco → o banco concede a conquista
 * "Foco inicial" → a notificação aparece no sino e pode ser marcada como lida.
 * O relógio do navegador é controlado (page.clock) para não esperar 25 minutos reais.
 */
test.describe("Fluxo 4: conquista desbloqueada vira notificação", () => {
  test.beforeEach(async ({ page, usuario }) => {
    await criarUsuarioViaApi(usuario);
    const login = new LoginPage(page);
    await login.abrir();
    await login.entrar(usuario.email, usuario.senha);
    await expect(page).toHaveURL(/\/timer/);
  });

  test("caminho feliz: primeira sessão concluída desbloqueia conquista no sino", async ({ page }, testInfo) => {
    const timer = new TimerPage(page);
    const sino = page.getByRole("button", { name: "Notificações" });
    const painel = page.getByRole("dialog", { name: "Notificações" });

    await test.step("1. Concluir a primeira sessão de foco", async () => {
      await page.clock.install();
      await timer.abrir();
      await timer.iniciar();
      const aviso = page.waitForEvent("dialog");
      const gravacao = page.waitForResponse(
        (r) => r.url().includes("/rest/v1/sessoes_estudo") && r.request().method() === "POST",
      );
      await page.clock.runFor(25 * 60 * 1000);
      await (await aviso).accept();
      expect((await gravacao).ok()).toBe(true);
    });

    await test.step("2. Ver a conquista no sino de notificações", async () => {
      await page.goto("/dashboard");
      await expect(page.getByTestId("notification-badge")).toBeVisible();
      await sino.click();
      await expect(painel).toContainText("Conquista desbloqueada: Foco inicial");
      await evidencia(page, testInfo, "fluxo4-01-notificacao");
    });

    await test.step("3. Marcar todas como lidas", async () => {
      await painel.getByRole("button", { name: "Marcar todas como lidas" }).click();
      await expect(page.getByTestId("notification-badge")).toHaveCount(0);
      await expect(painel.getByRole("button", { name: "Marcar como lida" })).toHaveCount(0);
      await evidencia(page, testInfo, "fluxo4-02-lidas");
    });

    await test.step("4. A conquista aparece em Recompensas", async () => {
      await page.goto("/rewards");
      await expect(page.getByText("Foco inicial").first()).toBeVisible();
    });
  });

  test("alternativo: sessão interrompida não gera conquista nem notificação", async ({ page }) => {
    const timer = new TimerPage(page);

    await page.clock.install();
    await timer.abrir();
    await timer.iniciar();
    await page.clock.runFor(10 * 60 * 1000);
    await timer.pausar();
    await timer.reiniciar();

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Notificações" }).click();
    const painel = page.getByRole("dialog", { name: "Notificações" });
    await expect(painel).toContainText("Nenhuma notificação por enquanto");
    await expect(page.getByTestId("notification-badge")).toHaveCount(0);
  });
});
