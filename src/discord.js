import { commandReply } from './commands.js'
import { discordCredentialsReady, registerCommands } from './register.js'

const encoder = new TextEncoder()
const bodyLimit = 32_768

function fromHex(value) {
  return Uint8Array.from(value.match(/../g), byte => Number.parseInt(byte, 16))
}

async function readBody(request) {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const buffer = new Uint8Array(bodyLimit)
  let length = 0

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length))
      if (length + value.length > bodyLimit) {
        await reader.cancel()
        return null
      }
      buffer.set(value, length)
      length += value.length
    }
  } finally {
    reader.releaseLock()
  }
}

async function signedInteraction(request, publicKey) {
  const timestamp = request.headers.get('x-signature-timestamp') ?? ''
  const signature = request.headers.get('x-signature-ed25519') ?? ''
  if (!/^\d{1,12}$/.test(timestamp) || !/^[a-f0-9]{128}$/i.test(signature)) return null
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return null

  try {
    const body = await readBody(request)
    if (body === null) return null
    const key = await crypto.subtle.importKey('raw', fromHex(publicKey), 'Ed25519', false, ['verify'])
    if (!await crypto.subtle.verify('Ed25519', key, fromHex(signature), encoder.encode(timestamp + body))) return null
    const interaction = JSON.parse(body)
    return interaction && typeof interaction === 'object' && !Array.isArray(interaction) ? interaction : null
  } catch {
    return null
  }
}

export async function discordEndpoint(request, env, ctx) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } })
  if (!discordCredentialsReady(env)) return new Response('Discord setup is required', { status: 503 })
  const interaction = await signedInteraction(request, env.DISCORD_PUBLIC_KEY)
  if (!interaction) return new Response('Invalid interaction signature or body', { status: 401 })
  if (interaction.application_id !== undefined && interaction.application_id !== env.DISCORD_APP_ID) {
    return new Response('Interaction belongs to another application', { status: 401 })
  }

  if (interaction.type === 1) {
    // Discord sends a signed PING when saving the endpoint. Reply promptly and
    // upsert our commands in the background without overwriting other commands.
    ctx.waitUntil(registerCommands(env).catch(error => {
      console.error('Discord Bot Starter command registration failed:', error.message)
    }))
    return Response.json({ type: 1 })
  }
  if (interaction.type !== 2) return new Response('Unsupported interaction', { status: 400 })

  const content = commandReply(interaction.data?.name) ?? 'Unknown command.'
  return Response.json({ type: 4, data: { content, flags: 64, allowed_mentions: { parse: [] } } })
}
