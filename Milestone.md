# Controle de Milestone - Study Flow

Este arquivo descreve o progresso e o estado atual das implementações do projeto **Study Flow**. Ele serve como guia para controle de entregas e marcos de desenvolvimento.

---

## 📖 Contexto do Projeto

O **Study Flow** é uma solução completa (Web e Mobile) para produtividade e organização acadêmica de estudantes, centralizando o gerenciamento de tempo através de Pomodoro, planejamento semanal de rotinas, acompanhamento de disciplinas, prazos de provas/trabalhos, calendário dinâmico e métricas de desempenho.

### Stack Tecnológica Atual
- **Arquitetura**: Monorepo gerenciado via npm workspaces (`frontend`, `mobile`, `packages/*`).
- **Frontend Web**: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4, Lucide React.
- **Mobile**: React Native, Expo SDK 57 (Expo Router), Lucide React Native, React Native Safe Area Context.
- **Módulo Compartilhado (`@studyflow/shared`)**: Tipagens TypeScript comuns, constantes de tema, regras de negócio e utilitários de validação e máscaras de data/hora (`DD/MM/AAAA`).
- **Testes & Qualidade**: Vitest, @vitest/coverage-v8, ESLint e TypeScript estrito (Testing Trophy / Escola de Detroit).
- **Backend & Banco de Dados**: Supabase (PostgreSQL, Auth com login por email/username, Row Level Security, RPCs, Storage).

---

## 🏁 Histórico de Milestones Concluídas

### Milestone 1: Prototipação e Interface Base Web
- Fluxos iniciais de login e cadastro.
- Temporizador Pomodoro básico com anel de progresso e anotações vinculadas.

### Milestone 2: Expansão Monorepo, App Mobile e Backend Supabase
- Criação da estrutura de monorepo e do pacote `@studyflow/shared`.
- Desenvolvimento do aplicativo Mobile com Expo Router e abas principais (Dashboard, Calendário, Timer, Estatísticas, Perfil).
- Modelagem e criação das tabelas no Supabase (`profiles`, `disciplinas`, `itens_cronograma`, `rotinas_semanais`, `sessoes_estudo`).
- Sincronização inicial das telas mobile com o banco de dados Supabase.

---

## 🎯 Milestone Atual: Integração Definitiva Supabase, Padronização DD/MM/AAAA e Testes Unitários Vitest (Concluída)

Nesta etapa, consolidamos a integração nativa com o backend de produção Supabase, aprimoramos a experiência do usuário e introduzimos a infraestrutura profissional de testes automatizados com Vitest.

### Funcionalidades e Melhorias Entregues:

1. **Autenticação Real Unificada (Supabase Auth)**
   - Desativação dos armazenamentos simulados locais (`studyflow_users` / `demoMode`) em favor da autenticação segura no Supabase.
   - Suporte a login flexível tanto por **e-mail** quanto por **nome de usuário (username)** no frontend web e no app mobile, utilizando função RPC e busca segura em `profiles`.
   - Fluxo de logout e encerramento de sessão conectado ao `supabase.auth.signOut()`.

2. **Padronização e Validação de Datas no Formato Brasileiro (`DD/MM/AAAA`)**
   - Evolução de `@studyflow/shared` com funções:
     - `isValidDateString`: aceita tanto `DD/MM/AAAA` quanto `AAAA-MM-DD`.
     - `applyDateMask`: máscara dinâmica de digitação para `DD/MM/AAAA`.
     - `toDatabaseDate`: conversor seguro para `YYYY-MM-DD` para persistência no PostgreSQL.
     - `formatDisplayDate`: conversor para apresentação amigável nas interfaces (`DD/MM/AAAA`).
   - Adaptação das telas de **Disciplinas**, **Atividades**, **Dashboard** e **Calendário** no app mobile para utilizar o formato brasileiro na entrada e listagem de eventos e provas.

3. **Polimento Visual, Responsividade e Identidade**
   - Implementação de `useSafeAreaInsets` na barra de abas inferior (`TabLayout`) do app mobile, eliminando sobreposições com as barras de navegação do sistema no Android e iOS.
   - Atualização e unificação do asset visual de logotipo (`logo.png`) entre as aplicações web e mobile.
   - Mensagens de erro e feedback aprimoradas diretamente a partir das respostas do backend.

4. **Infraestrutura e Cobertura de Testes Unitários (Vitest & Testing Trophy)**
   - Configuração do **Vitest** (`vitest.config.mts`) nativo com ESM e aliases no monorepo, alcançando tempo de execução sub-segundo (< 400ms).
   - Relatórios de cobertura via `@vitest/coverage-v8` com **100% de cobertura de funções** e **> 92% de cobertura de declarações** no core de negócio (`validation.ts` e `studyflow-data.ts`).
   - 43 testes unitários com padrão **AAA** (*Arrange, Act, Assert*) e nomenclatura comportamental (`[Cenario]_[Condicao]_[ResultadoEsperado]`).
   - Integração da etapa `Run Tests` no workflow do **GitHub Actions CI**.

---

## 🚀 Próximas Milestones (Backlog Futuro)

- [ ] Notificações push locais/remotas no app mobile para término do ciclo Pomodoro e alertas de prazos.
- [ ] Integração de automação e sincronização com Google Calendar / Gmail.
- [ ] Implementação de upload de avatar e banner customizados para o Supabase Storage.
- [ ] Filtros avançados e relatórios exportáveis na tela de Estatísticas.
