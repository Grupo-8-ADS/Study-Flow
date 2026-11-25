# Supabase — Study Flow

Banco Postgres, Auth e API do Study Flow (projeto `fsevgdeegpaxdhcwkkcz`, região sa-east-1).

## Fonte da verdade: `supabase/migrations`

O schema existe **somente** nas migrations deste diretório, aplicadas em ordem. Não existe
`schema.sql` paralelo, e **nada é alterado pelo SQL Editor do painel**: uma mudança feita lá
não entra no histórico do banco, e a próxima pessoa que montar o banco pelas migrations recebe
um schema diferente do de produção.

- `20261020000000_schema_inicial.sql` é a base (tabelas, RLS, triggers e funções originais).
- As demais são incrementais. Cada uma roda dentro de uma transação e não depende de dados
  específicos de produção (nada de ids fixos).
- O nome segue o padrão do Supabase CLI: `AAAAMMDDHHMMSS_descricao.sql`. Os testes recusam
  arquivos fora desse padrão.

### Fluxo para mudar o banco

1. Criar a migration: `npx supabase migration new descricao_curta` e escrever o SQL.
2. Rodar `npm run test:integration`. Os testes montam um banco do zero com todas as migrations
   (Postgres 16 no Docker via Testcontainers ou, sem Docker, PGlite) e testam as regras, o RLS
   e as rotas da API contra ele. É o mesmo comando do CI.
3. Abrir o PR. O CI roda a mesma verificação.
4. No merge na `main`, o workflow **Supabase Migrations**
   (`.github/workflows/supabase-migrations.yml`) roda `supabase db push` e aplica em produção
   só o que estiver pendente.

Para conferir o estado de produção localmente:

```powershell
npx supabase migration list --linked
npx supabase db push --dry-run
```

### Montar um projeto novo

```powershell
npx supabase link --project-ref <ref-do-projeto>
npx supabase db push
```

## Variáveis de ambiente

| Variável | Onde | Para quê |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | web | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | web | chave pública (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | web, **só servidor** | chave secreta (`sb_secret_…`): login por nome de usuário e integração com o Gmail |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | web, só servidor | OAuth do Gmail |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | mobile | URL e chave pública |
| `EXPO_PUBLIC_SITE_URL` | mobile | URL da web, cujas rotas `/api` o app também usa |

A chave secreta, a senha do banco e as connection strings nunca vão para o código, para o
app mobile ou para variáveis `NEXT_PUBLIC_`/`EXPO_PUBLIC_`.

Secrets do GitHub Actions (Settings > Secrets and variables > Actions), usados pelo workflow
de migrations:

- `SUPABASE_ACCESS_TOKEN`: token pessoal em supabase.com/dashboard/account/tokens.
- `SUPABASE_DB_PASSWORD`: senha do banco (Project Settings > Database).

## Segurança

- Toda tabela do usuário tem RLS com `auth.uid() = user_id` (ou `= id` em `profiles`). A web e o
  mobile acessam o banco com o JWT do próprio usuário.
- O login por **nome de usuário** passa pelo servidor (`POST /api/auth/entrar`). Ele descobre o
  e-mail com a chave secreta e devolve só a sessão. A função `get_email_by_username` não pode ser
  executada por `anon` nem por `authenticated`; senão, qualquer pessoa descobriria o e-mail de
  qualquer username. Usuário inexistente e senha errada recebem a mesma resposta.
- Exceções intencionais, documentadas no próprio banco (`comment on`):
  - `delete_own_account()` é `SECURITY DEFINER`, porque precisa apagar a linha do usuário em
    `auth.users`. Só usa `auth.uid()`.
  - `sinc_gmail_tokens` tem RLS ligado e nenhuma policy: só o servidor, com a chave secreta, lê
    e grava os tokens.
- `gerar_notificacoes_prazos()` roda com os privilégios de quem chama. O job diário do pg_cron
  (`studyflow-prazos-diario`, 11:00 UTC) roda como dono das tabelas e cobre todos os usuários.

### Configurações do painel (fora das migrations)

Em **Authentication**:

- **Sign In / Providers > Email > Confirm email**: ligado.
- **Rate Limits > IP Address Forwarding**: ligado. Assim o limite de tentativas de login conta o
  IP de quem está entrando (enviado pela rota no header `Sb-Forwarded-For`), e não o IP do
  servidor da Vercel.
- **Attack Protection > Leaked password protection**: ligado, se o plano permitir. Recusa senhas
  que já apareceram em vazamentos.
