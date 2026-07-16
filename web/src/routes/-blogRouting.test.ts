import { expect, test } from 'bun:test'

test('the blog parent route renders its child article route', async () => {
  const source = await Bun.file(new URL('./blog.tsx', import.meta.url)).text()

  expect(source).toContain("import { Outlet, createFileRoute }")
  expect(source).toContain('<Outlet />')
})
