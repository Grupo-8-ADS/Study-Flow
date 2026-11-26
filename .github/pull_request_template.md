## O que muda

<!-- Resumo da mudança e do motivo. -->

## Como testar

<!-- Passos, contas de teste e o que deve acontecer. -->

## Checklist

- [ ] `npm run verify` passa localmente (lint, tipos, testes e build).
- [ ] **Web e mobile atualizados**: a mudança vale nas duas plataformas, ou o motivo de valer só em uma está registrado em [`Docs/paridade-web-mobile.md`](../Docs/paridade-web-mobile.md).
- [ ] Regra de negócio, texto ou validação nova está em `packages/shared`, com teste unitário (as telas só fazem a interface).
- [ ] Mudança no banco feita só com migration nova em `supabase/migrations` (idempotente e com RLS).
- [ ] Testado no navegador e/ou no app (diga onde e como).
