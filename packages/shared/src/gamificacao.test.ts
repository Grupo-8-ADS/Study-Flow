import { describe, it, expect } from 'vitest';
import {
  XP_POR_NIVEL,
  nivelPorXp,
  progressoNivel,
  progressoConquista,
  textoCompartilhamento,
  type EstatisticasConquista,
} from './gamificacao';
import * as g from './gamificacao';

const stats = (parcial: Partial<EstatisticasConquista> = {}): EstatisticasConquista => ({
  sessoesConcluidas: 0,
  minutosEstudados: 0,
  sessoesPorDisciplina: {},
  ...parcial,
});

describe('nivelPorXp', () => {
  it('xpPorNivel_quandoConsultado_deveSer100', () => {
    expect(XP_POR_NIVEL).toBe(100);
  });

  it('nivelPorXp_quandoXpZero_deveRetornarNivel1', () => {
    expect(nivelPorXp(0)).toBe(1);
  });

  it('nivelPorXp_quandoXp99_deveContinuarNoNivel1', () => {
    expect(nivelPorXp(99)).toBe(1);
  });

  it('nivelPorXp_quandoXp100_deveSubirParaNivel2', () => {
    expect(nivelPorXp(100)).toBe(2);
  });

  it('nivelPorXp_quandoXp199e200_deveRespeitarFronteiraDoNivel', () => {
    expect(nivelPorXp(199)).toBe(2);
    expect(nivelPorXp(200)).toBe(3);
    expect(nivelPorXp(950)).toBe(10);
  });

  it('nivelPorXp_quandoXpFracionario_deveTruncarAntesDeCalcular', () => {
    expect(nivelPorXp(99.9)).toBe(1);
    expect(nivelPorXp(100.5)).toBe(2);
  });

  it('nivelPorXp_quandoXpNegativo_deveRetornarNivel1', () => {
    expect(nivelPorXp(-50)).toBe(1);
  });

  it('nivelPorXp_quandoXpNaoFinito_deveRetornarNivel1', () => {
    expect(nivelPorXp(Number.NaN)).toBe(1);
    expect(nivelPorXp(Number.POSITIVE_INFINITY)).toBe(1);
    expect(nivelPorXp(Number.NEGATIVE_INFINITY)).toBe(1);
  });
});

describe('progressoNivel', () => {
  it('progressoNivel_quandoXpZero_deveFaltar100ParaOProximo', () => {
    expect(progressoNivel(0)).toEqual({ nivel: 1, xpNoNivel: 0, faltam: 100, progresso: 0 });
  });

  it('progressoNivel_quandoXp99_deveFaltarUmParaSubir', () => {
    expect(progressoNivel(99)).toEqual({ nivel: 1, xpNoNivel: 99, faltam: 1, progresso: 0.99 });
  });

  it('progressoNivel_quandoXp100_deveZerarProgressoNoNivel2', () => {
    expect(progressoNivel(100)).toEqual({ nivel: 2, xpNoNivel: 0, faltam: 100, progresso: 0 });
  });

  it('progressoNivel_quandoXp250_deveCalcularMetadeDoNivel3', () => {
    expect(progressoNivel(250)).toEqual({ nivel: 3, xpNoNivel: 50, faltam: 50, progresso: 0.5 });
  });

  it('progressoNivel_quandoXpFracionario_deveTruncar', () => {
    const p = progressoNivel(130.9);
    expect(p.nivel).toBe(2);
    expect(p.xpNoNivel).toBe(30);
    expect(p.faltam).toBe(70);
  });

  it('progressoNivel_quandoXpInvalido_deveTratarComoZero', () => {
    const esperado = { nivel: 1, xpNoNivel: 0, faltam: 100, progresso: 0 };
    expect(progressoNivel(-10)).toEqual(esperado);
    expect(progressoNivel(Number.NaN)).toEqual(esperado);
    expect(progressoNivel(Number.POSITIVE_INFINITY)).toEqual(esperado);
  });
});

describe('progressoConquista', () => {
  it('progressoConquista_quandoCriterioNulo_deveUsarAlvo1ESemProgresso', () => {
    const esperado = { atual: 0, alvo: 1, percentual: 0, concluida: false };
    expect(progressoConquista(null, stats({ sessoesConcluidas: 5 }))).toEqual(esperado);
    expect(progressoConquista(undefined, stats({ sessoesConcluidas: 5 }))).toEqual(esperado);
  });

  it('progressoConquista_quandoSessionsCompleted_deveUsarSessoesConcluidas', () => {
    // Arrange
    const criterio = { type: 'sessions_completed', target: 10 };
    // Act
    const r = progressoConquista(criterio, stats({ sessoesConcluidas: 3, minutosEstudados: 999 }));
    // Assert
    expect(r).toEqual({ atual: 3, alvo: 10, percentual: 30, concluida: false });
  });

  it('progressoConquista_quandoStudyMinutes_deveUsarMinutosEstudados', () => {
    const r = progressoConquista(
      { type: 'study_minutes', target: 600 },
      stats({ sessoesConcluidas: 99, minutosEstudados: 150 }),
    );
    expect(r).toEqual({ atual: 150, alvo: 600, percentual: 25, concluida: false });
  });

  it('progressoConquista_quandoAtualIgualAoAlvo_deveEstarConcluidaCom100', () => {
    const r = progressoConquista({ type: 'sessions_completed', target: 5 }, stats({ sessoesConcluidas: 5 }));
    expect(r).toEqual({ atual: 5, alvo: 5, percentual: 100, concluida: true });
  });

  it('progressoConquista_quandoAtualUmAbaixoDoAlvo_deveNaoConcluir', () => {
    const r = progressoConquista({ type: 'sessions_completed', target: 5 }, stats({ sessoesConcluidas: 4 }));
    expect(r.concluida).toBe(false);
    expect(r.percentual).toBe(80);
  });

  it('progressoConquista_quandoAtualExcedeAlvo_devePercentualLimitadoA100', () => {
    const r = progressoConquista({ type: 'study_minutes', target: 100 }, stats({ minutosEstudados: 450 }));
    expect(r).toEqual({ atual: 450, alvo: 100, percentual: 100, concluida: true });
  });

  it('progressoConquista_quandoPercentualFracionario_deveArredondarParaBaixo', () => {
    const um = progressoConquista({ type: 'sessions_completed', target: 3 }, stats({ sessoesConcluidas: 1 }));
    const dois = progressoConquista({ type: 'sessions_completed', target: 3 }, stats({ sessoesConcluidas: 2 }));
    expect(um.percentual).toBe(33);
    expect(dois.percentual).toBe(66);
  });

  it('progressoConquista_quandoSubjectProgress_deveSomarDisciplinaIgnorandoCaixaEEspacos', () => {
    // Arrange
    const s = stats({
      sessoesPorDisciplina: { 'Cálculo': 2, ' cálculo ': 3, Física: 10 },
    });
    // Act
    const r = progressoConquista({ type: 'subject_progress', target: 10, subject: '  CÁLCULO ' }, s);
    // Assert
    expect(r).toEqual({ atual: 5, alvo: 10, percentual: 50, concluida: false });
  });

  it('progressoConquista_quandoSubjectProgressSemSubject_deveIgnorarDisciplinasComNome', () => {
    const r = progressoConquista(
      { type: 'subject_progress', target: 2 },
      stats({ sessoesPorDisciplina: { Física: 4 } }),
    );
    expect(r.atual).toBe(0);
    expect(r.concluida).toBe(false);
  });

  it('progressoConquista_quandoSubjectProgressSemDisciplinaCadastrada_deveRetornarZero', () => {
    const r = progressoConquista({ type: 'subject_progress', target: 2, subject: 'Química' }, stats());
    expect(r.atual).toBe(0);
  });

  it('progressoConquista_quandoTipoDesconhecido_deveTerAtualZero', () => {
    const r = progressoConquista(
      { type: 'outro', target: 3 },
      stats({ sessoesConcluidas: 9, minutosEstudados: 9 }),
    );
    expect(r).toEqual({ atual: 0, alvo: 3, percentual: 0, concluida: false });
  });

  it('progressoConquista_quandoTipoAusente_deveTerAtualZero', () => {
    const r = progressoConquista({ target: 3 }, stats({ sessoesConcluidas: 9 }));
    expect(r.atual).toBe(0);
  });

  it('progressoConquista_quandoAlvoAusente_deveUsarAlvo1', () => {
    const r = progressoConquista({ type: 'sessions_completed' }, stats({ sessoesConcluidas: 1 }));
    expect(r).toEqual({ atual: 1, alvo: 1, percentual: 100, concluida: true });
  });

  it('progressoConquista_quandoAlvoZeroNegativoOuInvalido_deveUsarAlvo1', () => {
    const s = stats({ sessoesConcluidas: 0 });
    expect(progressoConquista({ type: 'sessions_completed', target: 0 }, s).alvo).toBe(1);
    expect(progressoConquista({ type: 'sessions_completed', target: -4 }, s).alvo).toBe(1);
    expect(progressoConquista({ type: 'sessions_completed', target: Number.NaN }, s).alvo).toBe(1);
    expect(progressoConquista({ type: 'sessions_completed', target: 0.5 }, s).alvo).toBe(1);
  });

  it('progressoConquista_quandoAlvoFracionario_deveTruncar', () => {
    const r = progressoConquista({ type: 'sessions_completed', target: 2.9 }, stats());
    expect(r.alvo).toBe(2);
  });

  it('progressoConquista_quandoEstatisticaNegativa_deveLimitarAtualEmZero', () => {
    const r = progressoConquista({ type: 'sessions_completed', target: 5 }, stats({ sessoesConcluidas: -3 }));
    expect(r).toEqual({ atual: 0, alvo: 5, percentual: 0, concluida: false });
  });
});

describe('textoCompartilhamento', () => {
  it('textoCompartilhamento_quandoHorasInteirasETopico_deveMontarTextoCompleto', () => {
    const t = textoCompartilhamento({ nivel: 4, periodo: 'Semana', horas: 5, topico: 'Cálculo' });
    expect(t).toBe(
      'Estou no nível 4 no Study Flow e estudei 5 h (semana). Minha disciplina mais estudada foi Cálculo.',
    );
  });

  it('textoCompartilhamento_quandoTopicoNulo_deveOmitirDisciplina', () => {
    const t = textoCompartilhamento({ nivel: 1, periodo: 'Mês', horas: 2, topico: null });
    expect(t).toBe('Estou no nível 1 no Study Flow e estudei 2 h (mês).');
  });

  it('textoCompartilhamento_quandoTopicoVazio_deveOmitirDisciplina', () => {
    const t = textoCompartilhamento({ nivel: 1, periodo: 'Mês', horas: 2, topico: '' });
    expect(t).not.toContain('disciplina');
  });

  it('textoCompartilhamento_quandoHorasFracionarias_deveUsarUmaCasaComVirgula', () => {
    expect(textoCompartilhamento({ nivel: 2, periodo: 'Semana', horas: 2.5, topico: null })).toContain(
      'estudei 2,5 h',
    );
    expect(textoCompartilhamento({ nivel: 2, periodo: 'Semana', horas: 1.04, topico: null })).toContain(
      'estudei 1,0 h',
    );
  });

  it('textoCompartilhamento_quandoHorasNegativas_deveTratarComoZero', () => {
    expect(textoCompartilhamento({ nivel: 2, periodo: 'Semana', horas: -3, topico: null })).toContain(
      'estudei 0 h',
    );
  });

  it('textoCompartilhamento_quandoPeriodoComEspacosEMaiusculas_deveNormalizar', () => {
    const t = textoCompartilhamento({ nivel: 2, periodo: '  ACUMULADO ', horas: 1, topico: null });
    expect(t).toContain('(acumulado)');
  });
});

describe('conquistas dinâmicas', () => {
  const s = (parcial: Partial<EstatisticasConquista> = {}): EstatisticasConquista => ({
    sessoesConcluidas: 0,
    minutosEstudados: 0,
    sessoesPorDisciplina: {},
    ...parcial,
  });

  it('top_subject_sessions usa a disciplina mais estudada e o nome troca o marcador', () => {
    const stats = s({ sessoesPorDisciplina: { Cálculo: 3, Física: 7 } });
    expect(g.progressoConquista({ type: 'top_subject_sessions', target: 5 }, stats).concluida).toBe(true);
    expect(g.nomeConquista('Especialista em {disciplina}', null, stats)).toBe('Especialista em Física');
    expect(g.nomeConquista('Especialista em {disciplina}', 'História', stats)).toBe('Especialista em História');
    expect(g.nomeConquista('Especialista em {disciplina}', null)).toBe('Especialista em sua disciplina');
    expect(g.nomeConquista('Foco inicial', null, stats)).toBe('Foco inicial');
  });

  it('unique_subjects conta disciplinas com sessão e streak usa diasSeguidos', () => {
    const stats = s({ sessoesPorDisciplina: { A: 1, B: 2, C: 0 }, diasSeguidos: 4 });
    expect(g.progressoConquista({ type: 'unique_subjects', target: 3 }, stats).atual).toBe(2);
    expect(g.progressoConquista({ type: 'streak', target: 5 }, stats).atual).toBe(4);
  });

  it('diasSeguidos conta a sequência que termina no dia mais recente', () => {
    expect(g.diasSeguidos([])).toBe(0);
    expect(g.diasSeguidos(['2026-11-01', '2026-11-03', '2026-11-04', '2026-11-04', '2026-11-05'])).toBe(3);
    expect(g.diasSeguidos(['2026-10-31', '2026-11-01'])).toBe(2);
  });
});
