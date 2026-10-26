import { SerialLines } from './serial-lines.mjs'

interface SerialPort {
  readable: ReadableStream<Uint8Array> | null
  open(options: { baudRate: number; bufferSize: number; flowControl: 'none' }): Promise<void>
  setSignals(signals: { dataTerminalReady: boolean; requestToSend: boolean }): Promise<void>
  close(): Promise<void>
}
interface SerialNavigator extends Navigator {
  serial?: { requestPort(): Promise<SerialPort> }
}
interface Session { connection_id: string; server_time: string }
interface Receipt { accepted: boolean; reason?: string; hardware_id?: string; message_type?: string }
export interface SerialState {
  phase: 'idle' | 'selecting' | 'opening' | 'reading' | 'stopping'
  message: string
  error: string | null
  lastSaved: number | null
  hardwareId: string | null
  saved: number
  skipped: number
}

class SerialApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/web-serial/${path}`, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Lekil-Serial': '1' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(7000),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = response.status === 401 ? 'Vuelve a iniciar sesión en la aplicación.'
      : response.status === 404 ? 'Actualiza el despliegue de Render para habilitar la conexión USB.'
      : typeof result.detail === 'string' ? result.detail : `El servidor respondió ${response.status}.`
    throw new SerialApiError(detail, response.status)
  }
  return result as T
}

export function serialSupported() {
  return window.isSecureContext && !!(navigator as SerialNavigator).serial
}

export class WebSerialConnection {
  private state: SerialState = { phase: 'idle', message: 'Conecta tu placa por USB para comenzar.', error: null, lastSaved: null, hardwareId: null, saved: 0, skipped: 0 }
  private listeners = new Set<() => void>()
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private session: Session | null = null
  private serverEpoch = 0
  private sessionAt = 0
  private pending: { line: string; received: number } | null = null
  private sending: Promise<void> | null = null
  private reading: Promise<void> | null = null
  private stopped = false
  private timer = 0
  private finishKind: 'disconnected' | 'reader_stopped' = 'reader_stopped'
  private finishMessage = 'Lectura USB detenida.'
  private openAt = 0

  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(patch: Partial<SerialState>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
  private timestamp(received = performance.now()) {
    return new Date(this.serverEpoch + received - this.sessionAt).toISOString()
  }
  private envelope(kind: string, received = performance.now()) {
    return { connection_id: this.session?.connection_id, event_id: crypto.randomUUID().replaceAll('-', ''), kind, received_at: this.timestamp(received) }
  }

  connect = async () => {
    if (this.state.phase !== 'idle') return
    if (!serialSupported()) {
      this.update({ error: 'Abre esta página HTTPS en Chrome o Edge de escritorio para conectar el USB.' })
      return
    }
    this.stopped = false
    this.finishKind = 'reader_stopped'
    this.finishMessage = 'Lectura USB detenida.'
    this.update({ phase: 'selecting', message: 'Selecciona el puerto de tu ESP32.', error: null, lastSaved: null, hardwareId: null, saved: 0, skipped: 0 })
    let opened = false
    let readingStarted = false
    try {
      // Must happen directly in the click handler, before any network await.
      this.port = await (navigator as SerialNavigator).serial!.requestPort()
      if (this.stopped) return
      this.update({ phase: 'opening', message: 'Preparando la conexión con el servidor…' })
      const session = await post<Session>('session', {})
      if (!/^[a-f0-9]{32}$/.test(session.connection_id) || !Number.isFinite(Date.parse(session.server_time))) throw new Error('Respuesta de conexión inválida.')
      this.session = session
      this.serverEpoch = Date.parse(session.server_time)
      this.sessionAt = performance.now()
      if (this.stopped) return
      await this.port.open({ baudRate: 115200, bufferSize: 4096, flowControl: 'none' })
      opened = true
      // DTR/RTS inactive, as in the existing Python reader. No command bytes.
      await this.port.setSignals({ dataTerminalReady: false, requestToSend: false }).catch(() => {})
      if (!this.port.readable) throw new Error('El puerto no permite lectura. Comprueba el cable USB.')
      this.reader = this.port.readable.getReader()
      this.openAt = performance.now()
      this.update({ phase: 'reading', message: 'USB abierto. Esperando un mensaje válido del ESP32…' })
      this.reading = this.readLoop()
      readingStarted = true
      return
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === 'NotFoundError'
      this.update({ error: cancelled ? null : error instanceof SerialApiError ? error.message
        : 'No se pudo abrir la placa. Usa un cable de datos y cierra el monitor serial, Arduino y el lector Python si ocupan el puerto.',
        message: cancelled ? 'Selección cancelada. Puedes volver a conectar.' : 'La conexión USB no se inició.' })
    } finally {
      if (!readingStarted) {
        if (opened) await this.port?.close().catch(() => {})
        await this.closeSession()
        this.port = null
        this.update({ phase: 'idle' })
      }
    }
  }

  private async readLoop() {
    const lines = new SerialLines((line, received) => {
      if (this.stopped) return
      if (this.pending) this.update({ skipped: this.state.skipped + 1 })
      this.pending = { line, received }
      this.startSending()
    }, error => this.update({ error }))
    this.timer = window.setInterval(() => {
      lines.expire(performance.now())
      if (this.state.lastSaved === null && performance.now() - this.openAt > 12000 && !this.state.error) {
        this.update({ message: 'USB abierto, pero aún no hay mensajes confirmados. Comprueba que la placa tenga el firmware del proyecto.' })
      }
    }, 1000)
    try {
      while (!this.stopped) {
        const { value, done } = await this.reader!.read()
        if (done) {
          if (!this.stopped) {
            this.finishKind = 'disconnected'
            this.finishMessage = 'La placa dejó de enviar por USB. Revisa el cable y vuelve a conectar.'
          }
          break
        }
        if (value) lines.push(value, performance.now())
      }
    } catch {
      if (!this.stopped) {
        this.finishKind = 'disconnected'
        this.finishMessage = 'Se perdió la conexión USB. Revisa el cable y vuelve a conectar.'
      }
    } finally {
      this.stopped = true
      this.pending = null
      window.clearInterval(this.timer)
      this.update({ phase: 'stopping' })
      this.reader?.releaseLock()
      this.reader = null
      await this.port?.close().catch(() => {})
      await this.sending
      await this.closeSession()
      this.port = null
      this.reading = null
      this.update({ phase: 'idle', message: this.finishMessage })
    }
  }

  private startSending() {
    if (this.sending) return
    this.sending = this.sendPending().finally(() => {
      this.sending = null
      if (this.pending && !this.stopped) this.startSending()
    })
  }

  private async sendPending() {
    while (this.pending && !this.stopped) {
      const item = this.pending
      this.pending = null
      // Keep at most one pending line, never replay an offline backlog as live.
      if (performance.now() - item.received > 5000) {
        this.update({ skipped: this.state.skipped + 1, error: 'Se descartó un mensaje atrasado. Comprueba internet.' })
        continue
      }
      try {
        const result = await post<Receipt>('events', { ...this.envelope('message', item.received), line: item.line })
        if (result.accepted === true) {
          this.update({ saved: this.state.saved + 1, lastSaved: performance.now(), hardwareId: result.hardware_id || null,
            error: null, message: result.message_type === 'heartbeat' ? 'Mensaje de actividad guardado en el servidor.' : 'Placa identificada. Esperando su señal de actividad…' })
        } else if (result.accepted === false) {
          this.update({ error: result.reason === 'duplicate' ? 'Mensaje repetido: no se registró de nuevo.' : 'Mensaje atrasado o fuera de secuencia: no se confirmó como conexión actual.' })
        } else throw new Error('Confirmación inválida.')
      } catch (error) {
        this.update({ error: error instanceof SerialApiError ? error.message : 'USB abierto, pero el servidor no confirmó el mensaje. Comprueba internet.' })
        if (error instanceof SerialApiError && [401, 403, 404, 409].includes(error.status)) {
          this.finishMessage = 'Vuelve a conectar cuando hayas resuelto el aviso.'
          this.stopped = true
          void this.reader?.cancel().catch(() => {})
        }
      }
    }
  }

  private async closeSession() {
    if (!this.session) return
    try { await post('events', this.envelope(this.finishKind)) }
    catch { this.update({ error: 'No se pudo confirmar el cierre en el servidor. La comunicación caducará al dejar de recibir mensajes.' }) }
    this.session = null
  }

  disconnect = async () => {
    this.stopped = true
    this.pending = null
    if (this.reader) {
      this.update({ phase: 'stopping' })
      await this.reader.cancel().catch(() => {})
    }
    await this.reading
  }
}
