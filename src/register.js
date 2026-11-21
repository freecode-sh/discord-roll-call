import { commands } from './commands.js'

export function missingDiscordCredentials(env) {
  const missing = []
  if (!/^\d{17,20}$/.test(env.DISCORD_APP_ID ?? '')) missing.push('DISCORD_APP_ID')
  if (!env.DISCORD_BOT_TOKEN?.trim()) missing.push('DISCORD_BOT_TOKEN')
  if (!/^[a-f0-9]{64}$/i.test(env.DISCORD_PUBLIC_KEY ?? '')) missing.push('DISCORD_PUBLIC_KEY')
  return missing
}

export function discordCredentialsReady(env) {
  return missingDiscordCredentials(env).length === 0
}

export async function registerCommands(env, guildId) {
  const { DISCORD_APP_ID, DISCORD_BOT_TOKEN } = env
  if (!/^\d{17,20}$/.test(DISCORD_APP_ID ?? '') || !DISCORD_BOT_TOKEN?.trim()) {
    throw new Error('Set DISCORD_APP_ID and DISCORD_BOT_TOKEN.')
  }
  if (guildId && !/^\d{17,20}$/.test(guildId)) throw new Error('DISCORD_TEST_GUILD_ID must be a Discord server ID.')

  const guild = guildId ? `/guilds/${guildId}` : ''
  const endpoint = `https://discord.com/api/v10/applications/${DISCORD_APP_ID}${guild}/commands`
  const signal = AbortSignal.timeout(10_000)

  for (const command of commands) {
    const body = guild ? command : { ...command, integration_types: [0], contexts: [0] }
    let response
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bot ${DISCORD_BOT_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'error',
        signal,
      })
    } catch {
      throw new Error(`Could not reach Discord while registering /${command.name}.`)
    }
    await response.body?.cancel()
    if (!response.ok) throw new Error(`Discord rejected /${command.name} (HTTP ${response.status}).`)
  }
}
