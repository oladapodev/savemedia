import { Sha256 } from './sha256';

function digest(chunks: readonly Uint8Array[]): string {
  const hash = new Sha256();
  for (const chunk of chunks) hash.update(chunk);
  return hash.hex();
}

test.each([
  [[], 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  [[new TextEncoder().encode('abc')], 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  [[new TextEncoder().encode('a'), new TextEncoder().encode('b'), new TextEncoder().encode('c')], 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
] as const)('computes incremental SHA-256 vector %#', (chunks, expected) => {
  expect(digest(chunks)).toBe(expected);
});
