import { useCallback } from 'react';
import { usePathname, useRouter, type Href } from 'expo-router';

/** Rotas que vivem dentro da barra de abas (app/(tabs)). */
const TAB_ROUTES = new Set(['/dashboard', '/calendario', '/timer', '/disciplinas', '/estatisticas']);

/**
 * Navegação entre seções sem empilhar telas repetidas:
 * - aba → aba: troca de aba;
 * - tela de seção → aba: volta à barra de abas (dismissTo), sem abrir outra cópia dela;
 * - tela de seção → tela irmã (ex.: Atividades → Rotina): substitui a tela atual;
 * - aba → tela de seção: empilha normalmente (o voltar retorna à aba).
 */
export function useIrPara() {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (href: string) => {
      if (href === pathname) return;
      const destinoEhAba = TAB_ROUTES.has(href);
      const atualEhAba = TAB_ROUTES.has(pathname);
      const destino = href as Href;
      if (destinoEhAba) {
        if (atualEhAba) router.navigate(destino);
        else router.dismissTo(destino);
      } else if (atualEhAba) {
        router.push(destino);
      } else {
        router.replace(destino);
      }
    },
    [router, pathname],
  );
}
