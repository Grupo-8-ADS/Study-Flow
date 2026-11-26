import { describe, expect, it } from 'vitest';
import { AVATARES_POR_GALERIA, ESTILOS_AVATAR, novasSementes, urlAvatar } from './avatares';

describe('avatares gerados', () => {
  it('monta a URL do estilo com a semente escapada', () => {
    const url = urlAvatar('lorelei', 'a b/c');
    expect(url.startsWith('https://api.dicebear.com/9.x/lorelei/png?')).toBe(true);
    expect(url).toContain('seed=a%20b%2Fc');
  });

  it('gera sementes distintas e sem dados do usuário', () => {
    const sementes = novasSementes();
    expect(sementes).toHaveLength(AVATARES_POR_GALERIA);
    expect(new Set(sementes).size).toBe(AVATARES_POR_GALERIA);
    for (const s of sementes) expect(s).toMatch(/^[a-z0-9]{1,8}$/);
  });

  it('só oferece estilos de licença livre conhecidos', () => {
    expect(ESTILOS_AVATAR.map((e) => e.id)).toEqual(['notionists', 'lorelei', 'thumbs']);
  });
});
