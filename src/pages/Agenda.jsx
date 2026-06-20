import { useState, useMemo } from 'react'
import { format, isToday, isTomorrow, parseISO, startOfDay, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { MapPin, Clock, Car, AlertCircle, Plus, ChevronRight } from 'lucide-react'
import { useContratos, addContrato } from '../hooks/useFirestore'
import { useAuth } from '../contexts/AuthContext'
import { Spinner, KpiCard, Badge, Modal, Field, PageHeader } from '../components/ui'
import { BtnAgendaDia, BtnAgendaSemana } from '../components/PdfButtons'
import { Link } from 'react-router-dom'

const TIPO_LABEL  = { entrega: 'Entrega', devolucion: 'Devolución' }
const TIPO_COLOR  = { entrega: 'orange', devolucion: 'green' }

function dateOf(val) {
  if (!val) return null
  if (val?.toDate) return val.toDate()
  return new Date(val)
}

function groupByDay(contratos) {
  const groups = {}
  contratos.forEach(c => {
    const events = []
    if (c.fechaEntrega)    events.push({ ...c, _tipo: 'entrega',    _date: dateOf(c.fechaEntrega) })
    if (c.fechaDevolucion) events.push({ ...c, _tipo: 'devolucion', _date: dateOf(c.fechaDevolucion) })
    events.forEach(ev => {
      const key = format(ev._date, 'yyyy-MM-dd')
      if (!groups[key]) groups[key] = []
      groups[key].push(ev)
    })
  })
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([k]) => k >= format(new Date(), 'yyyy-MM-dd'))
}

function dayLabel(dateStr) {
  const d = parseISO(dateStr)
  if (isToday(d))    return 'Hoy'
  if (isTomorrow(d)) return 'Mañana'
  return format(d, "EEEE d 'de' MMMM", { locale: es })
}

function ContratoCard({ ev }) {
  const urgente = ev.urgente
  return (
    <Link to={`/contratos/${ev.id}`} className="block">
      <div className={`card p-4 flex gap-3 hover:shadow-md transition-shadow cursor-pointer ${urgente ? 'border-l-4 border-l-red-400' : ''}`}>
        {/* Date blob */}
        <div className="flex-shrink-0 w-11 text-center bg-gray-50 rounded-lg pt-2 pb-1.5">
          <p className="text-lg font-semibold text-gray-900 leading-none">
            {format(ev._date, 'd')}
          </p>
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {format(ev._date, 'MMM', { locale: es })}
          </p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium text-gray-900">{ev.folio}</span>
            <Badge color={TIPO_COLOR[ev._tipo]}>{TIPO_LABEL[ev._tipo]}</Badge>
            {urgente && <Badge color="red">Urgente</Badge>}
          </div>
          <p className="text-sm text-gray-700 font-medium truncate">{ev.cliente}</p>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Car size={12} />{ev.vehiculo} · {ev.placa}
            </span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock size={12} />{ev.hora || '—'}
            </span>
          </div>
          <span className="text-xs text-gray-400 flex items-center gap-1 mt-1">
            <MapPin size={11} />{ev._tipo === 'entrega' ? ev.lugarEntrega : ev.lugarDevolucion}
          </span>
          {ev.notas && (
            <span className="text-xs text-amber-700 flex items-center gap-1 mt-1">
              <AlertCircle size={11} />{ev.notas}
            </span>
          )}
        </div>
        <ChevronRight size={16} className="text-gray-300 flex-shrink-0 self-center" />
      </div>
    </Link>
  )
}

// ── Modal nuevo contrato ──────────────────────────────────────
const VEHICULOS = [
  'Dodge Attitude','Mitsubishi Xpander Cross','Toyota Corolla',
  'Dodge Grand Caravan','Toyota Hiace',
]
const LUGARES = [
  'Aeropuerto CUN T2','Aeropuerto CUN T3','Hotel Grand Hyatt',
  'Playa del Carmen — Oficinas','Tulum — Zona Hotelera',
  'Cancún — Torre Ejecutiva','Hotel Xcaret Arte', 'Otro',
]

function NuevoContratoModal({ open, onClose }) {
  const empty = {
    folio:'', cliente:'', vehiculo: VEHICULOS[0], placa:'',
    fechaEntrega:'', hora:'', lugarEntrega: LUGARES[0],
    fechaDevolucion:'', lugarDevolucion: LUGARES[0],
    notas:'', urgente: false,
  }
  const [form, setForm]     = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!form.folio || !form.cliente || !form.fechaEntrega) {
      setError('Folio, cliente y fecha de entrega son obligatorios.')
      return
    }
    setSaving(true)
    try {
      await addContrato(form)
      setForm(empty)
      onClose()
    } catch (e) {
      setError('Error al guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo contrato">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Folio">
            <input className="input" value={form.folio} onChange={e => set('folio', e.target.value)} placeholder="747" />
          </Field>
          <Field label="¿Urgente?">
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={form.urgente} onChange={e => set('urgente', e.target.checked)} className="accent-mango-600 w-4 h-4" />
              <span className="text-sm text-gray-700">Marcar urgente</span>
            </label>
          </Field>
        </div>

        <Field label="Cliente">
          <input className="input" value={form.cliente} onChange={e => set('cliente', e.target.value)} placeholder="Nombre o empresa" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Vehículo">
            <select className="select" value={form.vehiculo} onChange={e => set('vehiculo', e.target.value)}>
              {VEHICULOS.map(v => <option key={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Placa">
            <input className="input" value={form.placa} onChange={e => set('placa', e.target.value)} placeholder="EKS-1245" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha de entrega">
            <input className="input" type="date" value={form.fechaEntrega} onChange={e => set('fechaEntrega', e.target.value)} />
          </Field>
          <Field label="Hora">
            <input className="input" type="time" value={form.hora} onChange={e => set('hora', e.target.value)} />
          </Field>
        </div>

        <Field label="Lugar de entrega">
          <select className="select" value={form.lugarEntrega} onChange={e => set('lugarEntrega', e.target.value)}>
            {LUGARES.map(l => <option key={l}>{l}</option>)}
          </select>
        </Field>

        <Field label="Fecha de devolución">
          <input className="input" type="date" value={form.fechaDevolucion} onChange={e => set('fechaDevolucion', e.target.value)} />
        </Field>

        <Field label="Lugar de devolución">
          <select className="select" value={form.lugarDevolucion} onChange={e => set('lugarDevolucion', e.target.value)}>
            {LUGARES.map(l => <option key={l}>{l}</option>)}
          </select>
        </Field>

        <Field label="Notas">
          <textarea className="input resize-none" rows={2} value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Instrucciones especiales…" />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
          <button className="btn-primary flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar contrato'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function Agenda() {
  const { contratos, loading } = useContratos()
  const { can } = useAuth()
  const [filtro,     setFiltro]     = useState('todos')
  const [modalOpen,  setModalOpen]  = useState(false)

  const filtered = useMemo(() => {
    let list = contratos
    if (filtro === 'entrega')    list = list.filter(c => c.fechaEntrega)
    if (filtro === 'devolucion') list = list.filter(c => c.fechaDevolucion)
    if (filtro === 'urgente')    list = list.filter(c => c.urgente)
    return list
  }, [contratos, filtro])

  const groups = useMemo(() => groupByDay(filtered), [filtered])

  // KPI counts
  const hoy = format(new Date(), 'yyyy-MM-dd')
  const man  = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const kpiHoy   = groups.find(([k]) => k === hoy)?.[1]?.length ?? 0
  const kpiMan   = groups.find(([k]) => k === man)?.[1]?.length ?? 0
  const kpiSem   = contratos.length
  const kpiUrg   = contratos.filter(c => c.urgente).length

  const FILTROS = [
    { key: 'todos',     label: 'Todos' },
    { key: 'entrega',   label: 'Entregas' },
    { key: 'devolucion',label: 'Devoluciones' },
    { key: 'urgente',   label: 'Urgentes' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Agenda"
        subtitle="Entregas y devoluciones programadas"
        action={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <BtnAgendaDia contratos={contratos} fecha={new Date()} />
            <BtnAgendaSemana contratos={contratos} />
            {can('admin') && (
              <button className="btn-primary flex items-center gap-1.5" onClick={() => setModalOpen(true)}>
                <Plus size={16} /> Nuevo contrato
              </button>
            )}
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Eventos hoy"     value={kpiHoy} />
        <KpiCard label="Mañana"          value={kpiMan} />
        <KpiCard label="Total contratos" value={kpiSem} />
        <KpiCard label="Urgentes"        value={kpiUrg} valueClass={kpiUrg > 0 ? 'text-red-600' : ''} />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap mb-5">
        {FILTROS.map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filtro === f.key
                ? 'bg-mango-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Groups */}
      {loading ? <Spinner /> : groups.length === 0 ? (
        <div className="card p-8 text-center text-gray-400 text-sm">
          No hay contratos programados.
          {can('admin') && (
            <div className="mt-3">
              <button className="btn-primary" onClick={() => setModalOpen(true)}>
                Agregar contrato
              </button>
            </div>
          )}
        </div>
      ) : groups.map(([dayKey, events]) => (
        <div key={dayKey} className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 capitalize">
            {dayLabel(dayKey)}
          </p>
          <div className="flex flex-col gap-2">
            {events
              .sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? ''))
              .map((ev, i) => <ContratoCard key={`${ev.id}-${ev._tipo}-${i}`} ev={ev} />)
            }
          </div>
        </div>
      ))}

      <NuevoContratoModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
