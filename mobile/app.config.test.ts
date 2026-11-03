import { describe, expect, it } from 'vitest';
import buildConfig, { versionCodeFrom } from './app.config';

describe('app.config.ts - versionCodeFrom', () => {
  it('versionCodeFrom_quandoVersaoInicial_deveRetornar10000', () => {
    expect(versionCodeFrom('1.0.0')).toBe(10000);
  });

  it('versionCodeFrom_quandoMinorEPatch_deveSomarPosicoes', () => {
    expect(versionCodeFrom('2.3.4')).toBe(20304);
  });

  it('versionCodeFrom_quandoVersaoMaior_deveSerSempreCrescente', () => {
    expect(versionCodeFrom('1.10.0')).toBeGreaterThan(versionCodeFrom('1.9.99'));
    expect(versionCodeFrom('2.0.0')).toBeGreaterThan(versionCodeFrom('1.99.99'));
  });

  it('versionCodeFrom_quandoLimiteDe99_deveAceitar', () => {
    expect(versionCodeFrom('0.99.99')).toBe(9999);
  });

  it.each(['1.0', 'v1.0.0', '1.0.0-beta', 'abc', ''])(
    'versionCodeFrom_quandoFormatoInvalido_deveLancarErro (%s)',
    (versao) => {
      expect(() => versionCodeFrom(versao)).toThrow('use o formato X.Y.Z');
    },
  );

  it('versionCodeFrom_quandoMinorAcimaDe99_deveLancarErro', () => {
    expect(() => versionCodeFrom('1.100.0')).toThrow('no máximo 99');
  });

  it('versionCodeFrom_quandoPatchAcimaDe99_deveLancarErro', () => {
    expect(() => versionCodeFrom('1.0.100')).toThrow('no máximo 99');
  });

  it('versionCodeFrom_quandoZeroZeroZero_deveLancarErro', () => {
    expect(() => versionCodeFrom('0.0.0')).toThrow('maior que 0.0.0');
  });
});

describe('app.config.ts - configuração dinâmica', () => {
  const base = { name: 'Study Flow', slug: 'study-flow-mobile', version: '1.2.3', android: { package: 'com.studyflow.app' }, plugins: ['expo-router'] };

  it('config_quandoSemAppVersion_deveUsarVersaoDoAppJson', () => {
    delete process.env.APP_VERSION;
    const result = buildConfig({ config: base } as never);
    expect(result.version).toBe('1.2.3');
    expect(result.android?.versionCode).toBe(10203);
    expect(result.android?.package).toBe('com.studyflow.app');
  });

  it('config_quandoAppVersionDefinida_deveSobreporVersao', () => {
    process.env.APP_VERSION = '3.1.0';
    try {
      const result = buildConfig({ config: base } as never);
      expect(result.version).toBe('3.1.0');
      expect(result.android?.versionCode).toBe(30100);
    } finally {
      delete process.env.APP_VERSION;
    }
  });

  it('config_sempre_deveAdicionarPluginDeAssinaturaMantendoOsExistentes', () => {
    const result = buildConfig({ config: base } as never);
    expect(result.plugins).toEqual(['expo-router', './plugins/withReleaseSigning']);
  });
});
