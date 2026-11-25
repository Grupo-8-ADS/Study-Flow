import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BANNERS, MOLDURAS, bannerPreset, desbloqueado, gradienteCss, molduraPorId } from './recompensas';

describe('recompensas', () => {
  it('lê banners prontos e ignora imagens', () => {
    expect(bannerPreset('preset:oceano')?.nome).toBe('Oceano');
    expect(bannerPreset('preset:inexistente')).toBeNull();
    expect(bannerPreset('data:image/jpeg;base64,xx')).toBeNull();
    expect(bannerPreset(null)).toBeNull();
  });

  it('libera por nível e acha molduras pelo id', () => {
    expect(desbloqueado({ nivel: 6 }, 5)).toBe(false);
    expect(desbloqueado({ nivel: 6 }, 6)).toBe(true);
    expect(molduraPorId('ouro')?.nivel).toBe(8);
    expect(molduraPorId(null)).toBeNull();
  });

  it('catálogo em ordem crescente de nível e ids únicos', () => {
    for (const lista of [MOLDURAS, BANNERS]) {
      const niveis = lista.map((i) => i.nivel);
      expect([...niveis].sort((a, b) => a - b)).toEqual(niveis);
      expect(new Set(lista.map((i) => i.id)).size).toBe(lista.length);
    }
    expect(gradienteCss(['#000', '#fff'])).toBe('linear-gradient(135deg, #000, #fff)');
  });

  it('níveis mínimos iguais aos validados no banco (migration de recompensas)', () => {
    const sql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261125000200_curva_nivel_e_recompensas.sql'), 'utf8');
    const niveisDe = (funcao: string) => {
      const corpo = sql.slice(sql.indexOf(funcao), sql.indexOf('end;', sql.indexOf(funcao)));
      return Object.fromEntries([...corpo.matchAll(/when '([^']+)' then (\d+)/g)].map((m) => [m[1], Number(m[2])]));
    };
    expect(niveisDe('nivel_minimo_moldura')).toEqual(Object.fromEntries(MOLDURAS.map((m) => [m.id, m.nivel])));
    expect(niveisDe('nivel_minimo_banner')).toEqual(Object.fromEntries(BANNERS.map((b) => [b.id, b.nivel])));
  });

  it('arte da moldura encaixa o aro no avatar', () => {
    const arte = molduraPorId('formatura')!.arte!;
    // O aro (diâmetro 1) começa em -x e cabe dentro da imagem (largura = escala).
    expect(arte.x).toBeLessThan(0);
    expect(-arte.x + 1).toBeLessThanOrEqual(arte.escala);
    expect(bannerPreset('preset:raposa-outono')?.imagem).toBe('banner-raposa-outono.webp');
  });
});
