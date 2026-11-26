-- Preferências de privacidade no perfil, compartilhadas entre o site e o app.
-- Antes ficavam só no localStorage do navegador (web) ou só na memória da tela (mobile).
-- O formato e os padrões ficam em packages/shared/src/privacidade.ts; null = nunca
-- configurado (os apps usam os padrões e o site migra o valor antigo do localStorage).

alter table public.profiles add column if not exists privacidade jsonb;

alter table public.profiles drop constraint if exists profiles_privacidade_valida;
alter table public.profiles add constraint profiles_privacidade_valida check (
  privacidade is null
  or (
    jsonb_typeof(privacidade) = 'object'
    and (privacidade - array['permitir_compartilhar', 'perfil_publico', 'mostrar_horas', 'mostrar_conquistas']) = '{}'::jsonb
    and coalesce(jsonb_typeof(privacidade -> 'permitir_compartilhar'), 'boolean') = 'boolean'
    and coalesce(jsonb_typeof(privacidade -> 'perfil_publico'), 'boolean') = 'boolean'
    and coalesce(jsonb_typeof(privacidade -> 'mostrar_horas'), 'boolean') = 'boolean'
    and coalesce(jsonb_typeof(privacidade -> 'mostrar_conquistas'), 'boolean') = 'boolean'
  )
);

comment on column public.profiles.privacidade is
  'Preferências de privacidade {permitir_compartilhar, perfil_publico, mostrar_horas, mostrar_conquistas}; null = padrões.';

-- O usuário edita a própria privacidade (a policy de update de profiles já limita à própria linha).
grant update (privacidade) on public.profiles to authenticated;
