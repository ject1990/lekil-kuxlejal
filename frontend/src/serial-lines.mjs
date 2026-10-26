// Framing only. The server validates JSON, duplicate keys, integers and identity.
// Never parse and re-serialize chip counters in JavaScript (loss of precision).
export class SerialLines {
  constructor(onLine, onError) {
    this.onLine = onLine
    this.onError = onError
    this.buffer = new Uint8Array(2048)
    this.length = 0
    this.startedAt = 0
    this.discarding = false
    this.decoder = new TextDecoder('utf-8', { fatal: true })
  }

  expire(now) {
    if (this.length && now - this.startedAt > 2000) {
      this.length = 0
      this.discarding = true
      this.onError('Mensaje USB incompleto; esperando la siguiente línea.')
    }
  }

  push(bytes, now) {
    this.expire(now)
    for (const byte of bytes) {
      if (this.discarding) {
        if (byte === 10) this.discarding = false
        continue
      }
      if (!this.length) this.startedAt = now
      this.buffer[this.length++] = byte
      if (byte === 10) {
        try {
          const line = this.decoder.decode(this.buffer.subarray(0, this.length))
          if (line.trim()) this.onLine(line, now)
        } catch {
          this.onError('Se recibió texto USB ilegible. Comprueba el firmware y la velocidad 115200.')
        }
        this.length = 0
      } else if (this.length === this.buffer.length) {
        this.length = 0
        this.discarding = true
        this.onError('Mensaje USB demasiado grande; se descartó sin guardarlo.')
      }
    }
  }
}
