import { ArrowLeft, ArrowUpRight, CircleAlert, LockKeyhole, RefreshCw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Resource } from '../state'

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading">
    <div><div className="eyebrow">{eyebrow || 'DOMO VITAL · MÓDULO AGRÍCOLA'}</div><h1>{title}</h1><p>{description}</p></div>
    {action && <div className="heading-action">{action}</div>}
  </div>
}

export function ErrorNotice({ message, retry }: { message: string; retry: () => void }) {
  return <div className="error-notice" role="alert"><CircleAlert size={19} /><div><strong>No se pudo consultar</strong><p>{message}</p></div><button className="button button-quiet" onClick={retry}><RefreshCw size={15} />Reintentar</button></div>
}

export function ResourceState<T>({ resource, children }: { resource: Resource<T>; children: (data: T) => ReactNode }) {
  if (resource.loading) return <div className="loading-state" role="status"><RefreshCw className="spin" size={18} /> Consultando API…</div>
  if (resource.error) return <ErrorNotice message={resource.error} retry={() => void resource.reload()} />
  if (resource.data === undefined) return null
  return <>{children(resource.data)}</>
}

export function RouteCard({ icon: Icon, title, description, to }: { icon: LucideIcon; title: string; description: string; to: string }) {
  return <Link to={to} className="route-card"><span className="route-icon"><Icon size={21} /></span><span><strong>{title}</strong><small>{description}</small></span><ArrowUpRight size={18} /></Link>
}

export function PhaseNotice({ title, description, icon: Icon = LockKeyhole }: { title: string; description: string; icon?: LucideIcon }) {
  return <div className="phase-notice"><div className="empty-icon"><Icon size={30} strokeWidth={1.5} /></div><span className="tag">PRÓXIMA ETAPA</span><h2>{title}</h2><p>{description}</p><Link to="/" className="button button-quiet"><ArrowLeft size={16} />Volver al inicio</Link></div>
}

export function SourceLabel({ children }: { children: ReactNode }) {
  return <span className="source-label">{children}</span>
}
