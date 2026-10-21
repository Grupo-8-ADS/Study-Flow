import type { Page } from "@playwright/test";
import type { UsuarioE2E } from "../support/fixtures";

export class LoginPage {
  constructor(private readonly page: Page) {}

  async abrir() {
    await this.page.goto("/");
  }

  async entrar(login: string, senha: string) {
    await this.page.getByPlaceholder("Email ou usuário").fill(login);
    await this.page.getByPlaceholder("Senha").fill(senha);
    await this.page.getByRole("button", { name: "Entrar" }).click();
  }

  mensagemErro() {
    return this.page.getByText("Email/usuário ou senha informados são inválidos.");
  }
}

export class CadastroPage {
  constructor(private readonly page: Page) {}

  async abrir() {
    await this.page.goto("/cadastro");
  }

  async preencher(usuario: UsuarioE2E, confirmacao = usuario.senha) {
    await this.page.getByPlaceholder("Nome Completo").fill(usuario.nome);
    await this.page.getByPlaceholder("Nome de Usuário").fill(usuario.username);
    await this.page.getByPlaceholder("Email").fill(usuario.email);
    await this.page.getByPlaceholder("Senha", { exact: true }).fill(usuario.senha);
    await this.page.getByPlaceholder("Confirmar Senha").fill(confirmacao);
  }

  async enviar() {
    await this.page.getByRole("button", { name: "Cadastrar" }).click();
  }

  mensagemSucesso() {
    return this.page.getByText("Cadastro realizado com sucesso! Entrando...");
  }
}
