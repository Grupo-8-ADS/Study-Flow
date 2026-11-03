import type { Page } from "@playwright/test";

export class IntegracoesPage {
  constructor(private readonly page: Page) {}

  async abrir() {
    await this.page.goto("/integracoes");
  }

  async adicionarPalavra(palavra: string, ondeProcurar = "Assunto") {
    await this.page.getByLabel("Palavra-chave").fill(palavra);
    await this.page.getByLabel("Onde procurar").selectOption({ label: ondeProcurar });
    await this.page.getByRole("button", { name: "Adicionar palavra-chave" }).click();
  }

  palavrasCadastradas() {
    return this.page.getByRole("list", { name: "Palavras-chave cadastradas" });
  }

  statusGmail() {
    return this.page.getByTestId("status-gmail");
  }

  aviso() {
    // Dentro do <main>: fora dele fica o anunciador de rotas do Next (role="alert").
    const main = this.page.getByRole("main");
    return main.getByRole("alert").or(main.getByRole("status"));
  }
}
