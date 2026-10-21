import type { Page } from "@playwright/test";

export class TimerPage {
  constructor(private readonly page: Page) {}

  async abrir() {
    await this.page.goto("/timer");
  }

  async selecionarDisciplina(nome: string) {
    await this.page.getByLabel("Disciplina da sessão").selectOption({ label: nome });
  }

  async iniciar() {
    await this.page.getByRole("button", { name: "Iniciar cronômetro", exact: true }).click();
  }

  async pausar() {
    await this.page.getByRole("button", { name: "Pausar cronômetro", exact: true }).click();
  }

  async reiniciar() {
    await this.page.getByRole("button", { name: "Reiniciar cronômetro", exact: true }).click();
  }

  relogio() {
    return this.page.getByRole("timer");
  }
}

export class EstatisticasPage {
  constructor(private readonly page: Page) {}

  async abrir() {
    await this.page.goto("/estatisticas");
  }

  horasDaSemana() {
    return this.page.getByRole("article", { name: "Tempo: Semana" });
  }
}
