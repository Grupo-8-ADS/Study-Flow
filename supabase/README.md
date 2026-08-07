# Supabase setup - Study Flow

## 1. Environment variables

Use only public browser-safe variables in the frontend:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Never commit or expose `SUPABASE_SECRET_KEY`, `SERVICE_ROLE_KEY`, direct database passwords, or connection strings.

## 2. Database

Open the Supabase dashboard, go to **SQL Editor**, and run:

```sql
-- paste the contents of supabase/schema.sql
```

The schema is based on the project documentation:

- Auth credentials: `auth.users`
- App profile: `profiles`
- Subjects: `disciplinas`
- Evaluations: `avaliacoes`
- Topics: `topicos`
- Goals: `metas`
- Schedule items/tasks: `itens_cronograma`
- Timer sessions: `sessoes_estudo`
- Notifications: `notificacoes`
- Rewards: `conquistas` and `user_conquistas`
- Email sync keywords/settings: `palavras_chave` and `sinc_gmail`

## 3. Security

Every user-owned table has RLS enabled. Policies use:

```sql
auth.uid() = user_id
```

or, for `profiles`:

```sql
auth.uid() = id
```

`conquistas` is readable by authenticated users, while `user_conquistas` is private per user.

## 4. Auth profile creation

The schema includes a trigger on `auth.users` that creates a `profiles` row after signup.

When signing up from the frontend, send metadata:

```ts
{
  nome: "Nome do usuário",
  username: "nomeusuario"
}
```

## 5. Next implementation order

1. Replace localStorage login/register with Supabase Auth.
2. Load and update profile from `profiles`.
3. Move dashboard tasks to `itens_cronograma`.
4. Move subjects to `disciplinas`.
5. Save Pomodoro sessions to `sessoes_estudo`.
6. Read rewards from `conquistas` and user unlocks from `user_conquistas`.
