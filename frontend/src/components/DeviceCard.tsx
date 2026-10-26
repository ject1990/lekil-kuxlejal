import { Cpu } from 'lucide-react'
import type { Device } from '../api'
import { formatDate } from '../state'

function uptime(value: number | null) {
  if (value === null) return 'Sin comunicación recibida'
  const seconds = Math.floor(value / 1000)
  return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min ${seconds % 60} s`
}

export default function DeviceCard({ device }: { device: Device }) {
  const status = {
    not_configured: 'Sin configurar', connected: 'Conectado',
    disconnected: 'Desconectado', stale: device.last_heartbeat_at ? 'Comunicación caducada' : 'Esperando heartbeat',
  }[device.status]
  return <article className="serial-device-card">
    <div className="registration-item">
      <span className="registered-icon"><Cpu size={22} /></span>
      <div className="registered-content"><h3>{device.name}</h3><p>{device.kind.toUpperCase()} · {device.hardware_id || 'Identificación física pendiente'}</p></div>
      <span className={`status-pill ${device.status === 'connected' ? 'serial-connected' : 'neutral'}`}>{status}</span>
    </div>
    <dl className="serial-device-fields">
      <div><dt>Chip</dt><dd>{device.model || 'Pendiente de identificación'}</dd></div>
      <div><dt>Puerto</dt><dd>{device.serial_port?.startsWith('USB navegador ') ? 'USB de la computadora · navegador' : device.serial_port || 'No definido'}</dd></div>
      <div><dt>Última comunicación</dt><dd>{device.last_seen_at ? formatDate(device.last_seen_at) : 'Sin comunicación recibida'}</dd></div>
      <div><dt>Tiempo activo · último mensaje</dt><dd>{uptime(device.uptime_ms)}</dd></div>
      <div><dt>Versión de firmware</dt><dd>{device.firmware_version || 'No recibida'}</dd></div>
      <div><dt>Vigencia del heartbeat</dt><dd>{device.heartbeat_timeout_seconds} s</dd></div>
      <div><dt>Temperatura</dt><dd>Sin datos</dd></div>
      <div><dt>Humedad</dt><dd>Sin datos</dd></div>
    </dl>
    <p className="field-help">Sin sensores ambientales. El tiempo activo es un diagnóstico del chip, no una medición de temperatura.</p>
  </article>
}
