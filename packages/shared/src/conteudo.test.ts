import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FAQ, REGRAS_XP, TERMOS_SERVICO, XP_MAXIMO_POR_SESSAO, contaDemonstracao } from './conteudo';
import { PRIVACIDADE_PADRAO } from './privacidade';
import { xpParaNivel } from './gamificacao';

const migration = (nome: string) => readFileSync(resolve(__dirname, '../../../supabase/migrations', nome), 'utf8');

describe('conteúdo compartilhado', () => {
  it('contaDemonstracao reconhece o e-mail ou o usuário de teste', () => {
    expect(contaDemonstracao({ email: ' Teste@Teste.com ' })).toBe(true);
    expect(contaDemonstracao({ email: 'a@b.com', username: 'TESTE' })).toBe(true);
    expect(contaDemonstracao({ email: 'a@b.com', username: 'ana' })).toBe(false);
    expect(contaDemonstracao(null)).toBe(false);
  });

  it('regras de XP batem com a curva de nível e o limite do banco', () => {
    expect(REGRAS_XP[2]).toContain(`${xpParaNivel(2)} para o nível 2`);
    expect(REGRAS_XP[2]).toContain(`${xpParaNivel(3) - xpParaNivel(2)} para o 3`);
    expect(migration('20261103000500_protecao_gamificacao.sql')).toContain(`, 0), ${XP_MAXIMO_POR_SESSAO})`);
  });

  it('FAQ e termos sem itens vazios', () => {
    expect(FAQ.length).toBeGreaterThan(3);
    for (const f of FAQ) expect(f.pergunta && f.resposta).toBeTruthy();
    expect(TERMOS_SERVICO.secoes.every((s) => s.titulo && s.texto)).toBe(true);
  });

  it('chaves de privacidade iguais às aceitas pela constraint do banco', () => {
    const sql = migration('20261126000100_privacidade_perfil.sql');
    const lista = /privacidade - array\[([^\]]+)\]/.exec(sql)![1];
    const chaves = [...lista.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(chaves).toEqual(Object.keys(PRIVACIDADE_PADRAO).sort());
  });
});
