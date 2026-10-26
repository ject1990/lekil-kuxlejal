export interface Health {
  status: 'ok' | 'error'
  database: 'connected' | 'unavailable'
  mode: 'observation'
  control_enabled: false
  timestamp: string
}

export interface Zone {
  id: string
  name: string
  purpose: string
  description: string | null
  created_at: string
}

export interface Device {
  id: string
  name: string
  kind: 'esp32' | 'esp32-s3'
  model: string | null
  serial_port: string | null
  status: 'not_configured' | 'connected' | 'disconnected' | 'stale'
  created_at: string
  last_seen_at: string | null
  hardware_id: string | null
  firmware_version: string | null
  boot_id: string | null
  last_sequence: number | null
  uptime_ms: number | null
  last_heartbeat_at: string | null
  heartbeat_timeout_seconds: number
}

export interface Measurement {
  id: string
  source: 'real'
  zone_id: string
  device_id: string
  quantity: string
  unit: string
  value: number
  quality: 'valid' | 'invalid' | 'unverified'
  measured_at: string
  recorded_at: string
  observations: string | null
}

export interface Telemetry {
  items: Measurement[]
  total: number
  source: 'real'
  queried_at: string
}

export type ZoneInput = Pick<Zone, 'name' | 'purpose'> & { description?: string }
export type DeviceInput = Pick<Device, 'name'> & { model?: string; serial_port?: string }

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
    })
    if (!response.ok) {
      let detail = ''
      try {
        const body = await response.json()
        if (typeof body.detail === 'string') detail = body.detail
        else if (Array.isArray(body.detail)) {
          detail = body.detail.map((item: { msg?: string }) => item.msg || 'Campo inválido').join('. ')
        }
      } catch { /* Preserve the HTTP error if the server returns no JSON. */ }
      throw new Error(detail || `La API respondió con el código ${response.status}.`)
    }
    return await response.json() as T
  } catch (error) {
    if (error instanceof TypeError) throw new Error(import.meta.env.VITE_HOSTED === 'true'
      ? 'No se pudo conectar con la API. Comprueba tu conexión y vuelve a intentarlo.'
      : 'No se pudo conectar con la API local. Comprueba que el backend esté iniciado.')
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('La API no respondió en 10 segundos. Vuelve a intentarlo.')
    if (error instanceof SyntaxError) throw new Error('La API devolvió una respuesta que no se pudo interpretar.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export const api = {
  health: () => request<Health>('/health'),
  zones: async () => {
    const value = await request<Zone[]>('/zones')
    if (!Array.isArray(value)) throw new Error('La API no devolvió una lista válida de zonas.')
    return value
  },
  devices: async () => {
    const value = await request<Device[]>('/devices')
    if (!Array.isArray(value)) throw new Error('La API no devolvió una lista válida de dispositivos.')
    return value
  },
  telemetry: async () => {
    const value = await request<Telemetry>('/telemetry')
    if (!Array.isArray(value.items) || typeof value.total !== 'number' || value.source !== 'real') {
      throw new Error('La API no devolvió un resultado válido de telemetría real.')
    }
    return value
  },
  createZone: (value: ZoneInput) => request<Zone>('/zones', { method: 'POST', body: JSON.stringify(value) }),
  createDevice: (value: DeviceInput) => request<Device>('/devices', { method: 'POST', body: JSON.stringify(value) }),
}
