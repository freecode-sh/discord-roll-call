import { commandReply } from './commands.js'
import { discordEndpoint } from './discord.js'
import { discordCredentialsReady } from './register.js'

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === '/interactions') return discordEndpoint(request, env, ctx)
    if (url.pathname === '/api/status') {
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } })
      return Response.json({
        worker: 'online',
        discordConfigured: discordCredentialsReady(env),
      }, { headers: { 'cache-control': 'no-store' } })
    }
    if (url.pathname === '/api/demo') {
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } })
      const content = commandReply(url.searchParams.get('command'))
      if (!content) return new Response('Unknown command', { status: 404 })
      return Response.json({ content }, { headers: { 'cache-control': 'no-store' } })
    }
    return env.ASSETS.fetch(request)
  },
}
