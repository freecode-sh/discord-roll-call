export const commands = [
  { name: 'check-in', description: 'Say you’re here today.' },
  { name: 'ping', description: 'Check that The Worker is online.' },
]

const dateLabel = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })

export function commandReply(command, date = new Date()) {
  switch (command) {
    case 'check-in': return `✓ Check-in received for ${dateLabel.format(date)} (UTC).`
    case 'ping': return 'Pong! The Worker is online.'
    default: return null
  }
}
