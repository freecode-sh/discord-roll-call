import { registerCommands } from '../src/register.js'

await registerCommands(process.env, process.env.DISCORD_TEST_GUILD_ID)
console.log('Registered /check-in and /ping.')
