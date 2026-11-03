import type { ConfigContext, ExpoConfig } from 'expo/config';

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Converte uma versão semântica em versionCode do Android (inteiro crescente).
 * Regra: MAJOR*10000 + MINOR*100 + PATCH, então MINOR e PATCH vão de 0 a 99.
 */
export function versionCodeFrom(version: string): number {
  const match = SEMVER.exec(version);
  if (!match) {
    throw new Error(`Versão inválida "${version}": use o formato X.Y.Z`);
  }
  const [major, minor, patch] = match.slice(1).map(Number);
  if (minor > 99 || patch > 99) {
    throw new Error(`Versão inválida "${version}": MINOR e PATCH devem ser no máximo 99`);
  }
  const code = major * 10000 + minor * 100 + patch;
  if (code < 1) {
    throw new Error(`Versão inválida "${version}": deve ser maior que 0.0.0`);
  }
  return code;
}

/**
 * Envolve o app.json: a versão vem de APP_VERSION (pipeline de release) ou do
 * próprio app.json, e o versionCode é sempre derivado dela.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const version = process.env.APP_VERSION || config.version || '1.0.0';

  return {
    ...config,
    name: config.name ?? 'Study Flow',
    slug: config.slug ?? 'study-flow-mobile',
    version,
    android: {
      ...config.android,
      versionCode: versionCodeFrom(version),
    },
    plugins: [...(config.plugins ?? []), './plugins/withReleaseSigning'],
  };
};
