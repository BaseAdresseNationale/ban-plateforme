import { spawnSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

describe('postal entry point', () => {
  it('imports all modules without configuration, listeners or service connections', () => {
    const cwd = import.meta.dirname
    const code = `
      import net from 'node:net'
      import { pathToFileURL } from 'node:url'
      net.Server.prototype.listen = () => { throw new Error('Unexpected listen') }
      net.Socket.prototype.connect = () => { throw new Error('Unexpected connection') }
      for (const file of ['app', 'auth', 'config', 'lookup', 'repository', 'reference-writer', 'reference-import', 'index']) {
        await import(pathToFileURL(process.cwd() + '/' + file + '.ts').href)
      }
      console.log('IMPORT_OK')
    `
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_OPTIONS: '' }
    for (const name of ['PG_URL', 'POSTAL_CODE_ADMIN_TOKEN', 'POSTAL_CODE_PORT']) delete env[name]
    const args = ['--import', 'tsx', '--input-type=module', '--eval', code]
    const run = spawnSync(process.execPath, args, {
      cwd, env, encoding: 'utf8', timeout: 10000,
    })
    expect(run.status, run.stderr).toBe(0)
    expect(run.stdout).toContain('IMPORT_OK')
  })
})
