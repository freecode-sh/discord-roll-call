import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { test } from 'node:test'
import { commandReply } from '../src/commands.js'
import worker from '../src/index.js'

const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const DISCORD_PUBLIC_KEY = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex')
const endpoint = 'https://roll-call.test/interactions'
const env = { DISCORD_PUBLIC_KEY }

function signed(payload, { altered = false, age = 0 } = {}) {
  const timestamp = String(Math.floor(Date.now() / 1000) - age)
  const body = JSON.stringify(payload)
  const signature = sign(null, Buffer.from(timestamp + body), privateKey).toString('hex')
  return new Request(endpoint, {
    method: 'POST', body: altered ? body + ' ' : body,
    headers: { 'x-signature-timestamp': timestamp, 'x-signature-ed25519': signature },
  })
}

test('reports Worker and Discord configuration status without exposing the signing key', async () => {
  const url = 'https://roll-call.test/api/status'
  const configured = await worker.fetch(new Request(url), env)
  assert.equal(configured.status, 200)
  assert.equal(configured.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await configured.json(), { worker: 'online', discordConfigured: true })

  for (const missing of [{}, { DISCORD_PUBLIC_KEY: 'not-a-key' }]) {
    const response = await worker.fetch(new Request(url), missing)
    assert.deepEqual(await response.json(), { worker: 'online', discordConfigured: false })
  }

  const post = await worker.fetch(new Request(url, { method: 'POST' }), env)
  assert.equal(post.status, 405)
  assert.equal(post.headers.get('allow'), 'GET')
})

test('verifies PING signatures and rejects altered, stale, or oversized requests', async () => {
  const ping = { type: 1 }
  assert.deepEqual(await (await worker.fetch(signed(ping), env)).json(), ping)
  assert.equal((await worker.fetch(signed(ping, { altered: true }), env)).status, 401)
  assert.equal((await worker.fetch(signed(ping, { age: 301 }), env)).status, 401)
  assert.equal((await worker.fetch(signed({ type: 1, oversized: 'x'.repeat(32_768) }), env)).status, 401)
  assert.equal((await worker.fetch(new Request(endpoint), env)).status, 405)
  assert.equal((await worker.fetch(signed(ping), {})).status, 503)
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
