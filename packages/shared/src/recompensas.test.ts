import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BANNERS,
  MOLDURAS,
  bannerPreset,
  desbloqueado,
  equiparRecompensa,
  gradienteCss,
  molduraPorId,
  proximaRecompensa,
  resumoColecao,
  textoProximaRecompensa,
  valorBanner,
} from './recompensas';
import { perfilFalso } from './testing/perfil-falso';

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

describe('progresso da coleção', () => {
  it('proximaRecompensa pega o item de menor nível ainda bloqueado e o XP que falta', () => {
    // Nível 1 com 50 XP: o próximo é o banner "Raposa no outono" (nível 2 = 100 XP).
    expect(proximaRecompensa(1, 50)).toMatchObject({ tipo: 'banner', item: { id: 'raposa-outono' }, faltamXp: 50 });
    expect(textoProximaRecompensa(1, 50)).toBe('Faltam 50 XP para liberar o banner Raposa no outono (nível 2).');
    expect(textoProximaRecompensa(2, 100)).toMatch(/a moldura Bronze \(nível 3\)/);
  });

  it('com tudo liberado não há próxima recompensa', () => {
    expect(proximaRecompensa(99, 1_000_000)).toBeNull();
    expect(textoProximaRecompensa(99, 0)).toBe('Você liberou todas as molduras e banners.');
  });

  it('resumoColecao soma conquistas, molduras e banners', () => {
    const r = resumoColecao(3, { feitos: 1, total: 4 });
    expect(r.molduras).toEqual({ feitos: 1, total: MOLDURAS.length });
    expect(r.banners).toEqual({ feitos: 3, total: BANNERS.length });
    expect(r.feitos).toBe(5);
    expect(r.total).toBe(4 + MOLDURAS.length + BANNERS.length);
    expect(r.percentual).toBe(Math.round((5 / r.total) * 100));
    expect(resumoColecao(1, { feitos: 0, total: 0 }).percentual).toBeGreaterThanOrEqual(0);
  });
});

describe('equiparRecompensa', () => {
  it('grava o campo e devolve null', async () => {
    const { client, updates } = perfilFalso({ moldura: null });
    expect(await equiparRecompensa(client, 'u1', 'banner_url', valorBanner({ id: 'oceano' }))).toBeNull();
    expect(updates).toEqual([{ banner_url: 'preset:oceano' }]);
  });

  it('traduz o bloqueio de nível do trigger e outros erros', async () => {
    expect(await equiparRecompensa(perfilFalso({}, { update: { code: '42501', message: 'x' } }).client, 'u1', 'moldura', 'ouro')).toBe(
      'Esse item ainda está bloqueado para o seu nível.',
    );
    expect(await equiparRecompensa(perfilFalso({}, { update: { message: 'rede' } }).client, 'u1', 'moldura', null)).toMatch(/Não foi possível/);
  });
});
