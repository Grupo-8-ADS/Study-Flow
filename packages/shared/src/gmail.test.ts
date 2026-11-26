import { describe, it, expect } from 'vitest';
import {
  montarConsultaGmail,
  classificarTipo,
  extrairData,
  extrairEventosDoEmail,
  limparCorpo,
  textoDeHtml,
  LOCALIZACOES_PALAVRA,
  type EmailResumo,
  type PalavraChave,
} from './gmail';

// 03/11/2026 (terça-feira), horário local.
const REF = new Date(2026, 10, 3);

const kw = (palavra: string, localizacao: PalavraChave['localizacao'] = 'assunto'): PalavraChave => ({
  palavra,
  localizacao,
});

describe('montarConsultaGmail', () => {
  it('montarConsultaGmail_quandoSemPalavras_deveRetornarNull', () => {
    expect(montarConsultaGmail([])).toBeNull();
  });

  it('montarConsultaGmail_quandoPalavrasVaziasOuEspacos_deveRetornarNull', () => {
    expect(montarConsultaGmail([kw(''), kw('   ')], new Date(2026, 0, 1))).toBeNull();
  });

  it('montarConsultaGmail_quandoPalavraSoComCaracteresEspeciais_deveRetornarNull', () => {
    expect(montarConsultaGmail([kw('"{}()"')])).toBeNull();
  });

  it('montarConsultaGmail_quandoUmaPalavraNoAssunto_deveUsarPrefixoSubject', () => {
    expect(montarConsultaGmail([kw('prova')])).toBe('subject:prova');
  });

  it('montarConsultaGmail_quandoCadaLocalizacao_deveAplicarOPrefixoCorreto', () => {
    expect(montarConsultaGmail([kw('x', 'assunto')])).toBe('subject:x');
    expect(montarConsultaGmail([kw('x', 'corpo')])).toBe('x');
    expect(montarConsultaGmail([kw('x', 'remetente')])).toBe('from:x');
    expect(montarConsultaGmail([kw('x', 'destinatario')])).toBe('to:x');
  });

  it('montarConsultaGmail_quandoLocalizacaoDesconhecida_deveTratarComoCorpo', () => {
    const palavra = { palavra: 'x', localizacao: 'outra' } as unknown as PalavraChave;
    expect(montarConsultaGmail([palavra])).toBe('x');
  });

  it('montarConsultaGmail_quandoVariasPalavras_deveAgruparComChavesDeOr', () => {
    const q = montarConsultaGmail([kw('prova'), kw('trabalho', 'corpo'), kw('prof@x.com', 'remetente')]);
    expect(q).toBe('{subject:prova trabalho from:prof@x.com}');
  });

  it('montarConsultaGmail_quandoUmaPalavraSo_deveNaoUsarChaves', () => {
    expect(montarConsultaGmail([kw('prova')])).not.toContain('{');
  });

  it('montarConsultaGmail_quandoPalavraComVariasPalavras_deveEnvolverEmAspas', () => {
    expect(montarConsultaGmail([kw('entrega final')])).toBe('subject:"entrega final"');
    expect(montarConsultaGmail([kw('entrega final', 'corpo'), kw('prova')])).toBe(
      '{"entrega final" subject:prova}',
    );
  });

  it('montarConsultaGmail_quandoEspacosMultiplos_deveNormalizarParaUm', () => {
    expect(montarConsultaGmail([kw('  entrega    final  ')])).toBe('subject:"entrega final"');
  });

  it('montarConsultaGmail_quandoPalavraComAspasEChaves_deveSubstituirPorEspaco', () => {
    expect(montarConsultaGmail([kw('a"b{c}(d)')])).toBe('subject:"a b c d"');
    expect(montarConsultaGmail([kw('"prova"')])).toBe('subject:prova');
  });

  it('montarConsultaGmail_quandoTermosRepetidos_deveRemoverDuplicatas', () => {
    expect(montarConsultaGmail([kw('prova'), kw('prova')])).toBe('subject:prova');
    expect(montarConsultaGmail([kw('prova'), kw('  prova  '), kw('trabalho')])).toBe(
      '{subject:prova subject:trabalho}',
    );
  });

  it('montarConsultaGmail_quandoMesmaPalavraEmLocalizacoesDiferentes_deveManterAmbas', () => {
    expect(montarConsultaGmail([kw('prova', 'assunto'), kw('prova', 'corpo')])).toBe('{subject:prova prova}');
  });

  it('montarConsultaGmail_quandoPalavraVaziaEntreValidas_deveIgnorarVazia', () => {
    expect(montarConsultaGmail([kw(''), kw('prova'), kw(' ')])).toBe('subject:prova');
  });

  it('montarConsultaGmail_quandoDesdeInformado_deveAcrescentarAfterComBarrasEZeros', () => {
    expect(montarConsultaGmail([kw('prova')], new Date(2026, 0, 5))).toBe('subject:prova after:2026/01/05');
    expect(montarConsultaGmail([kw('prova')], new Date(2026, 10, 23, 18, 30))).toBe(
      'subject:prova after:2026/11/23',
    );
  });

  it('montarConsultaGmail_quandoVariasPalavrasEDesde_deveAplicarAfterForaDasChaves', () => {
    expect(montarConsultaGmail([kw('a'), kw('b')], new Date(2026, 11, 31))).toBe(
      '{subject:a subject:b} after:2026/12/31',
    );
  });

  it('montarConsultaGmail_quandoDesdeNuloOuAusente_deveNaoIncluirAfter', () => {
    expect(montarConsultaGmail([kw('prova')], null)).toBe('subject:prova');
    expect(montarConsultaGmail([kw('prova')], undefined)).toBe('subject:prova');
  });
});

describe('classificarTipo', () => {
  it.each([
    ['Prova de Cálculo', 'prova'],
    ['PROVA', 'prova'],
    ['Avaliação parcial', 'prova'],
    ['avaliacao final', 'prova'],
    ['Exame final', 'prova'],
    ['Teste surpresa', 'prova'],
    ['P1 de Física', 'prova'],
    ['p9 de Física', 'prova'],
    ['Trabalho em grupo', 'trabalho'],
    ['Projeto integrador', 'trabalho'],
    ['Seminário de TCC', 'trabalho'],
    ['seminario', 'trabalho'],
    ['Relatório de estágio', 'trabalho'],
    ['relatorio', 'trabalho'],
    ['Entrega do código', 'entrega'],
    ['Prazo final', 'entrega'],
    ['Deadline sexta', 'entrega'],
    ['Submissão de artigo', 'entrega'],
    ['submissao', 'entrega'],
  ])('classificarTipo_quandoTexto"%s"_deveRetornar%s', (texto, esperado) => {
    expect(classificarTipo(texto)).toBe(esperado);
  });

  it('classificarTipo_quandoSemPalavraConhecida_deveRetornarAtividade', () => {
    expect(classificarTipo('Aula de reposição')).toBe('atividade');
    expect(classificarTipo('')).toBe('atividade');
  });

  it('classificarTipo_quandoPalavraApenasParteDeOutra_deveNaoCasar', () => {
    expect(classificarTipo('comprovante aprovado')).toBe('atividade');
    expect(classificarTipo('P0 e P10')).toBe('atividade');
  });

  it('classificarTipo_quandoVariosTipos_deveRespeitarPrioridadeProvaTrabalhoEntrega', () => {
    expect(classificarTipo('entrega do trabalho e prova')).toBe('prova');
    expect(classificarTipo('entrega do trabalho')).toBe('trabalho');
  });
});

describe('extrairData', () => {
  it('extrairData_quandoDataCompletaComAno4Digitos_deveRetornarISO', () => {
    expect(extrairData('Prova em 25/12/2026', REF)).toBe('2026-12-25');
  });

  it('extrairData_quandoAnoComDoisDigitos_deveSomar2000', () => {
    expect(extrairData('Prova em 25/12/27', REF)).toBe('2027-12-25');
  });

  it('extrairData_quandoAnoExplicitoPassado_deveManterAnoSemRolar', () => {
    expect(extrairData('01/01/2020', REF)).toBe('2020-01-01');
    expect(extrairData('01/11/26', REF)).toBe('2026-11-01');
  });

  it('extrairData_quandoSemAnoDepoisDaReferencia_deveUsarAnoDaReferencia', () => {
    expect(extrairData('Entrega 25/12', REF)).toBe('2026-12-25');
  });

  it('extrairData_quandoSemAnoAntesDaReferencia_deveRolarParaOProximoAno', () => {
    expect(extrairData('Entrega 02/11', REF)).toBe('2027-11-02');
    expect(extrairData('Entrega 01/01', REF)).toBe('2027-01-01');
  });

  it('extrairData_quandoSemAnoNoMesmoDiaDaReferencia_deveManterAnoAtual', () => {
    expect(extrairData('Hoje 03/11', REF)).toBe('2026-11-03');
    expect(extrairData('Hoje 03/11', new Date(2026, 10, 3, 23, 59))).toBe('2026-11-03');
  });

  it('extrairData_quandoSemAnoNoDiaSeguinteAReferencia_deveManterAnoAtual', () => {
    expect(extrairData('Amanhã 04/11', REF)).toBe('2026-11-04');
  });

  it('extrairData_quandoReferenciaEmDezembro_deveRolarParaOAnoSeguinte', () => {
    expect(extrairData('10/01', new Date(2026, 11, 20))).toBe('2027-01-10');
    expect(extrairData('15/12', new Date(2026, 11, 20))).toBe('2027-12-15');
  });

  it.each([['15-12-2026'], ['15.12.2026'], ['15/12/2026']])(
    'extrairData_quandoSeparadorEm"%s"_deveRetornar2026-12-15',
    (texto) => {
      expect(extrairData(texto, REF)).toBe('2026-12-15');
    },
  );

  it('extrairData_quandoDiaEMesComUmDigito_deveNormalizarComZeros', () => {
    expect(extrairData('5/3/2027', REF)).toBe('2027-03-05');
  });

  it('extrairData_quandoDiaInexistente31DeFevereiro_deveRetornarNull', () => {
    expect(extrairData('Prova em 31/02', REF)).toBeNull();
    expect(extrairData('Prova em 31/02/2027', REF)).toBeNull();
  });

  it('extrairData_quandoMesOuDiaForaDoIntervalo_deveRetornarNull', () => {
    expect(extrairData('10/13/2026', REF)).toBeNull();
    expect(extrairData('0/5/2026', REF)).toBeNull();
    expect(extrairData('10/0/2026', REF)).toBeNull();
    expect(extrairData('32/01/2027', REF)).toBeNull();
  });

  it('extrairData_quando29DeFevereiro_deveValidarAnoBissexto', () => {
    expect(extrairData('29/02/2028', REF)).toBe('2028-02-29');
    expect(extrairData('29/02/2027', REF)).toBeNull();
  });

  it('extrairData_quandoPrimeiraDataInvalida_deveUsarAProximaValida', () => {
    expect(extrairData('31/02 ou 15/12', REF)).toBe('2026-12-15');
  });

  it('extrairData_quandoVariasDatasValidas_deveUsarAPrimeira', () => {
    expect(extrairData('10/12/2026 e 20/12/2026', REF)).toBe('2026-12-10');
  });

  it('extrairData_quandoSemData_deveRetornarNull', () => {
    expect(extrairData('Sem data aqui', REF)).toBeNull();
    expect(extrairData('', REF)).toBeNull();
    expect(extrairData('Sala 12', REF)).toBeNull();
  });

  it('extrairData_quandoNumeroColadoEmOutroNumero_deveNaoCasarParcialmente', () => {
    expect(extrairData('protocolo 123/456', REF)).toBeNull();
  });

  it('extrairData_quandoDataISO_deveLerAnoMesDia', () => {
    expect(extrairData('Prova em 2026-11-03', REF)).toBe('2026-11-03');
    expect(extrairData('Entrega: 2027-1-5.', REF)).toBe('2027-01-05');
  });

  it('extrairData_quandoDataISOInvalida_deveRetornarNull', () => {
    expect(extrairData('2026-02-30', REF)).toBeNull();
    expect(extrairData('2026-13-01', REF)).toBeNull();
  });
});


describe('extrairData: formatos novos e falsos positivos', () => {
  it('extrairData_quandoNumeroDecimalOuIntervalo_deveIgnorar', () => {
    expect(extrairData('Sua nota foi 7.5', REF)).toBeNull();
    expect(extrairData('Leiam os capítulos 3-5', REF)).toBeNull();
    expect(extrairData('versão 1.2.3', REF)).toBeNull();
  });

  it('extrairData_quandoDataPorExtenso_deveLerDiaEMes', () => {
    expect(extrairData('Prova em 5 de dezembro', REF)).toBe('2026-12-05');
    expect(extrairData('Entrega 1º de dez. de 2027', REF)).toBe('2027-12-01');
    expect(extrairData('dia 10 de março', REF)).toBe('2027-03-10');
  });

  it('extrairData_quandoAbreviacaoSemDe_deveNaoConfundirComMes', () => {
    expect(extrairData('Faça o 2 set de exercícios', REF)).toBeNull();
  });

  it('extrairData_quandoSoDataRelativa_deveRetornarNull', () => {
    expect(extrairData('Prova amanhã', REF)).toBeNull();
  });
});

describe('textoDeHtml e limparCorpo', () => {
  it('textoDeHtml_deveTirarTagsEstilosEEntidadesMantendoQuebras', () => {
    const html = '<style>p{color:red}</style><p>Prova&nbsp;dia <b>05/12</b></p><div>Sala 3 &amp; 4</div>';
    expect(textoDeHtml(html).split('\n').map((l) => l.trim())).toEqual(['Prova dia  05/12', 'Sala 3 & 4', '']);
  });

  it('limparCorpo_deveCortarAMensagemCitadaDaResposta', () => {
    const corpo = 'A P2 será 10/12.\n\nEm qui., 20 de nov. de 2026 às 10:00, Fulano <f@x.com>\nescreveu:\n> P1 dia 01/12';
    expect(limparCorpo(corpo)).toBe('A P2 será 10/12.');
  });

  it('limparCorpo_deveTirarLinhasCitadasComMaiorQue', () => {
    expect(limparCorpo('Oi\r\n> antigo 01/12\r\nTchau')).toBe('Oi\nTchau');
  });
});

describe('LOCALIZACOES_PALAVRA', () => {
  it('deveOferecerEmQualquerLugarPrimeiroLigadoABuscaSemPrefixo', () => {
    expect(LOCALIZACOES_PALAVRA[0]).toEqual({ valor: 'corpo', rotulo: 'Em qualquer lugar' });
    expect(montarConsultaGmail([kw('prova', LOCALIZACOES_PALAVRA[0].valor)])).toBe('prova');
  });
});

describe('extrairEventosDoEmail', () => {
  const email = (parcial: Partial<EmailResumo> = {}): EmailResumo => ({
    id: 'abc123',
    assunto: 'Prova de Física dia 15/12',
    trecho: null,
    recebidoEm: REF,
    ...parcial,
  });

  it('quandoUmaData_deveMontarUmEventoComONomeDoAssunto', () => {
    expect(extrairEventosDoEmail(email())).toEqual([
      { nome: 'Prova de Física dia 15/12', tipo: 'prova', data: '2026-12-15', origemExternaId: 'gmail:abc123' },
    ]);
  });

  it('quandoIdOuAssuntoVazio_deveRetornarVazio', () => {
    expect(extrairEventosDoEmail(email({ id: '' }))).toEqual([]);
    expect(extrairEventosDoEmail(email({ assunto: ' \n\t ' }))).toEqual([]);
  });

  it('quandoAssuntoComEspacosEQuebras_deveNormalizarNome', () => {
    expect(extrairEventosDoEmail(email({ assunto: '  Prova   de\nFísica 15/12 ' }))[0].nome).toBe('Prova de Física 15/12');
  });

  it('quandoAssuntoLongo_deveTruncarEm120', () => {
    const nome = extrairEventosDoEmail(email({ assunto: `${'b'.repeat(130)} 15/12` }))[0].nome;
    expect(nome).toBe(`${'b'.repeat(117)}...`);
  });

  it('quandoSemData_deveRetornarVazio', () => {
    expect(extrairEventosDoEmail(email({ assunto: 'Reunião de turma' }))).toEqual([]);
  });

  it('quandoDataSoNoTrecho_deveUsarOTrecho', () => {
    const [r] = extrairEventosDoEmail(email({ assunto: 'Aviso importante', trecho: 'Entrega até 10/12' }));
    expect(r).toMatchObject({ data: '2026-12-10', tipo: 'entrega' });
  });

  it('quandoCorpoInteiroDisponivel_devePreferirOCorpoAoTrecho', () => {
    const [r] = extrairEventosDoEmail(
      email({ assunto: 'Aviso', trecho: 'Pessoal, segue o aviso…', corpo: `${'texto longo. '.repeat(40)}\nA prova será dia 09/12.` }),
    );
    expect(r).toMatchObject({ data: '2026-12-09', tipo: 'prova' });
  });

  it('quandoDataSemAno_deveUsarORecebimentoComoReferencia', () => {
    expect(extrairEventosDoEmail(email({ assunto: 'Prova 05/03', recebidoEm: new Date(2026, 5, 1) }))[0].data).toBe('2027-03-05');
    expect(extrairEventosDoEmail(email({ assunto: 'Prova 05/03', recebidoEm: new Date(2026, 0, 1) }))[0].data).toBe('2026-03-05');
  });

  it('quandoVariasProvasNaMesmaFrase_deveCriarUmItemPorData', () => {
    const r = extrairEventosDoEmail(email({ assunto: 'Calendário de Cálculo', corpo: 'A P1 será dia 05/12 e a P2 dia 19/12.' }));
    expect(r).toEqual([
      { nome: 'Calendário de Cálculo — P1', tipo: 'prova', data: '2026-12-05', origemExternaId: 'gmail:abc123:2026-12-05' },
      { nome: 'Calendário de Cálculo — P2', tipo: 'prova', data: '2026-12-19', origemExternaId: 'gmail:abc123:2026-12-19' },
    ]);
  });

  it('quandoPalavraDepoisDaData_deveLigarCadaDataASuaPalavra', () => {
    const r = extrairEventosDoEmail(email({ assunto: 'Datas', corpo: 'Datas: 05/12 (P1) e 19/12 (P2).' }));
    expect(r.map((e) => [e.data, e.nome])).toEqual([
      ['2026-12-05', 'Datas — P1'],
      ['2026-12-19', 'Datas — P2'],
    ]);
  });

  it('quandoTiposDiferentesEmFrasesDiferentes_deveClassificarCadaItem', () => {
    const r = extrairEventosDoEmail(
      email({ assunto: 'Redes: avisos', corpo: 'O relatório deve ser enviado até 28/11.\nA prova final será em 12 de dezembro.' }),
    );
    expect(r.map((e) => [e.data, e.tipo])).toEqual([
      ['2026-11-28', 'trabalho'],
      ['2026-12-12', 'prova'],
    ]);
  });

  it('quandoDataDeEnvioEPrazo_deveIgnorarADataSemEvento', () => {
    const r = extrairEventosDoEmail(email({ assunto: 'Aviso', corpo: 'Enviado em 03/11.\nA prova será dia 05/12.' }));
    expect(r).toEqual([{ nome: 'Aviso', tipo: 'prova', data: '2026-12-05', origemExternaId: 'gmail:abc123' }]);
  });

  it('quandoDataExplicitaJaPassou_deveDescartar', () => {
    const r = extrairEventosDoEmail(email({ assunto: 'Remarcação', corpo: 'A prova de 01/10/2026 foi remarcada para 20/11/2026.' }));
    expect(r.map((e) => e.data)).toEqual(['2026-11-20']);
  });

  it('quandoNotaDecimal_deveNaoVirarData', () => {
    expect(extrairEventosDoEmail(email({ assunto: 'Notas da P1', corpo: 'Sua nota foi 7.5' }))).toEqual([]);
  });

  it('quandoDataRelativaComEvento_deveCalcularPeloRecebimento', () => {
    // REF é terça, 03/11/2026.
    expect(extrairEventosDoEmail(email({ assunto: 'Lembrete', corpo: 'A prova é na sexta-feira.' }))[0].data).toBe('2026-11-06');
    expect(extrairEventosDoEmail(email({ assunto: 'Lembrete', corpo: 'Entrega amanhã!' }))[0].data).toBe('2026-11-04');
  });

  it('quandoDataRelativaSemEventoOuComDataExplicita_deveIgnorarARelativa', () => {
    expect(extrairEventosDoEmail(email({ assunto: 'Oi', corpo: 'Nos vemos na sexta-feira.' }))).toEqual([]);
    const r = extrairEventosDoEmail(email({ assunto: 'Aviso', corpo: 'A prova é sexta-feira, 13/11.' }));
    expect(r.map((e) => e.data)).toEqual(['2026-11-13']);
  });

  it('quandoMesmaDataRepetida_deveCriarSoUmItem', () => {
    const r = extrairEventosDoEmail(email({ assunto: 'Prova 05/12', corpo: 'Lembrando: prova dia 05/12.' }));
    expect(r).toHaveLength(1);
    expect(r[0].origemExternaId).toBe('gmail:abc123');
  });

  it('quandoRespostaCitaEmailAntigo_deveIgnorarAsDatasCitadas', () => {
    const r = extrairEventosDoEmail(
      email({ assunto: 'Re: Prova', corpo: 'Confirmado, P2 dia 10/12.\n\nEm seg., 2 de nov. de 2026, Prof escreveu:\n> P1 dia 01/12' }),
    );
    expect(r.map((e) => e.data)).toEqual(['2026-12-10']);
  });
});
