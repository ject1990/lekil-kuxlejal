import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { CircleAlert, Info, Unplug, Usb } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useData } from '../state'
import { serialSupported, WebSerialConnection } from '../web-serial'

const Context = createContext<WebSerialConnection | null>(null)
const hosted = import.meta.env.VITE_HOSTED === 'true'

export function WebSerialProvider({ children }: { children: ReactNode }) {
  const controller = useRef<WebSerialConnection | null>(null)
  if (!controller.current) controller.current = new WebSerialConnection()
  useEffect(() => {
    const current = controller.current!
    const stop = () => { void current.disconnect() }
    window.addEventListener('pagehide', stop)
    return () => { window.removeEventListener('pagehide', stop); stop() }
  }, [])
  return <Context.Provider value={controller.current}>{children}</Context.Provider>
}

function useSerial() {
  const controller = useContext(Context)
  if (!controller) throw new Error('Conexión USB no disponible')
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  return { controller, state }
}

export function WebSerialNotice() {
  const { state } = useSerial()
  const { devices } = useData()
  const reload = devices.reload
  useEffect(() => { if (hosted && (state.saved || state.phase === 'idle')) void reload(true) }, [reload, state.saved, state.phase])
  if (!hosted || state.phase === 'idle') return null
  return <div className="usb-notice"><Usb size={17} /><span>{state.phase === 'reading' ? 'Lectura USB activa en esta pestaña' : 'Preparando o cerrando conexión USB'}</span><Link to="/configuracion">Ver conexión</Link></div>
}

export default function WebSerialPanel() {
  const { controller, state } = useSerial()
  const [now, setNow] = useState(performance.now())
  useEffect(() => {
    const interval = window.setInterval(() => setNow(performance.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])
  if (!hosted) return null
  const supported = serialSupported()
  const age = state.lastSaved === null ? null : Math.max(0, Math.floor((now - state.lastSaved) / 1000))
  return <section className="panel usb-panel" aria-labelledby="usb-title">
    <div className="usb-heading"><span className="registered-icon"><Usb size={25} /></span><div><div className="eyebrow">CONEXIÓN DIRECTA DESDE ESTA COMPUTADORA</div><h2 id="usb-title">Conectar mi ESP32</h2><p>Conecta la placa por USB y selecciona su puerto. La aplicación enviará sus mensajes al servidor.</p></div></div>
    <div className="usb-actions">
      <button className="button button-gold" disabled={!supported || state.phase !== 'idle'} onClick={() => void controller.connect()}><Usb size={17} />{state.phase === 'selecting' || state.phase === 'opening' ? 'Conectando…' : 'Conectar ESP32 por USB'}</button>
      {state.phase !== 'idle' && <button className="button button-outline" disabled={state.phase !== 'reading'} onClick={() => void controller.disconnect()}><Unplug size={17} />{state.phase === 'stopping' ? 'Desconectando…' : 'Desconectar'}</button>}
    </div>
    {!supported && <div className="form-error" role="status"><CircleAlert size={17} /><span>Este navegador no permite conectar el puerto serial. Abre esta página en Chrome o Edge de escritorio mediante HTTPS. Puedes seguir consultando los registros desde este dispositivo.</span></div>}
    <p className="usb-status" role="status">{state.message}</p>
    {state.error && <div className="form-error" role="alert"><CircleAlert size={17} /><span>{state.error}</span></div>}
    <dl className="serial-device-fields usb-facts">
      <div><dt>Placa identificada en esta conexión</dt><dd>{state.hardwareId || 'Esperando identificación'}</dd></div>
      <div><dt>Mensajes guardados en esta conexión</dt><dd>{state.saved}</dd></div>
      <div><dt>Última confirmación del servidor</dt><dd>{age === null ? 'Sin mensajes confirmados' : `Hace ${age} s${age > 10 ? ' · sin confirmación reciente' : ''}`}</dd></div>
    </dl>
    {state.skipped > 0 && <p className="field-help">{state.skipped} mensajes se descartaron por espera o saturación; no se guardaron como lecturas actuales.</p>}
    <p className="field-help"><Info size={17} />Mantén esta pestaña abierta y la computadora despierta. Cierra el monitor serial o el lector Python antes de conectar. Al recargar la página tendrás que pulsar Conectar de nuevo.</p>
    <p className="field-help">El firmware actual identifica la placa y confirma su actividad. Temperatura y humedad seguirán sin datos hasta integrar sensores y su lectura.</p>
  </section>
}
