/** Lightweight Web Audio beeps — no external assets. */

let ctx: AudioContext | null = null

function getCtx() {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

function beep(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.08) {
  const c = getCtx()
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.value = gain
  o.connect(g)
  g.connect(c.destination)
  o.start()
  setTimeout(() => {
    o.stop()
    o.disconnect()
    g.disconnect()
  }, duration)
}

export function playDiceRoll() {
  for (let i = 0; i < 6; i++) {
    setTimeout(() => beep(180 + i * 40, 60, 'square', 0.05), i * 45)
  }
}

export function playMoney() {
  beep(520, 90, 'triangle', 0.07)
  setTimeout(() => beep(720, 120, 'triangle', 0.06), 80)
}

export function playNotify() {
  beep(880, 100, 'sine', 0.06)
}
