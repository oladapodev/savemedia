import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const viteConfig = readFileSync(
  new URL('../../vite.config.ts', import.meta.url),
  'utf8',
)
const dockerfile = readFileSync(
  new URL('../../Dockerfile', import.meta.url),
  'utf8',
)

test('the production build and container use the Node runtime', () => {
  expect(viteConfig).toMatch(
    /nitro\(\{\s*preset:\s*['"]node['"]\s*\}\)/,
  )
  expect(dockerfile).toContain('CMD ["node", ".output/server/index.mjs"]')
})
