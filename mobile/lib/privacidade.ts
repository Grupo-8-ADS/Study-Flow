/**
 * Privacidade no app: profiles.privacidade lida e gravada com as regras de
 * `@studyflow/shared` (as mesmas do site). Recarrega quando a tela volta ao foco,
 * para refletir o que foi mudado em outra tela ou no site.
 *
 * Enquanto a leitura não deu certo (`carregada: false`), a tela trata tudo como privado
 * (`privacidadeEfetiva`) e não grava nada, para não sobrescrever as escolhas reais com os padrões.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ERRO_CARREGAR_PRIVACIDADE,
  PRIVACIDADE_PADRAO,
  alternarPrivacidadeLida,
  carregarPrivacidade,
  privacidadeEfetiva,
  salvarPrivacidade,
  type ChavePrivacidade,
  type Privacidade,
} from '@studyflow/shared';
import { supabase } from './supabase';

async function usuarioAtual(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

type Lida = { privacidade: Privacidade; carregada: boolean };

export function usePrivacidade() {
  const [lida, setLida] = useState<Lida>({ privacidade: { ...PRIVACIDADE_PADRAO }, carregada: false });
  const [erroGravar, setErroGravar] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    try {
      const userId = await usuarioAtual();
      const r = userId ? await carregarPrivacidade(supabase, userId) : null;
      setLida(r ? { privacidade: r.privacidade, carregada: r.carregada } : { privacidade: { ...PRIVACIDADE_PADRAO }, carregada: false });
    } catch (e) {
      console.error('Error loading privacy:', e);
      setLida((atual) => ({ ...atual, carregada: false }));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void recarregar();
    }, [recarregar]),
  );

  /** Inverte uma opção na hora e grava; se falhar, volta ao valor anterior e mostra o erro. */
  const alternar = useCallback(
    async (chave: ChavePrivacidade) => {
      const nova = alternarPrivacidadeLida(lida, chave);
      if (!nova) return;
      const anterior = lida;
      setLida({ privacidade: nova, carregada: true });
      setErroGravar(null);
      const userId = await usuarioAtual();
      const falha = userId ? await salvarPrivacidade(supabase, userId, nova) : 'Entre na sua conta para salvar a privacidade.';
      if (falha) {
        setLida(anterior);
        setErroGravar(falha);
      }
    },
    [lida],
  );

  return {
    /** O que vale na tela (restrita enquanto não foi lida). */
    privacidade: privacidadeEfetiva(lida),
    carregada: lida.carregada,
    erro: lida.carregada ? erroGravar : ERRO_CARREGAR_PRIVACIDADE,
    alternar,
    recarregar,
  };
}
