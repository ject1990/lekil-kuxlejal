import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Check, CircleAlert, Cpu, Info, Plus, Save, Sprout, X } from 'lucide-react'
import { api } from '../api'
import { formatDate, useData } from '../state'
import { PageHeading, ResourceState } from '../components/Shared'
import DeviceCard from '../components/DeviceCard'
import WebSerialPanel from '../components/WebSerial'

function RegistrationDialog({ kind, close, saved, trigger, fallbackTrigger }: { kind: 'zone' | 'device'; close: () => void; saved: () => void; trigger: HTMLElement | null; fallbackTrigger: HTMLButtonElement | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isZone = kind === 'zone'
  useEffect(() => {
    const element = dialogRef.current
    element?.showModal()
    nameRef.current?.focus()
    return () => {
      // Release modal inertness before restoring focus. Wait until React has
      // removed the dialog; StrictMode's rehearsal must not move focus out.
      element?.close()
      queueMicrotask(() => {
        if (!element?.isConnected) {
          const target = trigger?.isConnected ? trigger : fallbackTrigger
          target?.focus()
        }
      })
    }
  }, [trigger, fallbackTrigger])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    if (!name) { setError('Escribe un nombre que no contenga solamente espacios.'); return }
    setBusy(true)
    setError(null)
    try {
      if (isZone) {
        const purpose = String(form.get('purpose') || '').trim()
        const description = String(form.get('description') || '').trim()
        await api.createZone({ name, purpose, ...(description ? { description } : {}) })
      } else {
        const model = String(form.get('model') || '').trim()
        const serial_port = String(form.get('serial_port') || '').trim()
        await api.createDevice({ name, ...(model ? { model } : {}), ...(serial_port ? { serial_port } : {}) })
      }
      saved()
      close()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar el registro.')
    } finally {
      setBusy(false)
    }
  }

  return <dialog className="registration-dialog" ref={dialogRef} aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); if (!busy) close() }}>
    <form onSubmit={event => void submit(event)}>
      <div className="dialog-heading"><span className="dialog-icon">{isZone ? <Sprout size={23} /> : <Cpu size={23} />}</span><button className="icon-button" type="button" onClick={close} aria-label="Cerrar formulario" disabled={busy}><X size={20} /></button></div>
      <div className="eyebrow">CONFIGURACIÓN REAL</div><h2 id="dialog-title">{isZone ? 'Registrar una zona' : 'Registrar un ESP32'}</h2><p className="dialog-intro">{isZone ? 'Describe un área que exista en tu instalación y define para qué se utilizará.' : 'Esta ficha no conecta la placa. La identidad física se registra al recibir mensajes válidos del ESP32.'}</p>
      <fieldset disabled={busy}><label htmlFor="registration-name">Nombre <span>obligatorio</span></label><input ref={nameRef} id="registration-name" name="name" maxLength={80} required autoFocus placeholder={isZone ? 'Nombre de la zona' : 'Nombre del dispositivo'} autoComplete="off" />
        {isZone ? <><label htmlFor="zone-purpose">Propósito <span>obligatorio</span></label><select id="zone-purpose" name="purpose" required defaultValue=""><option value="" disabled>Seleccionar un propósito</option><option>Producción hidropónica</option><option>Investigación en sustrato seguro</option><option>Banco de semillas</option><option>Servicios y equipamiento</option><option>Laboratorio confinado</option></select><label htmlFor="zone-description">Descripción <span>opcional</span></label><textarea id="zone-description" name="description" maxLength={2000} rows={3} placeholder="Ubicación, alcance u observaciones pertinentes" /></> : <><label htmlFor="device-model">Modelo exacto de la placa <span>opcional</span></label><input id="device-model" name="model" maxLength={120} placeholder="Déjalo vacío si todavía no lo conoces" autoComplete="off" /><label htmlFor="device-port">Puerto serie <span>opcional</span></label><input id="device-port" name="serial_port" maxLength={128} placeholder="Puerto identificado en tu equipo" autoComplete="off" /><p className="field-help"><Info size={14} />Sólo registra un puerto identificado. El lector serial es un proceso separado y no controla actuadores.</p></>}
      </fieldset>
      {error && <div className="form-error" role="alert"><CircleAlert size={17} /><span>{error}</span></div>}
      <div className="dialog-actions"><button type="button" className="button button-quiet" onClick={close} disabled={busy}>Cancelar</button><button className="button button-gold" type="submit" disabled={busy}><Save size={16} />{busy ? 'Guardando…' : 'Guardar registro'}</button></div>
    </form>
  </dialog>
}

function RegistrationEmpty({ icon, title, description, button }: { icon: ReactNode; title: string; description: string; button: ReactNode }) {
  return <div className="empty-inline"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{button}</div>
}

export default function Configuration() {
  const { zones, devices } = useData()
  const reloadDevices = devices.reload
  useEffect(() => {
    void reloadDevices(true)
    const timer = window.setInterval(() => void reloadDevices(true), 3000)
    return () => window.clearInterval(timer)
  }, [reloadDevices])
  const [dialog, setDialog] = useState<'zone' | 'device' | null>(null)
  const [message, setMessage] = useState('')
  const triggerRef = useRef<HTMLElement | null>(null)
  const zoneButtonRef = useRef<HTMLButtonElement>(null)
  const deviceButtonRef = useRef<HTMLButtonElement>(null)

  function openDialog(kind: 'zone' | 'device', trigger: HTMLElement) {
    triggerRef.current = trigger
    setDialog(kind)
  }

  function saved() {
    setMessage(dialog === 'zone' ? 'Zona registrada. La configuración se guardó en la base de datos.' : 'Dispositivo registrado. La conexión física permanece pendiente.')
    if (dialog === 'zone') void zones.reload()
    else void devices.reload()
  }

  return <>
    <PageHeading title="Preparar mi domo" description="Define tu instalación real. Lo que no conoces todavía puede quedar pendiente." />
    {message && <div className="success-notice" role="status"><Check size={18} />{message}<button className="icon-button" aria-label="Cerrar confirmación" onClick={() => setMessage('')}><X size={17} /></button></div>}
    <WebSerialPanel />
    <section className="panel section-panel"><div className="panel-heading"><div><div className="eyebrow">01 / ESPACIOS</div><h2>Zonas de la instalación</h2></div><button ref={zoneButtonRef} className="button button-outline" onClick={event => openDialog('zone', event.currentTarget)}><Plus size={16} />Registrar zona</button></div>
      <ResourceState resource={zones}>{items => items.length ? <div className="registration-list">{items.map(zone => <article className="registration-item" key={zone.id}><span className="registered-icon"><Sprout size={21} /></span><div className="registered-content"><h3>{zone.name}</h3><p>{zone.purpose}</p>{zone.description && <p className="registration-description">{zone.description}</p>}<small>Registro: {formatDate(zone.created_at)} · ID: {zone.id}</small></div><span className="status-pill neutral">Sensor no configurado</span></article>)}</div> : <RegistrationEmpty icon={<Sprout size={30} strokeWidth={1.5} />} title="Aún no hay zonas registradas" description="Agrega las áreas de tu instalación. El laboratorio confinado debe conservar un propósito independiente de la producción alimentaria." button={<button className="text-link" onClick={event => openDialog('zone', event.currentTarget)}><Plus size={16} />Registrar primera zona</button>} />}</ResourceState>
    </section>
    <section className="panel section-panel"><div className="panel-heading"><div><div className="eyebrow">02 / HARDWARE</div><h2>Dispositivos ESP32</h2></div><button ref={deviceButtonRef} className="button button-outline" onClick={event => openDialog('device', event.currentTarget)}><Plus size={16} />Registrar dispositivo</button></div>
      <ResourceState resource={devices}>{items => items.length ? <div className="registration-list">{items.map(device => <DeviceCard key={device.id} device={device} />)}</div> : <RegistrationEmpty icon={<Cpu size={30} strokeWidth={1.5} />} title="Tu placa puede registrarse sin sensores" description={import.meta.env.VITE_HOSTED === 'true' ? 'Pulsa Conectar ESP32 por USB. La placa aparecerá al recibir un mensaje válido. El registro manual solo guarda su ficha.' : 'Inicia el lector serial para identificar la placa automáticamente. También puedes guardar su configuración manual sin afirmar conexión.'} button={<button className="text-link" onClick={event => openDialog('device', event.currentTarget)}><Plus size={16} />Registrar primer dispositivo</button>} />}</ResourceState>
    </section>
    <div className="info-strip"><Info size={21} /><p>Estado actualizado desde la API cada 3 segundos. La conexión requiere un heartbeat vigente. Sin sensores, temperatura y humedad permanecen sin datos.</p></div>
    {dialog && <RegistrationDialog kind={dialog} close={() => setDialog(null)} saved={saved} trigger={triggerRef.current} fallbackTrigger={dialog === 'zone' ? zoneButtonRef.current : deviceButtonRef.current} />}
  </>
}
