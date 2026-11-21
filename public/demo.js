const buttons = [...document.querySelectorAll('[data-command]')]
const activity = document.querySelector('#activity-list')
const empty = document.querySelector('#activity-empty')
const reply = document.querySelector('#reply')
const reset = document.querySelector('#reset')
const worker = document.querySelector('#worker-status')
const key = document.querySelector('#signing-key')
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
  copy.hidden = true
} else {
  endpoint.textContent = new URL('/interactions', location.origin).href
}

async function readWorkerStatus() {
  try {
    const response = await fetch('/api/status', { signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error('Status request failed')
    const status = await response.json()
    if (status.worker !== 'online' || typeof status.discordConfigured !== 'boolean') throw new Error('Invalid status')
    worker.textContent = 'Worker online'
    worker.dataset.state = 'online'
    key.textContent = status.discordConfigured ? 'Credentials saved' : 'Discord setup needed'
    key.dataset.state = status.discordConfigured ? 'ready' : 'missing'
  } catch {
    worker.textContent = 'Worker unavailable'
    worker.dataset.state = 'unavailable'
    key.textContent = 'Couldn’t check Discord setup'
    key.dataset.state = 'unavailable'
  }
}

function addRun(command, message, state, elapsed) {
  const row = document.createElement('li')
  const timing = document.createElement('div')
  const time = document.createElement('time')
  const latency = document.createElement('span')
  const result = document.createElement('div')
  const label = document.createElement('code')
  const content = document.createElement('p')
  const now = new Date()

  row.dataset.state = state
  time.dateTime = now.toISOString()
  time.textContent = clock.format(now)
  latency.textContent = `${Math.round(elapsed)} ms`
  timing.append(time, latency)
  label.textContent = `/${command}`
  content.textContent = message
  result.append(label, content)
  row.append(timing, result)
  activity.prepend(row)
  if (activity.children.length > 8) activity.lastElementChild.remove()
  empty.hidden = true
  activity.hidden = false
}

for (const button of buttons) {
  button.addEventListener('click', async () => {
    if (running) return
    const command = button.dataset.command
    const start = performance.now()
    lastButton = button
    running = true
    buttons.forEach(control => control.setAttribute('aria-disabled', 'true'))
    reset.disabled = true
    if (!empty.hidden) empty.textContent = 'Waiting for the Worker…'
    reply.textContent = `Running /${command}`

    let state = 'success'
    let message
    try {
      const response = await fetch(`/api/demo?command=${encodeURIComponent(command)}`, { signal: AbortSignal.timeout(5000) })
      if (!response.ok) throw new Error('Demo request failed')
      const { content } = await response.json()
      if (typeof content !== 'string') throw new Error('Invalid reply')
      message = content
    } catch {
      state = 'error'
      message = 'Couldn’t reach the Worker. Try again.'
    } finally {
      addRun(command, message, state, performance.now() - start)
      reply.textContent = message
      running = false
      buttons.forEach(control => control.removeAttribute('aria-disabled'))
      reset.disabled = false
    }
  })
}

reset.addEventListener('click', () => {
  activity.replaceChildren()
  activity.hidden = true
  empty.textContent = 'Ready to run a command.'
  empty.hidden = false
  reply.textContent = 'Dispatch log cleared.'
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

function updateNavigation() {
  const setup = location.hash === '#setup'
  document.querySelector('#setup').hidden = !setup
  document.querySelector('#console').hidden = setup
  for (const link of document.querySelectorAll('[data-view]')) {
    const selected = link.dataset.view === (setup ? 'setup' : 'console')
    if (selected) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  }
}

addEventListener('hashchange', updateNavigation)
updateNavigation()
void readWorkerStatus()
