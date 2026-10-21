import { describe, it, expect } from 'vitest';
import { CreateDisciplinaInputSchema, DisciplinaOutputSchema } from './disciplina.schema';

const mensagens = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? [] : (r.error?.issues.map((i) => i.message) ?? []);

describe('disciplina.schema.ts - CreateDisciplinaInputSchema', () => {
  it('parse_quandoSomenteNome_deveAplicarTrimEDefaultDeAnotacoes', () => {
    const r = CreateDisciplinaInputSchema.safeParse({ nome: '  Calculo I  ' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.nome).toBe('Calculo I');
      expect(r.data.anotacoes).toEqual({});
    }
  });

  it('parse_quandoNomeAusente_deveRetornarMensagemDeObrigatorio', () => {
    const r = CreateDisciplinaInputSchema.safeParse({});
    expect(mensagens(r)).toContain('Nome da disciplina é obrigatório');
  });

  it('parse_quandoNomeCurtoDemais_deveRetornarMensagemDeMinimo', () => {
    const r = CreateDisciplinaInputSchema.safeParse({ nome: 'A' });
    expect(mensagens(r)).toEqual(['Nome deve ter no mínimo 2 caracteres']);
    expect(CreateDisciplinaInputSchema.safeParse({ nome: 'AB' }).success).toBe(true);
  });

  it('parse_quandoNomeLongoDemais_deveRetornarMensagemDeMaximo', () => {
    const r = CreateDisciplinaInputSchema.safeParse({ nome: 'a'.repeat(101) });
    expect(mensagens(r)).toEqual(['Nome deve ter no máximo 100 caracteres']);
    expect(CreateDisciplinaInputSchema.safeParse({ nome: 'a'.repeat(100) }).success).toBe(true);
  });

  it('parse_quandoProfessorTiverCemUmCaracteres_deveRejeitarComMensagem', () => {
    const r = CreateDisciplinaInputSchema.safeParse({ nome: 'Fisica', professor: 'p'.repeat(101) });
    expect(mensagens(r)).toEqual(['Nome do professor não pode exceder 100 caracteres']);
  });

  it('parse_quandoProfessorValidoNuloOuComEspacos_deveAceitarETrimar', () => {
    const ok = CreateDisciplinaInputSchema.parse({ nome: 'Fisica', professor: '  Ana  ' });
    expect(ok.professor).toBe('Ana');
    expect(CreateDisciplinaInputSchema.parse({ nome: 'Fisica', professor: 'p'.repeat(100) }).professor).toHaveLength(100);
    expect(CreateDisciplinaInputSchema.parse({ nome: 'Fisica', professor: null }).professor).toBeNull();
  });

  it('parse_quandoDatasEmFormatoBrasileiro_deveConverterParaIso', () => {
    const r = CreateDisciplinaInputSchema.parse({ nome: 'Fisica', data_inicio: '01/02/2026', data_fim: '2026-06-30' });
    expect(r.data_inicio).toBe('2026-02-01');
    expect(r.data_fim).toBe('2026-06-30');
  });

  it('parse_quandoDatasNulas_deveManterNulas', () => {
    const r = CreateDisciplinaInputSchema.parse({ nome: 'Fisica', data_inicio: null, data_fim: null });
    expect(r.data_inicio).toBeNull();
    expect(r.data_fim).toBeNull();
  });

  it('parse_quandoDataInicioInvalida_deveRetornarMensagemEspecifica', () => {
    const r = CreateDisciplinaInputSchema.safeParse({ nome: 'Fisica', data_inicio: '31/02/2026' });
    expect(mensagens(r)).toEqual(['Data de início deve ser uma data válida no formato DD/MM/AAAA ou AAAA-MM-DD']);
  });

  it('parse_quandoDataFimInvalida_deveRetornarMensagemEspecifica', () => {
    const r = CreateDisciplinaInputSchema.safeParse({ nome: 'Fisica', data_fim: 'ontem' });
    expect(mensagens(r)).toEqual(['Data de término deve ser uma data válida no formato DD/MM/AAAA ou AAAA-MM-DD']);
  });

  it('parse_quandoHouverCampoExtra_deveRejeitarPorSerStrict', () => {
    const r = CreateDisciplinaInputSchema.safeParse({ nome: 'Fisica', user_id: 'x' });
    expect(r.success).toBe(false);
  });

  it('parse_quandoAnotacoesInformadas_deveManterConteudo', () => {
    const r = CreateDisciplinaInputSchema.parse({ nome: 'Fisica', anotacoes: { a: 1 } });
    expect(r.anotacoes).toEqual({ a: 1 });
  });
});

describe('disciplina.schema.ts - DisciplinaOutputSchema', () => {
  const base = {
    id: '3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
    user_id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
    nome: 'Fisica',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  it('parse_quandoRegistroValido_deveAplicarDefaultDeAnotacoes', () => {
    const r = DisciplinaOutputSchema.parse(base);
    expect(r.anotacoes).toEqual({});
  });

  it('parse_quandoIdNaoForUuid_deveRejeitar', () => {
    expect(DisciplinaOutputSchema.safeParse({ ...base, id: '123' }).success).toBe(false);
    expect(DisciplinaOutputSchema.safeParse({ ...base, user_id: 'abc' }).success).toBe(false);
  });

  it('parse_quandoHouverChaveInterna_deveRejeitarPorSerStrict', () => {
    expect(DisciplinaOutputSchema.safeParse({ ...base, senha_hash: 'x' }).success).toBe(false);
  });

  it('parse_quandoCamposOpcionaisNulos_deveAceitar', () => {
    const r = DisciplinaOutputSchema.safeParse({ ...base, professor: null, data_inicio: null, data_fim: null });
    expect(r.success).toBe(true);
  });
});
