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
    expect(molduraPorId('ouro')?.nivel).toBe(10);
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
});
