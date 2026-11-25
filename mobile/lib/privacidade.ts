/**
 * Privacidade no app: profiles.privacidade lida e gravada com as regras de
 * `@studyflow/shared` (as mesmas do site). Recarrega quando a tela volta ao foco,
 * para refletir o que foi mudado em outra tela ou no site.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  PRIVACIDADE_PADRAO,
  alternarPrivacidade,
  carregarPrivacidade,
  salvarPrivacidade,
  type ChavePrivacidade,
  type Privacidade,
} from '@studyflow/shared';
import { supabase } from './supabase';

async function usuarioAtual(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export function usePrivacidade() {
  const [privacidade, setPrivacidade] = useState<Privacidade>({ ...PRIVACIDADE_PADRAO });
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        const userId = await usuarioAtual();
        if (!userId) return;
        const lida = await carregarPrivacidade(supabase, userId);
        if (ativo && lida.carregada) setPrivacidade(lida.privacidade);
      })().catch((e) => console.error('Error loading privacy:', e));
      return () => {
        ativo = false;
      };
    }, []),
  );

  /** Inverte uma opção na hora e grava; se falhar, volta ao valor anterior e mostra o erro. */
  const alternar = useCallback(
    async (chave: ChavePrivacidade) => {
      const anterior = privacidade;
      const nova = alternarPrivacidade(anterior, chave);
      setPrivacidade(nova);
      setErro(null);
      const userId = await usuarioAtual();
      const falha = userId ? await salvarPrivacidade(supabase, userId, nova) : 'Entre na sua conta para salvar a privacidade.';
      if (falha) {
        setPrivacidade(anterior);
        setErro(falha);
      }
    },
    [privacidade],
  );

  return { privacidade, alternar, erro };
}
