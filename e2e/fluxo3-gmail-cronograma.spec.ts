import { test, expect, criarUsuarioViaApi, evidencia } from "./support/fixtures";
import { LoginPage } from "./pages/auth.page";
import { IntegracoesPage } from "./pages/integracoes.page";

/**
 * Fluxo 3 (RF012): cadastrar palavras-chave → conectar o Gmail → sincronizar →
 * o e-mail da prova vira item no calendário.
 * O Google é substituído por um servidor falso (e2e/support/google-mock.mjs); o Supabase é o real.
 */

/** Mesma data do e-mail falso (AAAA-MM-DD), definida uma vez no playwright.config. */
const dataDaProvaISO = () => String(process.env.E2E_DATA_PROVA);

test.describe("Fluxo 3: e-mails do Gmail viram itens do cronograma", () => {
  test.beforeEach(async ({ page, usuario }) => {
    await criarUsuarioViaApi(usuario);
    const login = new LoginPage(page);
    await login.abrir();
    await login.entrar(usuario.email, usuario.senha);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("caminho feliz: prova encontrada no Gmail aparece no calendário", async ({ page }, testInfo) => {
    test.skip(
      !process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Precisa de SUPABASE_SERVICE_ROLE_KEY: as rotas do Gmail guardam o token com o service role.",
    );
    const integracoes = new IntegracoesPage(page);

    await test.step("1. Cadastrar a palavra-chave", async () => {
      await integracoes.abrir();
      await integracoes.adicionarPalavra("prova");
      await expect(integracoes.palavrasCadastradas()).toContainText("prova");
      await evidencia(page, testInfo, "fluxo3-01-palavra-chave");
    });

    await test.step("2. Conectar o Gmail (consentimento OAuth)", async () => {
      await page.getByRole("button", { name: "Conectar Gmail" }).click();
      await expect(page).toHaveURL(/\/integracoes\?gmail=conectado/);
      await expect(integracoes.statusGmail()).toContainText("Conectado como aluno.e2e@gmail.com");
      await evidencia(page, testInfo, "fluxo3-02-conectado");
    });

    await test.step("3. Sincronizar e criar o item", async () => {
      await page.getByRole("button", { name: "Sincronizar agora" }).click();
      await expect(integracoes.aviso()).toContainText("1 item adicionado ao cronograma");
      await expect(integracoes.statusGmail()).toContainText("Última sincronização");
      await evidencia(page, testInfo, "fluxo3-03-sincronizado");
    });

    await test.step("4. Ver a prova no dia certo do calendário", async () => {
      await page.goto(`/calendario?data=${dataDaProvaISO()}`);
      await expect(page.getByText(/Prova de Engenharia de Software/).first()).toBeVisible();
      await evidencia(page, testInfo, "fluxo3-04-calendario");
    });

    await test.step("5. Sincronizar de novo não duplica", async () => {
      await integracoes.abrir();
      await page.getByRole("button", { name: "Sincronizar agora" }).click();
      await expect(integracoes.aviso()).toContainText("Nenhum item novo");
    });
  });

  test("alternativo: palavra-chave repetida é recusada", async ({ page }, testInfo) => {
    const integracoes = new IntegracoesPage(page);
    await integracoes.abrir();

    await integracoes.adicionarPalavra("entrega");
    await expect(integracoes.palavrasCadastradas()).toContainText("entrega");
    await integracoes.adicionarPalavra("Entrega");

    await expect(integracoes.aviso()).toContainText('"Entrega" já está cadastrada para assunto.');
    await expect(integracoes.palavrasCadastradas().getByRole("listitem")).toHaveCount(1);
    await evidencia(page, testInfo, "fluxo3-05-palavra-repetida");
  });

  test("alternativo: sem Gmail conectado não há sincronização", async ({ page }, testInfo) => {
    const integracoes = new IntegracoesPage(page);
    await integracoes.abrir();

    await expect(integracoes.statusGmail()).toContainText("Não conectado");
    await expect(page.getByRole("button", { name: "Conectar Gmail" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Sincronizar agora" })).toHaveCount(0);
    await evidencia(page, testInfo, "fluxo3-06-desconectado");
  });
});
