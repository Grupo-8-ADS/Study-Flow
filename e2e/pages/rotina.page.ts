import type { Page } from "@playwright/test";

export type DiaSemana =
  | "Domingo"
  | "Segunda-feira"
  | "Terça-feira"
  | "Quarta-feira"
  | "Quinta-feira"
  | "Sexta-feira"
  | "Sábado";

export class RotinaPage {
  constructor(private readonly page: Page) {}

  async abrir() {
    await this.page.goto("/rotina");
  }

  async adicionarHorario(dia: DiaSemana, inicio: string, fim: string) {
    await this.page.getByLabel("Dia da semana").selectOption({ label: dia });
    await this.page.getByLabel("Início", { exact: true }).fill(inicio);
    await this.page.getByLabel("Fim", { exact: true }).fill(fim);
    await this.page.getByRole("button", { name: "Adicionar horário" }).click();
  }

  horario(dia: DiaSemana, inicio: string, fim: string) {
    return this.page.getByText(`${dia} · ${inicio} – ${fim}`);
  }

  async gerar(semanas = 1, duracaoBlocoMin = 50) {
    await this.page.getByLabel("Semanas").selectOption(String(semanas));
    await this.page.getByLabel("Duração do bloco (min)").fill(String(duracaoBlocoMin));
    await this.page.getByRole("button", { name: "Gerar cronograma" }).click();
  }

  /** Alertas de negócio (ignora o route announcer vazio do Next.js). */
  alerta(texto: string | RegExp) {
    return this.page.getByRole("alert").filter({ hasText: texto });
  }

  previa() {
    return this.page.getByRole("table");
  }

  linhasDaPrevia() {
    return this.previa().getByRole("row").filter({ hasNot: this.page.getByRole("columnheader") });
  }

  async confirmar() {
    await this.page.getByRole("button", { name: "Confirmar e salvar no cronograma" }).click();
  }

  status() {
    return this.page.getByRole("status").filter({ hasText: "Cronograma salvo!" });
  }
}
