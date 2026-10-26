import { useEffect } from 'react'
import { BellRing, ChevronRight, CircleHelp, Cpu, ExternalLink, House, LayoutGrid, Leaf, LockKeyhole, Scale, Settings2, Sprout } from 'lucide-react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { BrandIcon } from './components/Brand'
import { DataProvider, formatDate, useData } from './state'
import Home from './pages/Home'
import Dome from './pages/Dome'
import Resources from './pages/Resources'
import Decisions from './pages/Decisions'
import Alerts from './pages/Alerts'
import Configuration from './pages/Configuration'
import FutureModule from './pages/FutureModule'
import Seeds from './pages/Seeds'
import { WebSerialNotice, WebSerialProvider } from './components/WebSerial'

const hostedMode = import.meta.env.VITE_HOSTED === 'true'

const navigation = [
  { path: '/', label: 'Inicio', icon: House },
  { path: '/domo', label: 'Domo', icon: Sprout },
  { path: '/recursos', label: 'Recursos', icon: LayoutGrid },
  { path: '/decisiones', label: 'Decisiones', icon: Scale },
  { path: '/semillas', label: 'Semillas', icon: Leaf },
  { path: '/alertas', label: 'Alertas', icon: BellRing },
]

function Shell() {
  const { health, connected } = useData()
  const location = useLocation()
  const section = navigation.find(item => item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path))?.label || 'Configuración'
  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = `${section} · DOMO VITAL`
  }, [location.pathname, section])

  return <div className="app-shell">
    <a href="#main-content" className="skip-link">Saltar al contenido</a>
    <aside className="sidebar">
      <Link to="/" className="project-brand" aria-label="Lekil Kuxlejal Marte, inicio"><BrandIcon /><span>LEKIL KUXLEJAL<small>MARTE</small></span></Link>
      <div className="sidebar-divider" />
      <div className="module-brand"><span className="module-symbol"><Leaf size={17} /></span><div>DOMO VITAL<small>Módulo agrícola</small></div></div>
      <span className="nav-label">ESPACIO DE TRABAJO</span>
      <nav className="side-nav" aria-label="Navegación principal">{navigation.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} end={path === '/'}><Icon size={19} strokeWidth={1.7} /><span>{label}</span><ChevronRight className="nav-chevron" size={14} /></NavLink>)}</nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-observation"><span className="eyebrow"><span className="small-dot" />FASE 2A</span><h3>Observar es el comienzo.</h3><p>Datos reales, conocimiento compartido y decisiones responsables.</p><span className="sidebar-team">A MARTE CHIAPAS <ExternalLink size={11} aria-hidden="true" /></span></div>
      <NavLink to="/configuracion" className="settings-link"><Settings2 size={18} />Configuración<ChevronRight size={14} /></NavLink>
      <div className="sidebar-footer">MARS CHALLENGE 2026<span>{hostedMode ? 'Acceso protegido' : 'v0.2 · Desarrollo local'}</span></div>
    </aside>

    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><BrandIcon className="mobile-logo" /><span>DOMO VITAL</span><ChevronRight size={13} /><strong>{section}</strong></div><div className="topbar-status"><span className={`api-status ${connected ? 'available' : ''}`} title={health.data ? `Última comprobación: ${formatDate(health.data.timestamp)}` : health.error || 'Comprobando API'}><span className="small-dot" />{health.loading ? 'Comprobando API' : connected ? (hostedMode ? 'API disponible' : 'API local disponible') : 'API sin verificar'}</span><span className="topbar-separator" /><span className="local-label"><Cpu size={14} />{hostedMode ? 'Aplicación web' : 'Entorno local'}</span></div></header>
      <div className="safety-bar"><span><span className="safety-dot" />MODO OBSERVACIÓN</span><span><LockKeyhole size={12} />Control físico deshabilitado</span></div>
      <main id="main-content" className="main-content" tabIndex={-1}><WebSerialNotice /><Routes><Route path="/" element={<Home />} /><Route path="/domo" element={<Dome />} /><Route path="/recursos" element={<Resources />} /><Route path="/decisiones" element={<Decisions />} /><Route path="/semillas" element={<Seeds />} /><Route path="/alertas" element={<Alerts />} /><Route path="/configuracion" element={<Configuration />} /><Route path="*" element={<FutureModule />} /></Routes></main>
      <footer className="workspace-footer"><span>LEKIL KUXLEJAL MARTE<span className="footer-dot">·</span> Cultivar con conocimiento y cuidado.</span><span title="Límite de alcance del módulo"><CircleHelp size={13} />No sustituye el soporte vital humano.</span></footer>
    </div>

    <nav className="mobile-nav" aria-label="Navegación principal móvil">{navigation.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} end={path === '/'}><Icon size={21} strokeWidth={1.8} /><span>{label}</span></NavLink>)}</nav>
  </div>
}

export default function App() {
  return <DataProvider><WebSerialProvider><Shell /></WebSerialProvider></DataProvider>
}
