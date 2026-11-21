import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { test } from 'node:test'
import { commandReply } from '../src/commands.js'
import worker from '../src/index.js'

const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const DISCORD_PUBLIC_KEY = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex')
const endpoint = 'https://roll-call.test/interactions'
const env = { DISCORD_APP_ID: '123456789012345678', DISCORD_BOT_TOKEN: 'fixture-token', DISCORD_PUBLIC_KEY }

function signed(payload, { altered = false, age = 0 } = {}) {
  const timestamp = String(Math.floor(Date.now() / 1000) - age)
  const body = JSON.stringify(payload)
  const signature = sign(null, Buffer.from(timestamp + body), privateKey).toString('hex')
  return new Request(endpoint, {
    method: 'POST', body: altered ? body + ' ' : body,
    headers: { 'x-signature-timestamp': timestamp, 'x-signature-ed25519': signature },
  })
}

test('reports Worker and Discord configuration status without returning any Discord configuration values', async () => {
  const url = 'https://roll-call.test/api/status'
  const configured = await worker.fetch(new Request(url), env)
  assert.equal(configured.status, 200)
  assert.equal(configured.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await configured.json(), { worker: 'online', discordConfigured: true, discordMissing: [] })

  for (const [credentials, expectedMissing] of [
    [{}, Object.keys(env)],
    [{ ...env, DISCORD_APP_ID: '123' }, ['DISCORD_APP_ID']],
    [{ ...env, DISCORD_BOT_TOKEN: '' }, ['DISCORD_BOT_TOKEN']],
    [{ ...env, DISCORD_PUBLIC_KEY: 'not-a-key' }, ['DISCORD_PUBLIC_KEY']],
  ]) {
    const response = await worker.fetch(new Request(url), credentials)
    assert.deepEqual(await response.json(), { worker: 'online', discordConfigured: false, discordMissing: expectedMissing })
  }

  const post = await worker.fetch(new Request(url, { method: 'POST' }), env)
  assert.equal(post.status, 405)
  assert.equal(post.headers.get('allow'), 'GET')
})

test('only a valid Discord PING can register commands', async t => {
  const calls = []
  const tasks = []
  const ctx = { waitUntil: promise => tasks.push(promise) }
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, method: init.method, authorization: init.headers.authorization, body: JSON.parse(init.body) })
    return new Response(null, { status: 201 })
  })

  const ping = { type: 1 }
  assert.equal((await worker.fetch(signed({ ...ping, application_id: '999999999999999999' }), env, ctx)).status, 401)
  assert.equal((await worker.fetch(signed(ping, { altered: true }), env)).status, 401)
  assert.equal((await worker.fetch(signed(ping, { age: 301 }), env)).status, 401)
  assert.equal((await worker.fetch(signed({ type: 1, oversized: 'x'.repeat(32_768) }), env)).status, 401)
  assert.equal((await worker.fetch(new Request(endpoint), env)).status, 405)
  for (const binding of Object.keys(env)) {
    assert.equal((await worker.fetch(signed(ping), { ...env, [binding]: undefined }, ctx)).status, 503)
  }
  assert.equal(tasks.length, 0)
  assert.equal(calls.length, 0)

  assert.deepEqual(await (await worker.fetch(signed(ping), env, ctx)).json(), ping)
  assert.equal(tasks.length, 1)
  await tasks[0]
  assert.deepEqual(calls.map(call => call.body.name), ['check-in', 'ping'])
  for (const call of calls) {
    assert.equal(call.url, `https://discord.com/api/v10/applications/${env.DISCORD_APP_ID}/commands`)
    assert.equal(call.method, 'POST')
    assert.equal(call.authorization, `Bot ${env.DISCORD_BOT_TOKEN}`)
    assert.deepEqual(call.body.contexts, [0])
  }
})

test('answers both signed commands privately and shares the response with the website demo', async () => {
  for (const name of ['check-in', 'ping']) {
    const interaction = await (await worker.fetch(signed({ type: 2, data: { name } }), env)).json()
    const demo = await worker.fetch(new Request(`https://roll-call.test/api/demo?command=${name}`), {})
    assert.equal(demo.status, 200)
    assert.equal(demo.headers.get('cache-control'), 'no-store')
    assert.deepEqual(interaction, { type: 4, data: { ...await demo.json(), flags: 64, allowed_mentions: { parse: [] } } })
  }
  assert.equal((await worker.fetch(new Request('https://roll-call.test/api/demo?command=unknown'), {})).status, 404)
  assert.equal(commandReply('check-in', new Date('2026-11-20T00:30:00Z')), '✓ Check-in received for November 20 (UTC).')
})

test('responds to a signed PING even when Discord rejects registration and logs only the status', async t => {
  const tasks = []
  const logs = []
  t.mock.method(globalThis, 'fetch', async () => new Response('private upstream details', { status: 401 }))
  t.mock.method(console, 'error', (...args) => logs.push(args.join(' ')))
  const response = await worker.fetch(signed({ type: 1, application_id: env.DISCORD_APP_ID }), env, {
    waitUntil: promise => tasks.push(promise),
  })

  assert.deepEqual(await response.json(), { type: 1 })
  assert.equal(tasks.length, 1)
  await tasks[0]
  assert.match(logs[0], /Discord rejected .*HTTP 401/)
  assert.doesNotMatch(logs[0], /fixture-token|private upstream details/)
})
