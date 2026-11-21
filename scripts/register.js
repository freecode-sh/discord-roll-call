import { commands } from '../src/commands.js'

const { DISCORD_APP_ID, DISCORD_BOT_TOKEN, DISCORD_TEST_GUILD_ID } = process.env
if (!/^\d{17,20}$/.test(DISCORD_APP_ID ?? '') || !DISCORD_BOT_TOKEN) {
  throw new Error('Set DISCORD_APP_ID and DISCORD_BOT_TOKEN in .env.register.')
}
if (DISCORD_TEST_GUILD_ID && !/^\d{17,20}$/.test(DISCORD_TEST_GUILD_ID)) {
  throw new Error('DISCORD_TEST_GUILD_ID must be a Discord server ID.')
}
const guild = DISCORD_TEST_GUILD_ID ? `/guilds/${DISCORD_TEST_GUILD_ID}` : ''
const endpoint = `https://discord.com/api/v10/applications/${DISCORD_APP_ID}${guild}/commands`

for (const command of commands) {
  const body = guild ? command : { ...command, integration_types: [0], contexts: [0] }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bot ${DISCORD_BOT_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Discord rejected /${command.name} (HTTP ${response.status}).`)
  console.log(`Registered /${command.name}.`)
}
