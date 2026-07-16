declare const require: (id: string) => any;
declare const __dirname: string;

const fs = require('fs') as { readFileSync(path: string, encoding: string): string };
const path = require('path') as { join(...parts: string[]): string };

const nativeRoot = path.join(
  __dirname,
  '../../modules/imediasave-download/android/src/main/java/com/imediasave/download',
);

function source(filename: string): string {
  return fs.readFileSync(path.join(nativeRoot, filename), 'utf8');
}

test('Android native module uses Expo 57 and AndroidX compile-safe APIs', () => {
  const moduleSource = source('DownloadModule.kt');
  const workerSource = source('DownloadWorker.kt');

  expect(moduleSource).toContain('import expo.modules.kotlin.functions.Coroutine');
  expect(moduleSource).toContain('AsyncFunction("list") Coroutine { ->');
  expect(moduleSource).toContain('AsyncFunction("listSharedPayloads") Coroutine { ->');
  expect(moduleSource).not.toMatch(/\b(?:info|it)\.inputData\b/);
  expect(moduleSource).toContain('DownloadPolicy.metadataFromTags');
  expect(workerSource).toContain('import android.content.pm.ServiceInfo');
  expect(workerSource).not.toContain('import android.app.ServiceInfo');
});

test('Expo config registers TypeScript plugin loading without executing it in Jest', () => {
  const configSource = fs.readFileSync(path.join(__dirname, '../../app.config.ts'), 'utf8');

  expect(configSource).toContain("import 'tsx/cjs'");
});
