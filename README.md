# Roll Call for Discord

Roll Call is a tiny starter for building Discord bots on Workers. `/check-in` acknowledges a daily check-in. `/ping` confirms the bot is online. Both replies are visible only to the person running the command. The same Worker serves a dashboard for testing commands and setting up Discord.

![Roll Call command console showing two successful replies](docs/art/console.webp)

Roll Call receives signed HTTP interactions from Discord. It uses Web Crypto and has no Gateway process, privileged intents, or database dependency. Check-ins are acknowledged immediately and no check-in history is stored.

## Try the site locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
npm test
npm run build
```

The site and command demo work without a Discord app. `npm run build` checks the production bundle with a Wrangler dry run.

## Deploy your bot

1. Create a Discord app in the [Developer Portal](https://discord.com/developers/applications). In **Installation**, enable **Guild Install** with the `applications.commands` scope. Use its install link to add the app to a server you administer.
2. Copy the **Public Key** from the app’s **General Information**. In Freecode, save it as `DISCORD_PUBLIC_KEY` for both environments in the setup card, then select **Publish** or **Update site**. For a first deploy with Wrangler, copy `.dev.vars.example` to `.dev.vars`, paste the key after `DISCORD_PUBLIC_KEY=`, and run `npm run deploy -- --secrets-file .dev.vars`.
3. Set **Interactions Endpoint URL** to `https://<your-site>/interactions`. Discord will send a signed PING to verify the URL.
4. Copy `discord-register.env.example` to `.env.register`, fill in your app ID and bot token locally, then run `npm run register`. Set `DISCORD_TEST_GUILD_ID` to register the commands immediately in a test server.
5. Run `/ping` and `/check-in` in the Discord server.

## Make it yours

The command responses live in `src/commands.js`. A useful next step is to add persistent check-ins and a daily count per server. Keep that history isolated by server and make repeated check-ins on the same day idempotent.

MIT licensed.
