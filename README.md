<a name="readme-top"></a>

<div align="center">
  <img src="Logo_semfundo.png" alt="logo" width="140" height="auto" />
  <br/>
  <h3><b>Study Flow</b></h3>
</div>

# 📗 Table of Contents

- [📖 About the Project](#about-project)
  - [🛠 Built With](#built-with)
    - [Tech Stack](#tech-stack)
    - [Key Features](#key-features)
- [💻 Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation & Execution](#installation--execution)
  - [Environment Variables](#environment-variables)
  - [Gmail Integration Setup](#gmail-setup)
- [🧪 Tests](#tests)
- [⚙️ CI/CD & Releases](#ci-cd)
- [📌 Project Milestones](#project-milestones)
- [🚀 Live Demo](#live-demo)
- [👥 Authors](#authors)

# 📖 Study Flow <a name="about-project"></a>

> O **Study Flow** é uma plataforma de gerenciamento de estudos multiplataforma (Web & Mobile) voltada para a produtividade pessoal, organização acadêmica e controle de rotinas de aprendizagem.

A aplicação unifica o controle de tempo de estudo por meio de ciclos Pomodoro, gerenciamento de disciplinas com datas de provas e trabalhos, calendário interativo de compromissos, acompanhamento de métricas de desempenho e gamificação para incentivar o hábito diário de estudos.

## 🛠 Built With <a name="built-with"></a>

### Tech Stack <a name="tech-stack"></a>

<details>
  <summary>Frontend Web (<code>frontend/</code>)</summary>
  <ul>
    <li><a href="https://nextjs.org/">Next.js 16 (App Router & Turbopack)</a></li>
    <li><a href="https://react.dev/">React 19</a></li>
    <li><a href="https://tailwindcss.com/">Tailwind CSS v4</a></li>
    <li><a href="https://lucide.dev/">Lucide React</a></li>
  </ul>
</details>

<details>
  <summary>Mobile App (<code>mobile/</code>)</summary>
  <ul>
    <li><a href="https://reactnative.dev/">React Native</a></li>
    <li><a href="https://expo.dev/">Expo SDK 57 (Expo Router)</a></li>
    <li><a href="https://lucide.dev/">Lucide React Native</a></li>
    <li><a href="https://docs.expo.dev/versions/latest/sdk/async-storage/">Async Storage & Safe Area Context</a></li>
  </ul>
</details>

<details>
  <summary>Shared Package (<code>packages/shared/</code>)</summary>
  <ul>
    <li>Módulo TypeScript comum com tipagens unificadas de sessão, disciplinas, itens de cronograma e rotinas.</li>
    <li>Utilitários e validadores de data/hora com máscaras e formatação padrão brasileiro (<code>DD/MM/AAAA</code>) convertidas de/para ISO <code>YYYY-MM-DD</code>.</li>
    <li>Regras puras reaproveitadas no web e no mobile: gerador de cronograma, níveis e progresso de conquistas, relatórios por período (com CSV) e extração de provas/entregas a partir de e-mails.</li>
  </ul>
</details>

<details>
  <summary>Testing & Quality Assurance</summary>
  <ul>
    <li><a href="https://vitest.dev/">Vitest</a> (Executor nativo de testes unitários de alta performance com ESM)</li>
    <li><code>@vitest/coverage-v8</code> (Relatórios de cobertura com v8 nativo)</li>
    <li>Filosofia baseada no <strong>Testing Trophy</strong> (Kent C. Dodds) e padrão comportamental <strong>AAA</strong></li>
    <li>Testes de integração com PostgreSQL efêmero (PGlite / Testcontainers) e <a href="https://mswjs.io/">MSW</a> para APIs externas</li>
    <li><a href="https://playwright.dev/">Playwright</a> (E2E) e <a href="https://stryker-mutator.io/">Stryker</a> (testes de mutação)</li>
  </ul>
</details>

<details>
  <summary>Backend & Database (Supabase)</summary>
  <ul>
    <li><a href="https://supabase.com/">Supabase</a> (PostgreSQL, Row Level Security, Auth & Storage)</li>
    <li>Autenticação unificada com suporte a login flexível por e-mail ou nome de usuário (username).</li>
    <li>Funções RPC e migrações estruturadas para perfis, disciplinas, cronograma e rotinas semanais.</li>
    <li>Regras de negócio no banco: XP, níveis e conquistas por trigger, avisos de prazos diários via <code>pg_cron</code> e exclusão de conta (LGPD).</li>
    <li>Hospedagem do web na <a href="https://vercel.com/">Vercel</a>, com rotas de API (Next.js) para a integração com o Gmail.</li>
  </ul>
</details>

### Key Features <a name="key-features"></a>

- **Temporizador Pomodoro & Anotações:** Ciclos de foco e pausas configuráveis, anel animado de progresso, alertas visuais/sonoros e editor de anotações persistidas.
- **Gestão de Disciplinas & Prazos:** Cadastro de matérias, horários de aula, anotações de aula e datas previstas de provas e trabalhos formatadas em `DD/MM/AAAA`.
- **Calendário Acadêmico:** Visualização mensal e diária de compromissos, provas e prazos de entrega com filtros rápidos.
- **Dashboard & Rotinas Semanais:** Resumo diário de tarefas concluídas/pendentes e organização da grade horária semanal.
- **Estatísticas & Gamificação:** Gráficos de distribuição por matéria, metas de horas a partir do perfil, histórico de sessões, níveis e conquistas concedidas pelo banco.
- **Relatórios Periódicos:** Semana, mês ou intervalo personalizado, com exportação em CSV e compartilhamento do progresso.
- **Notificações:** Sino com avisos reais (prazos próximos e conquistas) no web e no mobile, e lembretes locais no celular (fim do Pomodoro e véspera de provas).
- **Integração com o Gmail:** Palavras-chave definidas pelo usuário; e-mails de provas e entregas viram itens no calendário, sem duplicar.
- **Privacidade (LGPD):** Exclusão definitiva da conta e de todos os dados pelo próprio usuário.
- **Autenticação Híbrida Segura:** Login facilitado por e-mail ou username, persistência de sessão e perfil do usuário.
- **Alta Cobertura de Testes Automatizados:** Suíte unitária e de integração em milissegundos com validações de regressão em CI.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 💻 Getting Started <a name="getting-started"></a>

### Prerequisites

- [Node.js](https://nodejs.org/) 22 (versão em `.nvmrc`)
- [npm](https://www.npmjs.com/) (versão 10 ou superior)
- [Expo Go](https://expo.dev/go) instalado no smartphone (para testar o app mobile)

### Installation & Execution

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/Grupo-8-ADS/Study-Flow.git
   cd Study-Flow
   ```

2. **Instale as dependências do monorepo:**
   ```bash
   npm install
   ```

3. **Execute o Frontend Web:**
   ```bash
   npm run dev:web
   ```
   Acesse a aplicação no navegador em `http://localhost:3000`.

4. **Execute o Aplicativo Mobile:**
   ```bash
   npm run dev:mobile
   # ou com tunnel para testes em redes externas:
   npm run dev:mobile:tunnel
   ```
   Abra o app **Expo Go** e escaneie o QR Code exibido no terminal.

5. **Build de produção da Web:**
   ```bash
   npm run build:web
   ```

### Environment Variables <a name="environment-variables"></a>

Crie `frontend/.env.local` (já ignorado pelo git). Na Vercel, as mesmas variáveis ficam em **Settings → Environment Variables**.

| Variável | Onde é usada | Obrigatória |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente Supabase (navegador) | Sim |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cliente Supabase (navegador) | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Rotas `/api/gmail/*` (servidor). Guarda o token do Gmail numa tabela fechada para o navegador. **Nunca** usar em variável `NEXT_PUBLIC_*` | Só para o Gmail |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth do Google (servidor) | Só para o Gmail |

Sem as três últimas, o app funciona normalmente e a página **Integrações** mostra o Gmail como "não configurado".

O app mobile lê `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

### Gmail Integration Setup <a name="gmail-setup"></a>

1. No [Google Cloud Console](https://console.cloud.google.com), crie um projeto e ative a **Gmail API**.
2. Em **Google Auth Platform**, configure a tela de consentimento com público **Externo**, mantenha o app **Em teste** e adicione os e-mails de quem vai testar em **Usuários de teste**.
3. Em **Acesso a dados**, adicione o escopo `.../auth/gmail.readonly` (somente leitura).
4. Em **Clientes**, crie um cliente **Aplicativo da Web** com os redirecionamentos:
   - `http://localhost:3000/api/gmail/callback`
   - `https://study-flow-ten-olive.vercel.app/api/gmail/callback`
5. Copie o ID e a chave secreta para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.

> Em modo de teste o Google expira o acesso a cada 7 dias; o app pede para reconectar.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 🧪 Tests <a name="tests"></a>

| Comando | O que roda |
|---|---|
| `npm test` | Testes unitários (Vitest) |
| `npm run test:coverage` | Unitários com cobertura mínima (a CI falha abaixo do piso) |
| `npm run test:integration` | Integração com PostgreSQL efêmero (schema, RLS, triggers, RPCs) e APIs externas mockadas com MSW |
| `npm run test:e2e` | E2E com Playwright contra o Supabase real; o Google é substituído por um servidor falso (`e2e/support/google-mock.mjs`) |
| `npm run test:mutation` | Testes de mutação (Stryker) |

O E2E do fluxo do Gmail só roda com `SUPABASE_SERVICE_ROLE_KEY` definida (no `.env.local` ou nos secrets da CI); sem ela, esse caso é pulado.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## ⚙️ CI/CD & Releases <a name="ci-cd"></a>

- **CI** (`.github/workflows/frontend-ci.yml`): em cada PR roda lint, tipos, testes unitários com cobertura, integração, E2E e as checagens do mobile (tipos, lint, `expo-doctor`, bundle Android).
- **Web**: cada merge no `main` é publicado automaticamente na Vercel.
- **APK** (`.github/workflows/mobile-release.yml`): gera o APK assinado e versionado e anexa em [Releases](https://github.com/Grupo-8-ADS/Study-Flow/releases). Para lançar uma versão nova a partir do `main` atualizado:
  ```bash
  npm run release:mobile -- 1.2.0
  ```
  O script atualiza a versão, cria o commit e a tag `mobile-v1.2.0` e envia; o workflow faz o resto. O `versionCode` do Android é `MAJOR*10000 + MINOR*100 + PATCH`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 📌 Project Milestones <a name="project-milestones"></a>

O acompanhamento detalhado de todas as fases, funcionalidades concluídas e backlog futuro pode ser consultado no documento:
- 📄 [Milestone.md](./Milestone.md)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 🚀 Live Demo <a name="live-demo"></a>

- 🌐 **Web:** [study-flow-ten-olive.vercel.app](https://study-flow-ten-olive.vercel.app)
- 📱 **Android (APK):** baixe a versão mais recente em [Releases](https://github.com/Grupo-8-ADS/Study-Flow/releases/latest) (é preciso permitir a instalação de apps de fontes desconhecidas).
- [Link do Protótipo no Figma](https://www.figma.com/design/KjIEnEdvbbahRYknOauBoy/Wireframes-Kit---Free-wireframing-Websites-and-SaaS-UI-UX--Community-?node-id=3102-1990&p=f&t=A1gtB7KxMSXFyHY7-0)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 👥 Authors <a name="authors"></a>

* **Beatriz Coelho Pereira**
  * **Email:** <d2022010992@unifei.edu.br>
  * **GitHub:** [@BiaCodess](https://github.com/BiaCodess)
* **Breno Vítor de Paula**
  * **Email:** <anonymoustp44@gmail.com>
  * **GitHub:** [@Juuzou0012](https://github.com/Juuzou0012)
* **Carlos Eduardo Abreu da Silva**
  * **Email:** <d2022004556@unifei.edu.br>
  * **GitHub:** [@CarloseduASilva](https://github.com/CarloseduASilva)
* **Lucas Luz Souza Pires**
  * **Email:** <d2022003076@unifei.edu.br>
  * **GitHub:** [@Lucass654](https://github.com/Lucass654)
* **Vítor Hugo Rodrigues Basílio**
  * **Email:** <d2023011321@unifei.edu.br>
  * **GitHub:** [@Zackkinho11](https://github.com/Zackkinho11)
