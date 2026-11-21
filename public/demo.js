const reply = document.querySelector('#reply-text')
const reset = document.querySelector('#reset')
const buttons = [...document.querySelectorAll('.command')]
let running = false

for (const button of buttons) {
  button.addEventListener('click', async () => {
    if (running) return
    running = true
    buttons.forEach(command => command.setAttribute('aria-disabled', 'true'))
    reset.hidden = true
    reply.textContent = 'Waiting for the Worker…'

    try {
      const response = await fetch(`/api/demo?command=${encodeURIComponent(button.id)}`, { signal: AbortSignal.timeout(5000) })
      if (!response.ok) throw new Error('Demo request failed')
      const { content } = await response.json()
      reply.textContent = content
    } catch {
      reply.textContent = 'The demo couldn’t reach the Worker. Try again.'
    } finally {
      running = false
      buttons.forEach(command => command.removeAttribute('aria-disabled'))
      reset.hidden = false
    }
  })
}

reset.addEventListener('click', () => {
  reply.textContent = 'Ready for your first check-in.'
  reset.hidden = true
  buttons[0].focus()
})
