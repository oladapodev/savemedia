import path from 'node:path'
import { createBuilder } from '@content-collections/core'

const config = path.resolve(process.cwd(), 'content-collections.ts')
const builder = await createBuilder(config)

await builder.build()
