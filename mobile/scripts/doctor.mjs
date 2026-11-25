/**
 * Saúde do projeto mobile (npm run doctor:mobile, usado pelo verify, pelo pre-push e pelo CI).
 *
 * O expo-doctor compara as dependências com a lista de versões que a Expo publica na API
 * para o SDK. Quando sai um patch novo, essa lista muda e o CI quebrava em PRs que nem
 * mexiam no mobile. Por isso a checagem é dividida em três:
 *
 * 1. expo-doctor com todas as checagens, menos a de versão (bloqueia);
 * 2. `expo install --check` em modo offline: compara com expo/bundledNativeModules.json do
 *    expo instalado, que é fixado pelo package-lock. É determinística e continua pegando
 *    dependência incompatível com o SDK em uso (bloqueia);
 * 3. `expo install --check` online: só avisa que há patch novo do SDK, para alguém rodar
 *    `npx expo install --fix` num PR próprio (não bloqueia).
 */
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobile = dirname(dirname(fileURLToPath(import.meta.url)));
const emCI = Boolean(process.env.GITHUB_ACTIONS);

function rodar(titulo, comando, env = {}) {
  console.log(`\n▶ ${titulo}\n  $ ${comando}`);
  const r = spawnSync(comando, { cwd: mobile, stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
  return r.status === 0;
}

const doctor = rodar('expo-doctor (sem a checagem de versão, feita a seguir)', 'npx --yes expo-doctor', {
  EXPO_DOCTOR_SKIP_DEPENDENCY_VERSION_CHECK: '1',
});
const versoes = rodar('Dependências compatíveis com o SDK instalado (offline, pelo package-lock)', 'npx expo install --check', {
  EXPO_OFFLINE: '1',
});
const patches = rodar('Patches novos do SDK publicados pela Expo (só aviso)', 'npx expo install --check');

if (!patches) {
  const aviso = 'Há patches novos do SDK do Expo. Atualize num PR próprio com `cd mobile && npx expo install --fix`.';
  console.log(emCI ? `::warning title=SDK do Expo::${aviso}` : `\n⚠ ${aviso}`);
}

if (!doctor || !versoes) {
  console.error('\n✖ doctor:mobile falhou.');
  process.exit(1);
}
console.log('\n✔ doctor:mobile ok.');
