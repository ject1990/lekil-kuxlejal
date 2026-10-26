import { ArrowRight, ArrowUpRight, Check, Circle, Cpu, Droplets, Leaf, LockKeyhole, PlugZap, Radio, RefreshCw, Sprout, Thermometer, Waves, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useData, formatDate } from '../state'
import { DomeDiagram } from '../components/DomeDiagram'
import { ErrorNotice, PageHeading } from '../components/Shared'

export default function Home() {
  const { health, zones, devices, telemetry, connected, refresh } = useData()
  const loading = health.loading || zones.loading || devices.loading || telemetry.loading
  const zoneCount = zones.data?.length
  const deviceCount = devices.data?.length
  const waiting = telemetry.data?.total === 0

  return <>
    <PageHeading eyebrow="LEKIL KUXLEJAL MARTE / CENTRO DE OBSERVACIÓN" title="Estado del domo" description="Una mirada clara al módulo agrícola. Cada dato, con su origen."
      action={<button className="button button-quiet refresh-button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} />{loading ? 'Consultando…' : 'Actualizar'}</button>} />

    {health.error && <ErrorNotice message={health.error} retry={() => void health.reload()} />}
    {!health.loading && health.data && !connected && <ErrorNotice message="La respuesta de salud no confirma el contrato de observación esperado. Revisa el servidor de la aplicación." retry={() => void health.reload()} />}
    {telemetry.error && <ErrorNotice message={telemetry.error} retry={() => void telemetry.reload()} />}

    <section className="observation-banner" aria-label="Estado de la observación">
      <span className="observation-icon"><Radio size={24} strokeWidth={1.5} /></span>
      <div><div className="banner-eyebrow">OBSERVAR PARA COMPRENDER</div><h2>{telemetry.loading ? 'Consultando las lecturas' : telemetry.error ? 'Telemetría no disponible' : waiting ? 'El primer paso es conectar' : 'Consulta de telemetría disponible'}</h2><p>{telemetry.error ? 'No se pudo verificar el registro. Reintenta la consulta para conocer su estado.' : waiting ? 'Todavía no hay mediciones reales. Configura las zonas y registra tu ESP32 para preparar la instrumentación.' : telemetry.loading ? 'Comprobando el registro de mediciones en la API.' : 'El registro puede consultarse desde la API. La integración de sensores corresponde a la siguiente etapa.'}</p></div>
      <Link to="/configuracion" className="button button-gold">Preparar mi domo<ArrowUpRight size={17} /></Link>
    </section>

    <section className="metric-grid" aria-label="Indicadores del módulo agrícola">
      <div className="metric-card temperature"><div className="metric-top"><span className="metric-icon"><Thermometer size={21} /></span><span className="mini-label">AMBIENTE</span></div><h2>Temperatura del cultivo</h2><div className="metric-value">Sin datos<span>°C</span></div><div className="metric-footer"><Circle size={10} /><span>Sensor no configurado</span></div></div>
      <div className="metric-card humidity"><div className="metric-top"><span className="metric-icon"><Waves size={21} /></span><span className="mini-label">AMBIENTE</span></div><h2>Humedad relativa</h2><div className="metric-value">Sin datos<span>% HR</span></div><div className="metric-footer"><Circle size={10} /><span>Sensor no configurado</span></div></div>
      <div className="metric-card water"><div className="metric-top"><span className="metric-icon"><Droplets size={21} /></span><span className="mini-label">RECURSOS</span></div><h2>Agua de riego</h2><div className="metric-value">Sin datos<span>L</span></div><div className="metric-footer"><Circle size={10} /><span>Nivel no medido</span></div></div>
      <div className="metric-card energy"><div className="metric-top"><span className="metric-icon"><Zap size={21} /></span><span className="mini-label">RECURSOS</span></div><h2>Energía del módulo</h2><div className="metric-value">Sin datos<span>Wh</span></div><div className="metric-footer"><Circle size={10} /><span>Consumo no medido</span></div></div>
    </section>

    <div className="dashboard-grid">
      <section className="panel dome-panel"><div className="panel-heading"><div><div className="eyebrow">EL ESPACIO DE CULTIVO</div><h2>Un sistema, distintos propósitos</h2></div><span className="tag">CONCEPTUAL</span></div><DomeDiagram /><div className="panel-bottom"><p><Sprout size={16} />Producción, investigación y custodia de semillas.</p><Link to="/domo" className="text-link">Explorar el domo<ArrowRight size={16} /></Link></div></section>
      <section className="panel setup-panel"><div className="panel-heading"><div><div className="eyebrow">TU PUNTO DE PARTIDA</div><h2>Preparar la observación</h2></div><PlugZap size={21} className="muted-icon" /></div>
        <ol className="setup-list">
          <li className={connected ? 'complete' : ''}><span className="step-number">{connected ? <Check size={14} /> : '1'}</span><div><strong>Comprobar el servidor</strong><p>{health.loading ? 'Verificando la API…' : connected ? 'API y base de datos disponibles' : 'Pendiente de verificación'}</p></div></li>
          <li className={zoneCount ? 'complete' : ''}><span className="step-number">{zoneCount ? <Check size={14} /> : '2'}</span><div><strong>Definir las zonas</strong><p>{zones.loading ? 'Consultando zonas…' : zones.error ? 'No se pudo consultar' : zoneCount ? `${zoneCount} ${zoneCount === 1 ? 'zona registrada' : 'zonas registradas'}` : 'Delimita su propósito y alcance'}</p></div></li>
          <li className={deviceCount ? 'complete' : ''}><span className="step-number">{deviceCount ? <Check size={14} /> : '3'}</span><div><strong>Registrar el ESP32</strong><p>{devices.loading ? 'Consultando dispositivos…' : devices.error ? 'No se pudo consultar' : deviceCount ? `${deviceCount} ${deviceCount === 1 ? 'dispositivo registrado' : 'dispositivos registrados'}` : 'Identifica la placa que vas a utilizar'}</p></div></li>
          <li><span className="step-number">4</span><div><strong>Integrar los sensores</strong><p>Próxima etapa · telemetría física</p></div><LockKeyhole size={14} className="step-lock" /></li>
        </ol>
        <Link to="/configuracion" className="button button-outline full-width"><Cpu size={16} />Configurar zonas y dispositivos<ArrowRight size={16} /></Link>
      </section>
    </div>

    <section className="bottom-grid" aria-label="Integridad del sistema">
      <div className="integrity-card"><span className="integrity-icon"><Leaf size={19} /></span><div><h3>Los datos empiezan en el mundo real</h3><p>Las mediciones se conservan con fuente, fecha, unidad y calidad. La ausencia de datos también se hace visible.</p></div></div>
      <div className="status-summary"><div><span className="eyebrow">REGISTRO DE TELEMETRÍA</span><strong>{telemetry.loading ? 'Consultando…' : telemetry.error ? 'Sin verificar' : waiting ? 'Sin mediciones registradas' : `${telemetry.data?.total ?? '—'} registros en la API`}</strong></div><small>{telemetry.data ? `Consultado: ${formatDate(telemetry.data.queried_at)}` : 'La fecha aparecerá tras una consulta válida.'}</small></div>
    </section>
  </>
}
