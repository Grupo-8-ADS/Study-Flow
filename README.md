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
  </ul>
</details>

<details>
  <summary>Testing & Quality Assurance</summary>
  <ul>
    <li><a href="https://vitest.dev/">Vitest</a> (Executor nativo de testes unitários de alta performance com ESM)</li>
    <li><code>@vitest/coverage-v8</code> (Relatórios de cobertura com v8 nativo)</li>
    <li>Filosofia baseada no <strong>Testing Trophy</strong> (Kent C. Dodds) e padrão comportamental <strong>AAA</strong></li>
  </ul>
</details>

<details>
  <summary>Backend & Database (Supabase)</summary>
  <ul>
    <li><a href="https://supabase.com/">Supabase</a> (PostgreSQL, Row Level Security, Auth & Storage)</li>
    <li>Autenticação unificada com suporte a login flexível por e-mail ou nome de usuário (username).</li>
    <li>Funções RPC e migrações estruturadas para perfis, disciplinas, cronograma e rotinas semanais.</li>
  </ul>
</details>

### Key Features <a name="key-features"></a>

- **Temporizador Pomodoro & Anotações:** Ciclos de foco e pausas configuráveis, anel animado de progresso, alertas visuais/sonoros e editor de anotações persistidas.
- **Gestão de Disciplinas & Prazos:** Cadastro de matérias, horários de aula, anotações de aula e datas previstas de provas e trabalhos formatadas em `DD/MM/AAAA`.
- **Calendário Acadêmico:** Visualização mensal e diária de compromissos, provas e prazos de entrega com filtros rápidos.
- **Dashboard & Rotinas Semanais:** Resumo diário de tarefas concluídas/pendentes e organização da grade horária semanal.
- **Estatísticas & Gamificação:** Gráficos de distribuição por matéria, metas diárias de horas de estudo, histórico de sessões, níveis e conquistas desbloqueáveis.
- **Autenticação Híbrida Segura:** Login facilitado por e-mail ou username, persistência de sessão e perfil do usuário.
- **Alta Cobertura de Testes Automatizados:** Suíte unitária e de integração em milissegundos com validações de regressão em CI.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 💻 Getting Started <a name="getting-started"></a>

### Prerequisites

- [Node.js](https://nodejs.org/) (versão 20 ou superior)
- [npm](https://www.npmjs.com/) (versão 10 ou superior)
- [Expo Go](https://expo.dev/go) instalado no smartphone (para testar o app mobile)

### Installation & Execution

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/Zackkinho11/Study-Flow.git
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

5. **Executar a Suíte de Testes (Vitest):**
   ```bash
   npm test
   # ou em modo observação contínua (watch):
   npm run test:watch
   ```

6. **Gerar Relatório de Cobertura de Código:**
   ```bash
   npm run test:coverage
   ```

7. **Build de produção da Web:**
   ```bash
   npm run build:web
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 📌 Project Milestones <a name="project-milestones"></a>

O acompanhamento detalhado de todas as fases, funcionalidades concluídas e backlog futuro pode ser consultado no documento:
- 📄 [Milestone.md](./Milestone.md)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 🚀 Live Demo <a name="live-demo"></a>

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
