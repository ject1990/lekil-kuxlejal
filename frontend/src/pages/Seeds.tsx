import { useEffect, useRef, useState } from 'react'
import { BookOpen, ClipboardList, Sprout } from 'lucide-react'
import { PageHeading } from '../components/Shared'
import { AssessmentForm, authLabels, display, LotEditor, passportLabels, WeightsForm } from '../components/SeedForms'
import { criteria, seedApi } from '../seedApi'
import type { Action, Comparison, Passport, RecordKind, SeedDecision, SeedHistory, SeedLot, WeightProfile } from '../seedApi'
import { recordGroup, recordLabel, recordLabels } from '../components/seedInformation'
import { EvidenceOverview } from '../components/SeedEvidence'
import { formatDate } from '../state'

const actionLabels: Record<Action, string> = { conservar: 'Conservar', sembrar: 'Sembrar', retirar: 'Retirar', repetir_prueba: 'Repetir prueba', seleccionar: 'Seleccionar para el plan' }

function PassportDetails({ passport }: { passport: Passport }) {
  const fields = (keys: (keyof typeof passportLabels)[]) => <dl className="seed-passport">{keys.map(key => <div key={key}><dt>{passportLabels[key]}</dt><dd>{display(passport[key])}</dd></div>)}</dl>
  return <><EvidenceOverview passport={passport} /><dl className="seed-passport"><div><dt>Nombre</dt><dd>{passport.common_name}</dd></div><div><dt>Identificador</dt><dd>{passport.code}</dd></div><div><dt>Tipo de registro</dt><dd>{recordLabel(passport)}</dd></div><div><dt>Autorización de uso</dt><dd>{authLabels[passport.authorization_status]}</dd></div></dl>
    <details className="seed-form-section"><summary>Origen y uso responsable</summary>{fields(['provenance', 'custodian_entity', 'use_conditions', 'authorization_source'])}</details>
    <details className="seed-form-section"><summary>Cómo se conservan</summary>{fields(['storage_conditions', 'container', 'location'])}</details>
    <details className="seed-form-section"><summary>Más información</summary><dl className="seed-passport"><div><dt>{passport.source_kind === 'real' ? 'Cantidad disponible' : 'Cantidad anterior sin clasificar · no es inventario'}</dt><dd>{display(passport.quantity)} {passport.unit ?? ''}</dd></div></dl>{fields(['variety', 'scientific_name', 'received_on', 'observations', 'information_source'])}</details>
    {passport.tests.length > 0 && <details className="seed-form-section"><summary>Pruebas anteriores · germinación y viabilidad ({passport.tests.length})</summary><p>Registros conservados del formato anterior. Su tipo de evidencia no se asigna automáticamente; revisa fecha, método y fuente.</p>{passport.tests.length === 0 ? <p>Sin pruebas registradas · Sin datos.</p> : passport.tests.map((test, i) => <div className="seed-test" key={i}><strong>{test.kind === 'germination' ? 'Germinación' : 'Viabilidad'}: {test.result}</strong><p>Fecha: {display(test.tested_on)} · Método: {display(test.method)}</p><p>Fuente: {test.source}</p></div>)}</details>}
  </>
}

function DecisionForm({ lot, initialAction, comparison, busy, save, cancel }: { lot: SeedLot; initialAction: Action; comparison: Comparison | null; busy: boolean; save: (action: Action, responsible: string, reason: string) => void; cancel: () => void }) {
  const [action, setAction] = useState(initialAction), [responsible, setResponsible] = useState(''), [reason, setReason] = useState('')
  const blocked = (action === 'sembrar' || action === 'seleccionar') && lot.authorization_status !== 'authorized'
  return <form className="panel seed-panel seed-form" aria-label="Decisión humana sobre semillas" onSubmit={e => { e.preventDefault(); save(action, responsible, reason) }}><fieldset disabled={busy}>
    <legend>Decisión humana · {lot.common_name} / {lot.code}</legend><span className="tag">{recordLabel(lot)}</span>
    <p>Registra la intención y el motivo. No ejecuta una siembra, no altera la cantidad disponible ni controla equipos. Revisa las condiciones de uso: {display(lot.use_conditions)}.</p>
    {comparison ? <p>Selección explícita entre {comparison.rows.length} lotes comparados. El resultado es provisional y no constituye validación científica. La justificación debe considerar las fuentes y la sensibilidad a los pesos.</p>
      : <label>Decisión<select value={action} onChange={e => setAction(e.target.value as Action)}>{Object.entries(actionLabels).filter(([key]) => key !== 'seleccionar').map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>}
    {blocked && <p className="decision-warning">Uso {authLabels[lot.authorization_status].toLocaleLowerCase('es')}. Documenta autorización y condiciones antes de registrar siembra o selección. Puedes conservar el lote o repetir pruebas.</p>}
    <label>Responsable de la decisión (rol o identificador local) *<input required maxLength={120} value={responsible} onChange={e => setResponsible(e.target.value)} /></label>
    <label>Motivo de la decisión *<textarea required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>
    <div className="decision-actions"><button className="button button-gold" type="submit" disabled={blocked}>Registrar decisión humana</button><button className="button button-quiet" type="button" onClick={cancel}>Cancelar decisión</button></div>
  </fieldset></form>
}

function DecisionRecord({ decision }: { decision: SeedDecision }) {
  return <div className="seed-test"><strong>{actionLabels[decision.action]} · {decision.responsible}</strong><p>{decision.reason}</p><p>{formatDate(decision.created_at)} · {recordLabel(decision.snapshot.lot)} · Pasaporte v{decision.snapshot.lot.revision}</p><p>{decision.snapshot.effect}</p>
    <details><summary>Datos revisados al decidir</summary><PassportDetails passport={decision.snapshot.lot} />{decision.snapshot.comparison && <><h4>Comparación conservada</h4><p>{decision.snapshot.comparison.notice}</p>{decision.snapshot.comparison.rows.map(row => <p key={row.lot.id}>{row.lot.code}: {display(row.total)} / 5 · Evaluación {row.assessment?.id}</p>)}<p>Pesos (%): {criteria.map(key => decision.snapshot.comparison!.weights.weights[key]).join(' · ')} en el orden de los seis criterios.</p></>}</details>
  </div>
}

export default function Seeds() {
  const [lots, setLots] = useState<SeedLot[]>([]), [profile, setProfile] = useState<WeightProfile | null>(null)
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [kind, setKind] = useState('all'), [chosen, setChosen] = useState<string[]>([]), [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState(0)
  const [editor, setEditor] = useState<{ lot: SeedLot | null; initialKind?: Passport['source_kind']; initialRecordKind?: RecordKind; showTests?: boolean } | null>(null)
  const [detail, setDetail] = useState<{ lot: SeedLot; history: SeedHistory } | null>(null)
  const [tab, setTab] = useState<'passport' | 'assessment' | 'history'>('passport')
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [decision, setDecision] = useState<{ lot: SeedLot; action: Action; comparison: Comparison | null } | null>(null)
  const workspace = useRef<HTMLDivElement>(null), editorArea = useRef<HTMLDivElement>(null)
  useEffect(() => { if (editor) editorArea.current?.focus(); else if (detail || decision) workspace.current?.focus() }, [editor, detail, decision])
  async function load() {
    setLoading(true); setError('')
    try { const [items, weights] = await Promise.all([seedApi.lots(), seedApi.weights()]); setLots(items); setNextOffset(items.length); setHasMore(items.length === 100); setProfile(weights); setComparison(null); setChosen([]); setDecision(null) }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo abrir el banco de semillas.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  async function perform(task: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('')
    try { await task() } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar. Vuelve a intentarlo.') }
    finally { setBusy(false) }
  }
  function replaceLot(lot: SeedLot) { setLots(items => items.some(item => item.id === lot.id) ? items.map(item => item.id === lot.id ? lot : item) : [...items, lot]) }
  async function openLot(id: string) {
    const [lot, history] = await Promise.all([seedApi.lot(id), seedApi.history(id)])
    replaceLot(lot); setDetail({ lot, history }); setEditor(null); setDecision(null); setTab('passport')
  }
  const visible = lots.filter(lot => kind === 'all' || recordGroup(lot) === kind)
  const chosenKind = lots.find(lot => chosen.includes(lot.id))
  const chosenGroup = chosenKind ? recordGroup(chosenKind) : undefined
  return <div className="seed-page">
    <PageHeading eyebrow="DOMO VITAL · MEMORIA Y TRAZABILIDAD" title="Semillas" description="Investiga cultivos candidatos, registra semillas recibidas y conserva la procedencia de cada dato." />
    <section className="panel seed-panel seed-start" aria-label="Agregar semillas"><h2>Agregar semillas</h2><p>Un lote es un grupo de semillas del mismo origen que registramos para darle seguimiento.</p>
      <div className="seed-entry-grid">
        <button className="seed-entry-choice" disabled={busy || loading || !profile} onClick={() => { setEditor({ lot: null, initialKind: 'real', initialRecordKind: 'inventory' }); setDetail(null); setDecision(null); setNotice('') }}><Sprout size={25} /><span><strong>Semillas disponibles</strong><small>Tengo semillas: registra grupos recibidos o conservados físicamente.</small></span></button>
        <button className="seed-entry-choice study" disabled={busy || loading || !profile} onClick={() => { setEditor({ lot: null, initialKind: 'hypothetical', initialRecordKind: 'study' }); setDetail(null); setDecision(null); setNotice('') }}><BookOpen size={25} /><span><strong>Cultivos en estudio</strong><small>Investigación documental auténtica, aunque todavía no tengas semillas.</small></span></button>
      </div>
      <details className="seed-form-section"><summary>Simulación</summary><p>Sólo resultados generados por escenarios supuestos. Las referencias científicas van en Cultivos en estudio.</p><button className="button button-outline" disabled={busy || loading || !profile} onClick={() => { setEditor({ lot: null, initialKind: 'hypothetical', initialRecordKind: 'simulation' }); setDetail(null); setDecision(null); setNotice('') }}>Registrar resultado de simulación</button></details>
    </section>
    <p className="seed-privacy">Registro responsable. Registra entidades o comunidades y referencias documentales; no datos personales de custodios o informantes. Este módulo no publica información ni concede autorización de uso.</p>
    <div aria-live="polite">{notice && <p className="seed-notice" role="status">{notice}</p>}</div>
    {error && <div className="error-notice" role="alert"><p>{error}</p><button className="button button-quiet" disabled={busy} onClick={() => void load()}>Actualizar lista y pesos</button></div>}
    <div ref={editorArea} tabIndex={-1} className="seed-workspace">
        {editor && <LotEditor key={`${editor.lot?.id ?? editor.initialRecordKind}-${editor.showTests ?? false}`} lot={editor.lot} initialKind={editor.initialKind} initialRecordKind={editor.initialRecordKind} existingCodes={lots.map(lot => lot.code)} showTests={editor.showTests} busy={busy} cancel={() => setEditor(null)} save={passport => void perform(async () => {
          const lot = editor.lot ? await seedApi.update(editor.lot, passport) : await seedApi.create(passport)
          replaceLot(lot); setComparison(null); setEditor(null); setNotice('Ficha guardada. Añade fuentes, pruebas y observaciones; los datos desconocidos siguen pendientes.'); await openLot(lot.id)
        })} />}
    </div>
    {loading ? <p role="status">Abriendo el banco de semillas…</p> : profile && <>
      <section className="panel seed-panel" aria-label="Lotes registrados"><div className="seed-section-heading"><div><span className="eyebrow">PASAPORTES REGISTRADOS</span><h2>Fichas registradas</h2></div><label className="seed-filter">Mostrar<select value={kind} onChange={e => { setKind(e.target.value); setChosen([]); setComparison(null) }}><option value="all">Todos los registros</option>{Object.entries(recordLabels).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label></div>
        {visible.length === 0 ? <div className="seed-empty"><Sprout size={30} /><h3>{lots.length === 0 ? 'Aún no hay fichas guardadas' : 'Sin fichas de este tipo'}</h3><p>Elige «Semillas disponibles» o «Cultivos en estudio» para empezar. Puedes completar la información después.</p></div> : <div className="seed-lot-grid">{visible.map(lot => <article key={lot.id} className="seed-lot-card"><span className={`tag ${lot.source_kind === 'hypothetical' ? 'seed-hypothetical' : ''}`}>{recordLabel(lot)}</span><h3>{lot.common_name}</h3><p className="seed-code">{lot.code} · {display(lot.variety)}</p><p>{lot.source_kind === 'real' ? `${display(lot.quantity)} ${lot.unit ?? ''} disponibles` : recordGroup(lot) === 'study' ? 'Sin existencias registradas en esta ficha' : recordGroup(lot) === 'simulation' ? 'Escenario supuesto · no es un hecho observado' : 'Procedencia pendiente de revisar · sin inventario'}</p><p className="seed-authorization">{authLabels[lot.authorization_status]}</p><div className="seed-card-actions"><button className="button button-outline" disabled={busy} onClick={() => void perform(() => openLot(lot.id))}>Abrir {lot.code}</button><label><input type="checkbox" checked={chosen.includes(lot.id)} disabled={busy || (!chosen.includes(lot.id) && (chosen.length >= 20 || !!chosenGroup && chosenGroup !== recordGroup(lot)))} onChange={e => { setChosen(items => e.target.checked ? [...items, lot.id] : items.filter(id => id !== lot.id)); setComparison(null); setDecision(null) }} />Comparar {lot.code}</label></div></article>)}</div>}
        {hasMore && <button className="button button-quiet" disabled={busy} onClick={() => void perform(async () => { const items = await seedApi.lots(nextOffset); setLots(before => [...new Map([...before, ...items].map(item => [item.id, item])).values()]); setNextOffset(nextOffset + items.length); setHasMore(items.length === 100) })}>Cargar más lotes</button>}
        <div className="decision-actions"><button className="button button-outline" disabled={busy || chosen.length < 2} onClick={() => void perform(async () => { setComparison(await seedApi.compare(chosen)); setNotice('Comparación consultada. Revisa los resultados debajo de la lista.') })}><ClipboardList size={16} />Comparar lotes ({chosen.length})</button></div><p>Marca entre 2 y 20 fichas de la misma clasificación. Los estudios, el inventario y las simulaciones se comparan por separado. La aplicación no elige por ti.</p>
      </section>

      {comparison && <section className="panel seed-panel" aria-label="Comparación de semillas"><h2>Comparación provisional</h2><p>{comparison.notice}</p>{!comparison.complete && <p className="decision-warning">Comparación incompleta. No se genera una clasificación completa ni se habilita la selección final. Revisa los datos pendientes.</p>}
        <div className="decision-table" tabIndex={0} role="region" aria-label="Tabla comparativa de semillas"><table><caption>Escala de preferencia 0–5 · total = suma de puntuación × peso / 100. No equivale a viabilidad científica.</caption><thead><tr><th scope="col">Criterio / peso</th>{comparison.rows.map(row => <th scope="col" key={row.lot.id}>{row.lot.common_name}<br />{row.lot.code}<br />{recordLabel(row.lot)}</th>)}</tr></thead><tbody>
          {criteria.map(key => <tr key={key}><th scope="row">{profile.criteria[key]} · {comparison.weights.weights[key]} %</th>{comparison.rows.map(row => <td key={row.lot.id}>{display(row.assessment?.scores[key]?.value)}{row.assessment?.scores[key] && <details><summary>Motivo y fuente</summary><p>{row.assessment.scores[key]?.justification}</p><p>Fuente: {row.assessment.scores[key]?.source}</p></details>}</td>)}</tr>)}
          <tr><th scope="row">Cálculo ponderado provisional / 5</th>{comparison.rows.map(row => <td key={row.lot.id}>{comparison.complete ? display(row.total) : 'Pendiente de completar comparación'}</td>)}</tr>
          <tr><th scope="row">Revisión requerida</th>{comparison.rows.map(row => <td key={row.lot.id}>{row.problems.length ? row.problems.join('. ') : 'Evaluación completa; validación científica pendiente'}<br />{authLabels[row.lot.authorization_status]}</td>)}</tr>
          <tr><th scope="row">Decisión humana</th>{comparison.rows.map(row => <td key={row.lot.id}><button className="button button-outline" disabled={busy || !comparison.complete || row.lot.authorization_status !== 'authorized'} onClick={() => { setDecision({ lot: row.lot, action: 'seleccionar', comparison }); setEditor(null); setDetail(null) }}>Elegir {row.lot.code}</button></td>)}</tr>
        </tbody></table></div><p>La selección requiere autorización de uso documentada. El motivo de la decisión queda registrado junto a la comparación y los pesos revisados.</p>
      </section>}

      <div ref={workspace} tabIndex={-1} className="seed-workspace">
        {decision && <DecisionForm key={`${decision.lot.id}-${decision.action}`} {...decision} initialAction={decision.action} busy={busy} cancel={() => setDecision(null)} save={(action, responsible, reason) => void perform(async () => {
          await seedApi.decide(decision.lot, action, responsible, reason, decision.comparison)
          const id = decision.lot.id; await openLot(id); setTab('history'); setNotice('Decisión humana registrada con fecha, motivo y datos revisados.')
        })} />}
        {detail && <section className="panel seed-panel" aria-label="Detalle del lote"><div className="seed-section-heading"><div><span className="eyebrow">{recordLabel(detail.lot)} · PASAPORTE v{detail.lot.revision}</span><h2>{detail.lot.common_name} · {detail.lot.code}</h2></div><button className="button button-quiet" onClick={() => setDetail(null)}>Cerrar ficha</button></div>
          <div className="seed-tabs" role="group" aria-label="Contenido del lote">{(['passport', 'assessment', 'history'] as const).map(key => <button className={`button ${tab === key ? 'button-gold' : 'button-quiet'}`} aria-pressed={tab === key} key={key} onClick={() => setTab(key)}>{{ passport: 'Ficha', assessment: 'Evaluar', history: 'Historial' }[key]}</button>)}</div>
          {tab === 'passport' && <><PassportDetails passport={detail.lot} /><p>Registrado {formatDate(detail.lot.created_at)} · Última revisión {formatDate(detail.lot.updated_at)}</p><div className="decision-actions"><button className="button button-outline" disabled={busy} onClick={() => { setEditor({ lot: detail.lot }); setDetail(null) }}>Editar ficha</button><button className="button button-outline" disabled={busy} onClick={() => { setEditor({ lot: detail.lot, showTests: true }); setDetail(null) }}>Pruebas y observaciones</button><button className="button button-gold" disabled={busy} onClick={() => { setDecision({ lot: detail.lot, action: 'conservar', comparison: null }); setDetail(null) }}>Registrar decisión</button></div></>}
          {tab === 'assessment' && <AssessmentForm key={`${detail.lot.id}-${detail.lot.revision}-${profile.id}-${detail.history.assessments[0]?.id}`} lot={detail.lot} profile={profile} previous={detail.history.assessments[0]} busy={busy} save={(scores, responsible) => void perform(async () => { const result = await seedApi.assess(detail.lot, profile, scores, responsible); await openLot(detail.lot.id); setTab('history'); setComparison(null); setNotice(result.total === null ? 'Evaluación incompleta guardada, sin puntuación global.' : 'Evaluación provisional guardada. La selección sigue siendo humana.') })} />}
          {tab === 'history' && <><h3>Decisiones humanas</h3>{detail.history.decisions.length === 0 ? <p>Sin decisiones registradas.</p> : detail.history.decisions.map(item => <DecisionRecord key={item.id} decision={item} />)}
            <h3>Evaluaciones conservadas</h3>{detail.history.assessments.length === 0 ? <p>Sin evaluaciones registradas.</p> : detail.history.assessments.map(item => <details className="seed-test" key={item.id}><summary>{formatDate(item.created_at)} · {item.total === null ? 'Incompleta · sin resultado global' : `${item.total} / 5 · Provisional`} · {item.lot_revision !== detail.lot.revision || item.weight_profile_id !== profile.id ? 'Necesita revisión' : 'Datos vigentes'}</summary><p>Responsable: {item.responsible} · Pasaporte v{item.lot_revision}</p>{criteria.map(key => <p key={key}><strong>{profile.criteria[key]} ({item.weights[key]} %): {display(item.scores[key]?.value)}</strong><br />{item.scores[key]?.justification ?? 'Sin justificación registrada'}<br />Fuente: {display(item.scores[key]?.source)}</p>)}</details>)}
            <h3>Versiones del pasaporte</h3>{detail.history.revisions.map(item => <details className="seed-test" key={item.id}><summary>Versión {item.revision} · {formatDate(item.created_at)}</summary><PassportDetails passport={item.passport} /></details>)}
          </>}
        </section>}
      </div>
      <details className="panel seed-panel"><summary>Revisar los seis criterios y sus pesos</summary><WeightsForm key={profile.id ?? 'initial'} profile={profile} busy={busy} save={(weights, responsible, reason) => void perform(async () => { setProfile(await seedApi.saveWeights(weights, responsible, reason)); setComparison(null); setDecision(null); setNotice('Nueva versión de pesos guardada. Revisa las evaluaciones para compararlas con estos pesos.') })} /></details>
    </>}
  </div>
}
