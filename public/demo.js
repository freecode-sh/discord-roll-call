const buttons = [...document.querySelectorAll('[data-command]')]
const activity = document.querySelector('#activity-list')
const empty = document.querySelector('#activity-empty')
const reply = document.querySelector('#reply')
const demo = document.querySelector('#run-demo')
const template = document.querySelector('#reply-template')
const reset = document.querySelector('#reset')
const key = document.querySelector('#signing-key')
const manageDiscord = document.querySelector('#manage-discord')
const setupError = document.querySelector('#discord-error')
const errorTitle = document.querySelector('#discord-error-title')
const errorDetails = document.querySelector('#discord-error-details')
const credentialLabels = {
  DISCORD_APP_ID: 'Application ID',
  DISCORD_BOT_TOKEN: 'Bot token',
  DISCORD_PUBLIC_KEY: 'Public key',
}
const credentialList = new Intl.ListFormat('en', { type: 'conjunction' })
const endpoint = document.querySelector('#endpoint')
const copy = document.querySelector('#copy-endpoint')
const copyStatus = document.querySelector('#copy-status')
const clock = new Intl.DateTimeFormat([], { hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' })
let running = false
let lastButton
let copyTimer

const host = location.hostname
const preview = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost') || host.endsWith('.freecode.build')
if (preview) {
  document.querySelector('#endpoint-description').textContent = 'Publish your site to get the HTTPS URL Discord can reach.'
  document.querySelector('#endpoint-description').hidden = false
  copy.hidden = true
} else {
  endpoint.textContent = new URL('/interactions', location.origin).href
}

async function readWorkerStatus() {
  try {
    const response = await fetch('/api/status', { signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error('Status request failed')
    const status = await response.json()
    if (status.worker !== 'online' || !Array.isArray(status.discordMissing)) throw new Error('Invalid status')
    const missing = status.discordMissing.map(name => credentialLabels[name]).filter(Boolean)
    key.textContent = missing.length ? 'Credentials missing' : 'Credentials saved'
    key.dataset.state = missing.length ? 'missing' : 'ready'
    manageDiscord.hidden = missing.length > 0
    if (missing.length) {
      errorDetails.textContent = `Add ${credentialList.format(missing)} in Freecode’s Project Secrets to use the bot in Discord.`
      setupError.hidden = false
    }
  } catch {
    key.textContent = 'Couldn’t check credentials'
    key.dataset.state = 'unavailable'
    manageDiscord.hidden = true
    errorTitle.textContent = 'Couldn’t check Discord credentials'
    errorDetails.textContent = 'Reload the dashboard to try again.'
    setupError.hidden = false
  }
}

function addRun(command, message, state) {
  const row = template.content.firstElementChild.cloneNode(true)
  const time = row.querySelector('time')
  const now = new Date()

  row.dataset.state = state
  time.dateTime = now.toISOString()
  time.textContent = clock.format(now)
  row.querySelector('code').textContent = `/${command}`
  row.querySelector('.discord-text').textContent = message
  activity.append(row)
  if (activity.children.length > 8) activity.firstElementChild.remove()
  empty.hidden = true
  activity.parentElement.scrollTop = activity.parentElement.scrollHeight
}

async function runCommand(command) {
  reply.textContent = `Running /${command}…`

  try {
    const response = await fetch(`/api/demo?command=${encodeURIComponent(command)}`, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error('Demo request failed')
    const { content } = await response.json()
    if (typeof content !== 'string') throw new Error('Invalid reply')
    addRun(command, content, 'success')
    reply.textContent = content
  } catch {
    const message = 'Couldn’t reach the Worker. Try again.'
    addRun(command, message, 'error')
    reply.textContent = message
  }
}

async function run(commands, button) {
  if (running) return
  lastButton = button
  running = true
  const controls = [...buttons, demo]
  controls.forEach(control => control.setAttribute('aria-disabled', 'true'))
  reset.disabled = true

  try {
    for (const command of commands) {
      for (const control of buttons)
        control.closest('.cmd-card').classList.toggle('is-active', control.dataset.command === command)
      await runCommand(command)
    }
  } finally {
    running = false
    controls.forEach(control => control.removeAttribute('aria-disabled'))
    reset.disabled = false
  }
}

for (const button of buttons)
  button.addEventListener('click', () => void run([button.dataset.command], button))

demo.addEventListener('click', () => void run(['ping', 'check-in'], demo))
reset.addEventListener('click', () => {
  activity.replaceChildren()
  empty.hidden = false
  reply.textContent = 'Replies cleared.'
  reset.disabled = true
  lastButton?.focus()
})

copy.addEventListener('click', async () => {
  clearTimeout(copyTimer)
  try {
    await navigator.clipboard.writeText(endpoint.textContent)
    copy.textContent = 'Copied'
    copyStatus.textContent = 'Interaction endpoint copied.'
    copyTimer = setTimeout(() => { copy.textContent = 'Copy endpoint'; copyStatus.textContent = '' }, 1600)
  } catch {
    const selection = getSelection()
    selection?.selectAllChildren(endpoint)
    copyStatus.textContent = 'Endpoint selected. Copy the selected text.'
  }
})

function showView() {
  const setup = location.hash === '#setup'
  document.querySelector('#setup').hidden = !setup
  document.querySelector('#console').hidden = setup
}

window.addEventListener('hashchange', showView)
showView()
void readWorkerStatus()
