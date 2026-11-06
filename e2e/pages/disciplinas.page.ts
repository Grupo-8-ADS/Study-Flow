import type { Page } from "@playwright/test";

export class DisciplinasPage {
  constructor(private readonly page: Page) {}

  async abrir() {
    await this.page.goto("/disciplinas");
  }

  /** Cadastra uma disciplina; `dataProva` (AAAA-MM-DD) opcional marca uma prova dela na agenda. */
  async cadastrar(nome: string, dataProva?: string) {
    await this.page.getByRole("button", { name: "Adicionar disciplina" }).click();
    await this.page.getByLabel("Nome", { exact: true }).fill(nome);
    await this.page.getByRole("button", { name: "Salvar" }).click();
    await this.linha(nome).waitFor();

    if (dataProva) {
      await this.linha(nome).getByRole("button", { name: nome }).click();
      await this.page.getByRole("button", { name: "Prova", exact: true }).click();
      await this.page.getByLabel("Nome", { exact: true }).fill(`Prova de ${nome}`);
      await this.page.getByLabel("Data", { exact: true }).fill(dataProva);
      await this.page.getByRole("button", { name: "Salvar" }).click();
      await this.page.getByRole("button", { name: "Fechar", exact: true }).first().click();
    }
  }

  linha(nome: string) {
    return this.page.getByRole("article").filter({ hasText: nome });
  }
}
