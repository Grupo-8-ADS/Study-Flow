import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applyReleaseSigning } = require('./withReleaseSigning') as {
  applyReleaseSigning: (gradle: string) => string;
};

// Trecho do android/app/build.gradle gerado pelo `expo prebuild` (SDK 57).
const GRADLE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}`;

describe('withReleaseSigning - applyReleaseSigning', () => {
  it('applyReleaseSigning_quandoGradlePadrao_deveCriarSigningConfigRelease', () => {
    const result = applyReleaseSigning(GRADLE);
    expect(result).toContain("storeFile file(System.getenv('STUDYFLOW_UPLOAD_STORE_FILE'))");
    expect(result).toContain("keyAlias System.getenv('STUDYFLOW_UPLOAD_KEY_ALIAS')");
  });

  it('applyReleaseSigning_quandoGradlePadrao_deveTrocarSoAAssinaturaDoRelease', () => {
    const result = applyReleaseSigning(GRADLE);
    const releaseBlock = result.slice(result.indexOf('buildTypes'));
    expect(releaseBlock).toContain(
      "signingConfig System.getenv('STUDYFLOW_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
    // O buildType debug continua assinado com a chave debug.
    expect(releaseBlock.match(/^\s*signingConfig signingConfigs\.debug$/gm)).toHaveLength(1);
  });

  it('applyReleaseSigning_quandoJaAplicado_deveSerIdempotente', () => {
    const once = applyReleaseSigning(GRADLE);
    expect(applyReleaseSigning(once)).toBe(once);
  });

  it('applyReleaseSigning_quandoSemSigningConfigs_deveLancarErro', () => {
    expect(() => applyReleaseSigning('android { buildTypes { release { } } }')).toThrow('signingConfigs');
  });

  it('applyReleaseSigning_quandoSemBuildTypeRelease_deveLancarErro', () => {
    const semRelease = GRADLE.replace(/release \{\s*signingConfig signingConfigs\.debug/, 'release {');
    expect(() => applyReleaseSigning(semRelease)).toThrow('buildType "release"');
  });
});
