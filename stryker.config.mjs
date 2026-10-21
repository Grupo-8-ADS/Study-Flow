// Mutation testing com StrykerJS.
// Obs.: @stryker-mutator/vitest-runner@10.0.0 e incompativel com vitest 5 (o runner filtra testes por
// nome unindo a hierarquia com espaco, mas o vitest 5 une com " > ", entao todos os testes ficam "skipped"
// e todo mutante sobrevive). Por isso usamos o command runner, que roda `vitest run` por mutante.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'command',
  commandRunner: { command: 'npx vitest run --bail 1 --coverage.enabled=false' },
  coverageAnalysis: 'off',
  mutate: [
    'packages/shared/src/scheduler.ts',
    'packages/shared/src/validation.ts',
    'packages/shared/src/schemas/disciplina.schema.ts',
    'frontend/src/lib/studyflow-data.ts',
  ],
  reporters: ['clear-text', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  thresholds: { high: 80, low: 60, break: 50 },
  tempDirName: '.stryker-tmp',
  timeoutMS: 60000,
  cleanTempDir: true,
};
