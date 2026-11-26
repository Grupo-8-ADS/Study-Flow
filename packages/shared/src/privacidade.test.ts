import { describe, expect, it } from 'vitest';
import {
  OPCOES_PRIVACIDADE,
  PRIVACIDADE_PADRAO,
  PRIVACIDADE_RESTRITA,
  alternarPrivacidade,
  alternarPrivacidadeLida,
  privacidadeEfetiva,
  carregarPrivacidade,
  normalizarPrivacidade,
  privacidadeLegada,
  resolverPrivacidadeLegada,
  salvarPrivacidade,
} from './privacidade';
import { perfilFalso } from './testing/perfil-falso';

describe('normalizarPrivacidade', () => {
  it('quandoNuloOuMalformado_deveUsarPadroes', () => {
    expect(normalizarPrivacidade(null)).toEqual(PRIVACIDADE_PADRAO);
    expect(normalizarPrivacidade('x')).toEqual(PRIVACIDADE_PADRAO);
    expect(normalizarPrivacidade([true])).toEqual(PRIVACIDADE_PADRAO);
  });

  it('quandoParcial_deveCompletarEIgnorarTiposErradosEChavesExtras', () => {
    expect(normalizarPrivacidade({ mostrar_horas: false, perfil_publico: 'sim', outra: true })).toEqual({ ...PRIVACIDADE_PADRAO, mostrar_horas: false });
  });

  it('naoAlteraOsPadroes', () => {
    const p = normalizarPrivacidade(null);
    p.mostrar_horas = false;
    expect(PRIVACIDADE_PADRAO.mostrar_horas).toBe(true);
  });
});

describe('privacidadeLegada', () => {
  it('quandoJsonAntigoDoSite_deveConverterAsChaves', () => {
    expect(privacidadeLegada(JSON.stringify({ allowSharing: false, publicProfile: true, showStudyHours: false, showAchievements: true }))).toEqual({
      permitir_compartilhar: false,
      perfil_publico: true,
      mostrar_horas: false,
      mostrar_conquistas: true,
    });
  });

  it('quandoVazioInvalidoOuSemChavesConhecidas_deveRetornarNull', () => {
    expect(privacidadeLegada(null)).toBeNull();
    expect(privacidadeLegada('{')).toBeNull();
    expect(privacidadeLegada('[]')).toBeNull();
    expect(privacidadeLegada('{"x":1}')).toBeNull();
  });
});

describe('resolverPrivacidadeLegada', () => {
  const legada = { ...PRIVACIDADE_PADRAO, mostrar_horas: false };

  it('quandoPerfilNuncaConfigurado_deveUsarELerGravarALegada', () => {
    expect(resolverPrivacidadeLegada({ privacidade: PRIVACIDADE_PADRAO, carregada: true, configurada: false }, legada)).toEqual({ privacidade: legada, gravar: true });
  });

  it('quandoPerfilJaConfiguradoOuLeituraFalhou_deveManterOPerfil', () => {
    const doBanco = { ...PRIVACIDADE_PADRAO, perfil_publico: true };
    expect(resolverPrivacidadeLegada({ privacidade: doBanco, carregada: true, configurada: true }, legada)).toEqual({ privacidade: doBanco, gravar: false });
    expect(resolverPrivacidadeLegada({ privacidade: PRIVACIDADE_PADRAO, carregada: false, configurada: false }, legada).gravar).toBe(false);
    expect(resolverPrivacidadeLegada({ privacidade: PRIVACIDADE_PADRAO, carregada: true, configurada: false }, null).gravar).toBe(false);
  });
});

describe('alternarPrivacidade e opções', () => {
  it('inverteSoAChaveEscolhida', () => {
    expect(alternarPrivacidade(PRIVACIDADE_PADRAO, 'permitir_compartilhar')).toEqual({ ...PRIVACIDADE_PADRAO, permitir_compartilhar: false });
  });

  it('temUmaOpcaoParaCadaChave', () => {
    expect(OPCOES_PRIVACIDADE.map((o) => o.chave).sort()).toEqual(Object.keys(PRIVACIDADE_PADRAO).sort());
  });
});

describe('carregarPrivacidade / salvarPrivacidade', () => {
  it('quandoColunaNula_deveDevolverPadroesNaoConfigurados', async () => {
    const { client } = perfilFalso({ privacidade: null });
    expect(await carregarPrivacidade(client, 'u1')).toEqual({ privacidade: PRIVACIDADE_PADRAO, carregada: true, configurada: false });
  });

  it('quandoColunaPreenchida_deveNormalizar', async () => {
    const { client } = perfilFalso({ privacidade: { mostrar_horas: false } });
    const r = await carregarPrivacidade(client, 'u1');
    expect(r.configurada).toBe(true);
    expect(r.privacidade.mostrar_horas).toBe(false);
  });

  it('quandoLeituraFalha_deveMarcarComoNaoCarregada', async () => {
    const { client } = perfilFalso({}, { select: { message: 'rede' } });
    expect((await carregarPrivacidade(client, 'u1')).carregada).toBe(false);
  });

  it('salvaNormalizadoEDevolveMensagemEmErro', async () => {
    const { client, updates } = perfilFalso({ privacidade: null });
    expect(await salvarPrivacidade(client, 'u1', { ...PRIVACIDADE_PADRAO, mostrar_conquistas: false })).toBeNull();
    expect(updates).toEqual([{ privacidade: { ...PRIVACIDADE_PADRAO, mostrar_conquistas: false } }]);

    const falho = perfilFalso({}, { update: { message: 'x' } });
    expect(await salvarPrivacidade(falho.client, 'u1', PRIVACIDADE_PADRAO)).toMatch(/Não foi possível/);
  });
});

describe('privacidade não lida', () => {
  const naoLida = { privacidade: PRIVACIDADE_PADRAO, carregada: false };
  const lida = { privacidade: { ...PRIVACIDADE_PADRAO, mostrar_horas: false }, carregada: true };

  it('privacidadeEfetiva_quandoNaoLida_deveTratarComoPrivada', () => {
    expect(privacidadeEfetiva(naoLida)).toEqual(PRIVACIDADE_RESTRITA);
    expect(Object.values(PRIVACIDADE_RESTRITA).every((v) => v === false)).toBe(true);
    expect(privacidadeEfetiva(lida)).toEqual(lida.privacidade);
  });

  it('alternarPrivacidadeLida_quandoNaoLida_naoDeixaGravar', () => {
    expect(alternarPrivacidadeLida(naoLida, 'mostrar_horas')).toBeNull();
    expect(alternarPrivacidadeLida(lida, 'mostrar_horas')).toEqual(PRIVACIDADE_PADRAO);
  });
});
