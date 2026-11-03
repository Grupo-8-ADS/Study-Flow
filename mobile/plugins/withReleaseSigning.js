const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Config plugin: assina o build de release com a keystore do projeto.
 *
 * As credenciais vêm de variáveis de ambiente lidas pelo Gradle no momento do build
 * (STUDYFLOW_UPLOAD_STORE_FILE, _STORE_PASSWORD, _KEY_ALIAS, _KEY_PASSWORD).
 * Sem elas, o release cai na chave debug, o que mantém o build local funcionando.
 * O workflow de release falha antes disso se os secrets não existirem.
 */
const RELEASE_SIGNING = `
        release {
            if (System.getenv('STUDYFLOW_UPLOAD_STORE_FILE')) {
                storeFile file(System.getenv('STUDYFLOW_UPLOAD_STORE_FILE'))
                storePassword System.getenv('STUDYFLOW_UPLOAD_STORE_PASSWORD')
                keyAlias System.getenv('STUDYFLOW_UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('STUDYFLOW_UPLOAD_KEY_PASSWORD')
            }
        }`;

const RELEASE_BUILD_TYPE_SIGNING =
  "signingConfig System.getenv('STUDYFLOW_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug";

function applyReleaseSigning(gradle) {
  if (gradle.includes('STUDYFLOW_UPLOAD_STORE_FILE')) {
    return gradle;
  }

  const withSigningConfig = gradle.replace(/signingConfigs\s*\{/, (match) => match + RELEASE_SIGNING);
  if (withSigningConfig === gradle) {
    throw new Error('withReleaseSigning: bloco "signingConfigs" não encontrado no build.gradle');
  }

  const releaseBuildType = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!releaseBuildType.test(withSigningConfig)) {
    throw new Error('withReleaseSigning: buildType "release" não encontrado no build.gradle');
  }
  return withSigningConfig.replace(releaseBuildType, `$1${RELEASE_BUILD_TYPE_SIGNING}`);
}

const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      throw new Error('withReleaseSigning: só build.gradle em Groovy é suportado');
    }
    gradleConfig.modResults.contents = applyReleaseSigning(gradleConfig.modResults.contents);
    return gradleConfig;
  });

module.exports = withReleaseSigning;
module.exports.applyReleaseSigning = applyReleaseSigning;
