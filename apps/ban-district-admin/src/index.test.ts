import { spawnSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

import { validateDatabaseUrl } from './index.js'

describe('district entry point', () => {
  it.each([undefined, '', 'http://example.invalid', 'postgresql://host'])
    ('rejects missing or invalid database destinations %#', value => {
      expect(() => validateDatabaseUrl(value)).toThrow('A valid PostgreSQL PG_URL is required')
    })

  it('validates PostgreSQL destinations without connecting or exposing credentials', () => {
    const destination = 'postgresql://fake:fake@postgres.invalid:1/unit'
    expect(() => validateDatabaseUrl(destination)).not.toThrow()
  })

  it('imports every module without environment, network, database or listener at import', () => {
    const code = `
      import net from 'node:net'
      import { pathToFileURL } from 'node:url'
      net.Server.prototype.listen = () => { throw new Error('Unexpected listener') }
      net.Socket.prototype.connect = () => { throw new Error('Unexpected connection') }
      globalThis.fetch = () => { throw new Error('Unexpected fetch') }
      for (const name of ['context', 'reference', 'repository', 'command', 'index']) {
        await import(pathToFileURL(process.cwd() + '/' + name + '.ts').href)
      }
      console.log('IMPORT_OK')
    `
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_OPTIONS: '' }
    delete env.PG_URL
    const result = spawnSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '--eval', code],
      { cwd: import.meta.dirname, env, encoding: 'utf8', timeout: 10000 })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('IMPORT_OK')
  })

  it('fails safely for invalid arguments before database access', () => {
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_OPTIONS: '' }
    delete env.PG_URL
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'index.ts', 'invalid'], {
      cwd: import.meta.dirname, env, encoding: 'utf8', timeout: 10000,
    })
    expect(result.status).toBe(1)
    expect(JSON.parse(result.stderr.trim())).toEqual({
      status: 'failed', reason: 'invalid-command-or-configuration',
    })
    expect(result.stdout).toBe('')
  })
})
