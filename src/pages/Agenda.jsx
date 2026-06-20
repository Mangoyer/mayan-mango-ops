import { useState, useMemo, useEffect } from 'react'
import { format, isToday, isTomorrow, parseISO, startOfDay, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { MapPin, Clock, Car, AlertCircle, Plus, ChevronRight, Building2, CheckCircle2 } from 'lucide-react'
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useContratos, addContrato, useFlota, updateUnidad } from '../hooks/useFirestore'
import { useAuth } from '../contexts/AuthContext'
import { Spinner, KpiCard, Badge, Modal, Field, PageHeader } from '../components/ui'
import { BtnAgendaDia, BtnAgendaSemana } from '../components/PdfButtons'
import PdfUploader from '../components/PdfUploader'
import { Link } from 'react-router-dom'

const TIPO_LABEL  = { entrega: 'Entrega', devolucion: 'Devolución' }
const TIPO_COLOR  = { entrega: 'orange', devolucion: 'green' }
const MOTIVO_LABEL = { auto_sustituto: 'Auto sustituto', renta_periodo: 'Renta por periodo' }

// ── Servicios empresariales activos (para integrar en agenda) ──
function useServiciosActivos() {
  const [servicios, setServicios] = useState([])
  useEffect(() => {
    const q = query(collection(db, 'serviciosEmpresariales'), where('activo', '==', true))
    const unsub = onSnapshot(q, snap => {
      setServicios(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])
  return servicios
}

async function cerrarServicioDesdeAgenda(id, economico, flota) {
  await updateDoc(doc(db, 'serviciosEmpresariales', id), {
    activo: false,
    fechaCierre: format(new Date(), 'yyyy-MM-dd'),
  })
  const unidad = flota.find(u => u.economico === economico)
  if (unidad) {
    await updateUnidad(unidad.id, { status: 'disponible', cliente: '', hasta: '' })
  }
}

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
  const esTraslado = ev._tipo === 'entrega' && ev.tipoServicioEntrega === 'traslado'
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
            {esTraslado && <Badge color="blue">✈️ Traslado</Badge>}
            {urgente && <Badge color="red">Urgente</Badge>}
          </div>
          <p className="text-sm text-gray-700 font-medium truncate">{ev.cliente}</p>
          {ev.telefono && (
            <p className="text-xs text-gray-400 truncate">📞 {ev.telefono}</p>
          )}
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
          {esTraslado && ev.vuelo && (ev.vuelo.numero || ev.vuelo.horaLlegada) && (
            <span className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-0.5 inline-flex items-center gap-1 mt-1.5">
              ✈️ {ev.vuelo.aerolinea} {ev.vuelo.numero} {ev.vuelo.horaLlegada && `· llega ${ev.vuelo.horaLlegada}`}
            </span>
          )}
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

// ── Tarjeta de servicio empresarial dentro de la agenda ────────
function ServicioEmpresarialCard({ s, esHoy, flota }) {
  const [closing, setClosing] = useState(false)
  const dias = Math.floor((new Date() - new Date(s.fechaInicio)) / (1000 * 60 * 60 * 24))

  async function handleCerrar() {
    setClosing(true)
    try {
      await cerrarServicioDesdeAgenda(s.id, s.economico, flota)
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="card p-4 flex gap-3 border-l-4 border-l-amber-400">
      <div className="flex-shrink-0 w-11 text-center bg-amber-50 rounded-lg pt-2 pb-1.5 flex flex-col items-center justify-center">
        <Building2 size={18} className="text-amber-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-medium text-gray-900">{s.economico}</span>
          <Badge color="amber">{MOTIVO_LABEL[s.motivo] ?? s.motivo}</Badge>
          {!esHoy && <Badge color="gray">En curso · día {dias}</Badge>}
        </div>
        <p className="text-sm text-gray-700 font-medium truncate">{s.empresa}</p>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Car size={12} />{s.vehiculo || '—'} {s.placa && `· ${s.placa}`}
          </span>
        </div>
        {s.notas && (
          <span className="text-xs text-amber-700 flex items-center gap-1 mt-1">
            <AlertCircle size={11} />{s.notas}
          </span>
        )}
        <button
          onClick={handleCerrar}
          disabled={closing}
          className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-3 py-1.5 transition-colors"
        >
          <CheckCircle2 size={13} />
          {closing ? 'Cerrando…' : 'Marcar como devuelto'}
        </button>
      </div>
    </div>
  )
}

// ── Modal nuevo contrato ──────────────────────────────────────
const VEHICULOS = [
  'Dodge Attitude','Mitsubishi Xpander Cross','Toyota Corolla',
  'Dodge Grand Caravan','Toyota Hiace',
  'Mitsubishi Outlander','Mitsubishi L200','Mitsubishi Montero Limited',
]
const PUNTOS = [
  'Aeropuerto Cancún (CUN)',
  'Aeropuerto Tulum (TQO)',
  'Zona Hotelera Cancún',
  'Playa del Carmen',
  'Airbnb Tulum',
  'Otro',
]
const TIPO_SERVICIO = [
  { value: 'directo',  label: 'Entrega directa en punto' },
  { value: 'traslado', label: 'Traslado aeropuerto + entrega' },
]

function NuevoContratoModal({ open, onClose }) {
  const empty = {
    folio:'', cliente:'', telefono:'', email:'',
    vehiculo: VEHICULOS[0], placa:'',
    fechaEntrega:'', hora:'',
    tipoServicioEntrega: 'directo',
    puntoEntrega: PUNTOS[0],
    puntoEntregaOtro: '',
    vueloAerolinea:'', vueloNumero:'', vueloHoraLlegada:'',
    fechaDevolucion:'', lugarDevolucion: PUNTOS[0],
    lugarDevolucionOtro: '',
    notas:'', urgente: false,
  }
  const [form, setForm]     = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function aplicarExtraccion(datos) {
    setForm(f => ({
      ...f,
      folio: datos.folio || f.folio,
      cliente: datos.cliente || f.cliente,
      placa: datos.placa || f.placa,
      fechaEntrega: datos.fechaEntrega || f.fechaEntrega,
      hora: datos.hora || f.hora,
      fechaDevolucion: datos.fechaDevolucion || f.fechaDevolucion,
    }))
  }

  async function handleSave() {
    if (!form.folio || !form.cliente || !form.fechaEntrega) {
      setError('Folio, cliente y fecha de entrega son obligatorios.')
      return
    }
    setSaving(true)
    try {
      const lugarEntrega = form.puntoEntrega === 'Otro' ? form.puntoEntregaOtro : form.puntoEntrega
      const lugarDevolucion = form.lugarDevolucion === 'Otro' ? form.lugarDevolucionOtro : form.lugarDevolucion
      await addContrato({
        folio: form.folio,
        cliente: form.cliente,
        telefono: form.telefono,
        email: form.email,
        vehiculo: form.vehiculo,
        placa: form.placa,
        fechaEntrega: form.fechaEntrega,
        hora: form.hora,
        tipoServicioEntrega: form.tipoServicioEntrega,
        lugarEntrega,
        vuelo: form.tipoServicioEntrega === 'traslado' ? {
          aerolinea: form.vueloAerolinea,
          numero: form.vueloNumero,
          horaLlegada: form.vueloHoraLlegada,
        } : null,
        fechaDevolucion: form.fechaDevolucion,
        lugarDevolucion,
        notas: form.notas,
        urgente: form.urgente,
      })
      setForm(empty)
      onClose()
    } catch (e) {
      setError('Error al guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const esTraslado = form.tipoServicioEntrega === 'traslado'

  return (
    <Modal open={open} onClose={onClose} title="Nuevo contrato">
      <div className="flex flex-col gap-4">
        <PdfUploader
          tipo="turistico"
          label="Subir contrato PDF (opcional — autocompleta)"
          onExtracted={aplicarExtraccion}
        />
        <div className="text-center text-xs text-gray-400 -my-1">— o captura manual abajo —</div>

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
          <Field label="Teléfono del cliente">
            <input className="input" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+1 555 123 4567" />
          </Field>
          <Field label="Email del cliente">
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="cliente@correo.com" />
          </Field>
        </div>

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

        {/* Tipo de servicio de entrega */}
        <Field label="Tipo de servicio">
          <select className="select" value={form.tipoServicioEntrega} onChange={e => set('tipoServicioEntrega', e.target.value)}>
            {TIPO_SERVICIO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>

        <Field label={esTraslado ? 'Punto de entrega final (destino del traslado)' : 'Punto de entrega'}>
          <select className="select" value={form.puntoEntrega} onChange={e => set('puntoEntrega', e.target.value)}>
            {PUNTOS.map(l => <option key={l}>{l}</option>)}
          </select>
        </Field>
        {form.puntoEntrega === 'Otro' && (
          <Field label="Especifica el punto de entrega">
            <input className="input" value={form.puntoEntregaOtro} onChange={e => set('puntoEntregaOtro', e.target.value)} placeholder="Dirección o nombre del lugar" />
          </Field>
        )}

        {/* Datos de vuelo — solo si hay traslado */}
        {esTraslado && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex flex-col gap-3">
            <p className="text-xs font-semibold text-blue-800">✈️ Datos del vuelo (para coordinar el traslado)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Aerolínea">
                <input className="input" value={form.vueloAerolinea} onChange={e => set('vueloAerolinea', e.target.value)} placeholder="Ej. American Airlines" />
              </Field>
              <Field label="Número de vuelo">
                <input className="input" value={form.vueloNumero} onChange={e => set('vueloNumero', e.target.value)} placeholder="Ej. AA1234" />
              </Field>
            </div>
            <Field label="Hora de llegada">
              <input className="input" type="time" value={form.vueloHoraLlegada} onChange={e => set('vueloHoraLlegada', e.target.value)} />
            </Field>
          </div>
        )}

        <Field label="Fecha de devolución">
          <input className="input" type="date" value={form.fechaDevolucion} onChange={e => set('fechaDevolucion', e.target.value)} />
        </Field>

        <Field label="Lugar de devolución">
          <select className="select" value={form.lugarDevolucion} onChange={e => set('lugarDevolucion', e.target.value)}>
            {PUNTOS.map(l => <option key={l}>{l}</option>)}
          </select>
        </Field>
        {form.lugarDevolucion === 'Otro' && (
          <Field label="Especifica el lugar de devolución">
            <input className="input" value={form.lugarDevolucionOtro} onChange={e => set('lugarDevolucionOtro', e.target.value)} placeholder="Dirección o nombre del lugar" />
          </Field>
        )}

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
  const { flota } = useFlota()
  const serviciosActivos = useServiciosActivos()
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

  // Días donde aparece cada servicio empresarial: desde su fecha de inicio hasta hoy (sigue "en curso")
  const hoyStr = format(new Date(), 'yyyy-MM-dd')
  const serviciosPorDia = useMemo(() => {
    if (filtro === 'devolucion' || filtro === 'urgente') return {}
    const map = {}
    serviciosActivos.forEach(s => {
      if (!s.fechaInicio) return
      // El día de inicio siempre aparece; "hoy" también aparece si ya inició (en curso)
      const claves = new Set([s.fechaInicio])
      if (s.fechaInicio <= hoyStr) claves.add(hoyStr)
      claves.forEach(k => {
        if (!map[k]) map[k] = []
        map[k].push(s)
      })
    })
    return map
  }, [serviciosActivos, filtro, hoyStr])

  // Combinar las claves de día de contratos + servicios empresariales
  const todasLasClaves = useMemo(() => {
    const set = new Set([...groups.map(([k]) => k), ...Object.keys(serviciosPorDia)])
    return [...set].filter(k => k >= hoyStr).sort()
  }, [groups, serviciosPorDia, hoyStr])

  // KPI counts
  const man  = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const kpiHoy   = (groups.find(([k]) => k === hoyStr)?.[1]?.length ?? 0) + (serviciosPorDia[hoyStr]?.length ?? 0)
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
        subtitle="Entregas y devoluciones — turístico y empresarial"
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
      {loading ? <Spinner /> : todasLasClaves.length === 0 ? (
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
      ) : todasLasClaves.map(dayKey => {
        const events = groups.find(([k]) => k === dayKey)?.[1] ?? []
        const serviciosDia = serviciosPorDia[dayKey] ?? []
        const esHoy = dayKey === hoyStr
        return (
          <div key={dayKey} className="mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 capitalize">
              {dayLabel(dayKey)}
            </p>
            <div className="flex flex-col gap-2">
              {events
                .sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? ''))
                .map((ev, i) => <ContratoCard key={`${ev.id}-${ev._tipo}-${i}`} ev={ev} />)
              }
              {serviciosDia.map(s => (
                <ServicioEmpresarialCard key={s.id} s={s} esHoy={s.fechaInicio === dayKey} flota={flota} />
              ))}
            </div>
          </div>
        )
      })}

      <NuevoContratoModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
