import type { Page } from "@playwright/test";

export class DisciplinasPage {
  constructor(private readonly page: Page) {}

  async abrir() {
    await this.page.goto("/disciplinas");
  }

  /** Cadastra uma disciplina; `dataProva` (AAAA-MM-DD) opcional adiciona uma prova. */
  async cadastrar(nome: string, dataProva?: string) {
    await this.page.getByRole("button", { name: "Adicionar disciplina" }).click();
    await this.page.getByLabel("Nome da disciplina").fill(nome);
    if (dataProva) {
      await this.page.getByRole("button", { name: "Adicionar Prova" }).click();
      await this.page.getByPlaceholder("Título da prova").fill(`Prova de ${nome}`);
      await this.page.locator('input[type="date"]').last().fill(dataProva);
    }
    await this.page.getByRole("button", { name: "Salvar" }).click();
  }

  linha(nome: string) {
    return this.page.getByRole("row").filter({ hasText: nome });
  }
}
