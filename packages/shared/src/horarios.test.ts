import { describe, expect, it } from 'vitest';
import { conflitosDeHorario, descreverConflito, horariosSeSobrepoem, validarHorarios, type ItemComHorarios } from './horarios';

const h = (dia_semana: number, inicio: string, fim: string) => ({ dia_semana, inicio, fim });

describe('horariosSeSobrepoem', () => {
  it('quandoMesmoDiaEIntervalosSeCruzam_deveRetornarTrue', () => {
    expect(horariosSeSobrepoem(h(1, '19:00', '20:40'), h(1, '20:00', '21:00'))).toBe(true);
    expect(horariosSeSobrepoem(h(1, '19:00', '22:00'), h(1, '20:00', '21:00'))).toBe(true);
  });

  it('quandoApenasEncostamOuDiasDiferentes_deveRetornarFalse', () => {
    expect(horariosSeSobrepoem(h(1, '19:00', '20:00'), h(1, '20:00', '21:00'))).toBe(false);
    expect(horariosSeSobrepoem(h(1, '19:00', '20:00'), h(2, '19:00', '20:00'))).toBe(false);
  });
});

describe('validarHorarios', () => {
  it('quandoTudoValido_deveRetornarNull', () => {
    expect(validarHorarios([h(0, '08:00', '09:00'), h(6, '23:00', '23:59')])).toBeNull();
    expect(validarHorarios([])).toBeNull();
  });

  it('quandoHorarioInvalido_deveExplicarOProblema', () => {
    expect(validarHorarios([h(7, '08:00', '09:00')])).toMatch(/dia da semana/);
    expect(validarHorarios([h(1, '', '09:00')], 'aula')).toBe('Preencha o início e o fim de cada aula.');
    expect(validarHorarios([h(1, '8:00', '09:00')])).toMatch(/HH:MM/);
    expect(validarHorarios([h(1, '10:00', '09:00')], 'aula')).toBe('Em cada aula, o fim deve ser depois do início.');
    expect(validarHorarios([h(1, '10:00', '10:00')])).toMatch(/depois do início/);
  });
});

describe('conflitosDeHorario', () => {
  const calculo: ItemComHorarios = { id: 'd1', nome: 'Cálculo', tipo: 'disciplina', horarios: [h(1, '19:00', '20:40')] };
  const trabalho: ItemComHorarios = { id: 'r1', nome: 'Trabalho', tipo: 'rotina', horarios: [h(1, '08:00', '17:00'), h(2, '08:00', '17:00')] };

  it('quandoBateComOutraDisciplina_deveApontarQuemEOHorario', () => {
    const fisica: ItemComHorarios = { nome: 'Física', tipo: 'disciplina', horarios: [h(1, '20:00', '21:30')] };
    const conflitos = conflitosDeHorario(fisica, [calculo, trabalho]);
    expect(conflitos).toEqual([{ horario: h(1, '20:00', '21:30'), com: { id: 'd1', nome: 'Cálculo', tipo: 'disciplina' }, horarioCom: h(1, '19:00', '20:40'), proprio: false }]);
    expect(descreverConflito(conflitos[0])).toBe('Segunda-feira 20:00–21:30 bate com a aula de Cálculo (19:00–20:40)');
  });

  it('quandoBateComRotina_deveDescreverComoRotina', () => {
    const quimica: ItemComHorarios = { nome: 'Química', tipo: 'disciplina', horarios: [h(2, '16:00', '18:00')] };
    const [c] = conflitosDeHorario(quimica, [calculo, trabalho]);
    expect(descreverConflito(c)).toBe('Terça-feira 16:00–18:00 bate com Trabalho (rotina) (08:00–17:00)');
  });

  it('quandoEditandoOProprioItem_naoDeveConflitarConsigoMesmo', () => {
    expect(conflitosDeHorario({ ...calculo, horarios: [h(1, '19:30', '21:00')] }, [calculo, trabalho])).toEqual([]);
  });

  it('quandoMesmoIdMasTipoDiferente_deveConsiderarConflito', () => {
    const rotinaComMesmoId: ItemComHorarios = { id: 'd1', nome: 'Curso', tipo: 'rotina', horarios: [h(1, '19:00', '20:00')] };
    expect(conflitosDeHorario(rotinaComMesmoId, [calculo])).toHaveLength(1);
  });

  it('quandoDoisHorariosDoProprioItemSeSobrepoem_deveAcusar', () => {
    const item: ItemComHorarios = { nome: 'Inglês', tipo: 'rotina', horarios: [h(3, '18:00', '19:00'), h(3, '18:30', '19:30')] };
    const conflitos = conflitosDeHorario(item, []);
    expect(conflitos).toHaveLength(1);
    expect(conflitos[0].proprio).toBe(true);
    expect(descreverConflito(conflitos[0])).toMatch(/outro horário deste mesmo cadastro/);
  });

  it('quandoSemSobreposicao_deveRetornarListaVazia', () => {
    const item: ItemComHorarios = { nome: 'Academia', tipo: 'rotina', horarios: [h(1, '17:00', '19:00'), h(0, '08:00', '09:00')] };
    expect(conflitosDeHorario(item, [calculo, trabalho])).toEqual([]);
  });
});
