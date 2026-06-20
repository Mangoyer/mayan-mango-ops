import { useState, useMemo } from 'react'
import { Car, Plus, Search } from 'lucide-react'
import { useFlota, updateUnidad } from '../hooks/useFirestore'
import { useAuth } from '../contexts/AuthContext'
import { Spinner, KpiCard, Badge, Modal, Field, PageHeader, StatusDot, EmptyState } from '../components/ui'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

const MODELOS = [
  'Dodge Attitude','Mitsubishi Xpander Cross','Toyota Corolla',
  'Dodge Grand Caravan','Toyota Hiace',
]
const ESTADOS = ['disponible','rentada','mantenimiento','preparacion']
const ESTADO_LABEL = {
  disponible:    'Disponible',
  rentada:       'Rentada',
  mantenimiento: 'Mantenimiento',
  preparacion:   'En preparación',
}
const ESTADO_COLOR = {
  disponible:    'green',
  rentada:       'orange',
  mantenimiento: 'red',
  preparacion:   'yellow',
}

function UnidadCard({ u, canEdit }) {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <>
      <div
        onClick={() => canEdit && setEditOpen(true)}
        className={`card p-3.5 ${canEdit ? 'cursor-pointer hover:shadow-md' : ''} transition-shadow`}
      >
        <div className="flex items-start justify-between gap-1 mb-2">
          <span className="text-xs text-gray-400 font-mono">{u.economico}</span>
          <StatusDot status={u.status} />
        </div>
        <p className="text-sm font-semibold text-gray-900 leading-tight">{u.placa}</p>
        <p className="text-xs text-gray-500 mb-2 leading-tight">{u.modelo}</p>
        <Badge color={ESTADO_COLOR[u.status]}>{ESTADO_LABEL[u.status]}</Badge>
        {u.cliente && (
          <p className="text-xs text-gray-400 mt-1.5 truncate">{u.cliente}</p>
        )}
        {u.hasta && (
          <p className="text-xs text-gray-300">hasta {u.hasta}</p>
        )}
      </div>

      {canEdit && (
        <EditUnidadModal open={editOpen} onClose={() => setEditOpen(false)} unidad={u} />
      )}
    </>
  )
}

function EditUnidadModal({ open, onClose, unidad }) {
  const [status,  setStatus]  = useState(unidad.status)
  const [cliente, setCliente] = useState(unidad.cliente ?? '')
  const [hasta,   setHasta]   = useState(unidad.hasta   ?? '')
  const [saving,  setSaving]  = useState(false)

  async function handleSave() {
    setSaving(true)
    await updateUnidad(unidad.id, { status, cliente, hasta })
    setSaving(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`${unidad.placa} — ${unidad.modelo}`}>
      <div className="flex flex-col gap-4">
        <Field label="Estado">
          <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
            {ESTADOS.map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Cliente actual">
          <input className="input" value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Dejar vacío si disponible" />
        </Field>
        <Field label="Disponible hasta / nota">
          <input className="input" value={hasta} onChange={e => setHasta(e.target.value)} placeholder="Ej. 25 Jun" />
        </Field>
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
          <button className="btn-primary flex-1"   onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function NuevaUnidadModal({ open, onClose }) {
  const empty = { economico:'', modelo: MODELOS[0], placa:'', status:'disponible', cliente:'', hasta:'' }
  const [form, setForm]     = useState(empty)
  const [saving, setSaving] = useState(false)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!form.placa || !form.economico) return
    setSaving(true)
    await addDoc(collection(db, 'flota'), { ...form, creadoEn: serverTimestamp() })
    setForm(empty)
    setSaving(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar unidad a flota">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Económico">
            <input className="input" value={form.economico} onChange={e => set('economico', e.target.value)} placeholder="U-51" />
          </Field>
          <Field label="Placa">
            <input className="input" value={form.placa} onChange={e => set('placa', e.target.value)} placeholder="EKS-9900" />
          </Field>
        </div>
        <Field label="Modelo">
          <select className="select" value={form.modelo} onChange={e => set('modelo', e.target.value)}>
            {MODELOS.map(m => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Estado inicial">
          <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
            {ESTADOS.map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
          </select>
        </Field>
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
          <button className="btn-primary flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Agregar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function Flota() {
  const { flota, loading } = useFlota()
  const { can }            = useAuth()
  const canEdit = can('admin')

  const [filtro,    setFiltro]    = useState('todos')
  const [busqueda,  setBusqueda]  = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = useMemo(() => {
    let list = flota
    if (filtro !== 'todos') list = list.filter(u => u.status === filtro)
    if (busqueda) {
      const q = busqueda.toLowerCase()
      list = list.filter(u =>
        (u.economico + u.placa + u.modelo + (u.cliente ?? '')).toLowerCase().includes(q)
      )
    }
    return list
  }, [flota, filtro, busqueda])

  const counts = useMemo(() => ({
    disponible:    flota.filter(u => u.status === 'disponible').length,
    rentada:       flota.filter(u => u.status === 'rentada').length,
    mantenimiento: flota.filter(u => u.status === 'mantenimiento').length,
    preparacion:   flota.filter(u => u.status === 'preparacion').length,
  }), [flota])

  const FILTROS = [
    { key: 'todos',        label: `Todas (${flota.length})` },
    { key: 'disponible',   label: `Disponibles (${counts.disponible})` },
    { key: 'rentada',      label: `Rentadas (${counts.rentada})` },
    { key: 'mantenimiento',label: `Mantenimiento (${counts.mantenimiento})` },
    { key: 'preparacion',  label: `En preparación (${counts.preparacion})` },
  ]

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Disponibilidad de flota"
        subtitle={`${counts.disponible} unidades disponibles para ofrecer ahora`}
        action={canEdit && (
          <button className="btn-primary flex items-center gap-1.5" onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Agregar unidad
          </button>
        )}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total flota"       value={flota.length} />
        <KpiCard label="Disponibles"       value={counts.disponible}    valueClass="text-emerald-600" />
        <KpiCard label="Rentadas"          value={counts.rentada}       valueClass="text-orange-500" />
        <KpiCard label="Mantenimiento"     value={counts.mantenimiento} valueClass="text-red-500" />
      </div>

      {/* Búsqueda */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Buscar placa, modelo, cliente…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap mb-5 overflow-x-auto pb-1">
        {FILTROS.map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              filtro === f.key
                ? 'bg-mango-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={Car} title="Sin unidades" description="No hay unidades que coincidan con el filtro." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map(u => (
            <UnidadCard key={u.id} u={u} canEdit={canEdit} />
          ))}
        </div>
      )}

      {canEdit && (
        <NuevaUnidadModal open={modalOpen} onClose={() => setModalOpen(false)} />
      )}
    </div>
  )
}
