#!/usr/bin/env node
// Lança uma nova versão do app mobile:
//   npm run release:mobile -- 1.1.0
// Atualiza a versão em mobile/package.json e mobile/app.json, faz o commit,
// cria a tag mobile-vX.Y.Z e envia tudo. O push da tag dispara o
// workflow "Mobile Release (APK)", que gera o APK assinado e a GitHub Release.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const fail = (message) => {
  console.error(`✖ ${message}`);
  process.exit(1);
};

const version = process.argv[2];
const semver = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
if (!semver) fail('Informe a versão no formato X.Y.Z, por exemplo: npm run release:mobile -- 1.1.0');
if (Number(semver[2]) > 99 || Number(semver[3]) > 99) fail('MINOR e PATCH devem ser no máximo 99 (regra do versionCode).');

const tag = `mobile-v${version}`;
if (git('status', '--porcelain')) fail('Há alterações não commitadas. Faça commit ou stash antes de lançar.');
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') fail('Lance versões a partir da branch main.');
if (git('tag', '--list', tag)) fail(`A tag ${tag} já existe.`);

const updateJson = (relativePath, update) => {
  const file = path.join(root, relativePath);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  update(json);
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
};

updateJson('mobile/package.json', (pkg) => {
  pkg.version = version;
});
updateJson('mobile/app.json', (app) => {
  app.expo.version = version;
});

git('add', 'mobile/package.json', 'mobile/app.json');
git('commit', '-m', `chore(mobile): release v${version}`);
git('tag', '-a', tag, '-m', `Study Flow mobile v${version}`);
git('push', 'origin', 'HEAD', tag);

console.log(`✔ ${tag} enviada. Acompanhe o build em: gh run watch`);
