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

## 🎯 Milestone 3: Integração Definitiva Supabase, Padronização DD/MM/AAAA e Testes Unitários Vitest (Concluída)

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

## 🎯 Milestone 4: Requisitos Completos, CI/CD, APK e Deploy (Concluída)

Fechamento de todos os requisitos em aberto, com regras de negócio no banco, testes em todos os níveis e entrega contínua.

### Requisitos entregues

| Requisito | Entrega |
|---|---|
| RF003 Login por username | RPC `get_email_by_username` versionada em migration (sem ambiguidade de overload) |
| RF004 Gamificação | XP, nível e conquistas calculados por trigger no banco; o cliente não consegue alterar XP nem conceder conquistas. Progresso real das conquistas no web e no mobile |
| RF007 Compartilhar progresso | Texto com o nível real, via `navigator.share` com fallback para a área de transferência |
| RF010 Notificações | Sino real no web e no mobile; avisos de prazos (≤ 3 dias) gerados diariamente via `pg_cron`; lembretes locais no celular (fim do Pomodoro e véspera de provas) respeitando a preferência do usuário |
| RF011 Relatórios periódicos | Semana, mês ou intervalo personalizado, exportação CSV e metas a partir do perfil |
| RF012 Gmail | Página Integrações (palavras-chave + conexão OAuth somente leitura); e-mails viram itens do calendário sem duplicar; token guardado só no servidor |
| RNF001 LGPD | Exclusão definitiva da conta e de todos os dados (`delete_own_account`) no web e no mobile |

### Qualidade e entrega
- **Testes**: unitários com cobertura mínima na CI, mutação (Stryker, ≥ 96% nos módulos novos), integração com PostgreSQL efêmero (RLS, triggers, RPCs) e MSW para o Google, e E2E com Playwright para os fluxos de cronograma, Pomodoro, Gmail e conquistas.
- **CI**: lint, tipos, testes, integração, E2E e checagens do mobile (`expo-doctor`, bundle Android) em cada PR; Dependabot semanal.
- **APK**: pipeline de release assinado e versionado (`npm run release:mobile -- X.Y.Z`), publicado em Releases.
- **Web**: deploy automático na Vercel a cada merge no `main` (funções em São Paulo, perto do banco).

---

## 🚀 Próximas Milestones (Backlog Futuro)

- [ ] Publicar o app OAuth do Google (sair do modo de teste) para liberar o Gmail a qualquer usuário.
- [ ] Sincronização automática do Gmail em segundo plano (hoje é sob demanda).
- [ ] Upload de avatar e banner para o Supabase Storage (hoje ficam no perfil como data URL).
- [ ] Publicação do app na Play Store.
