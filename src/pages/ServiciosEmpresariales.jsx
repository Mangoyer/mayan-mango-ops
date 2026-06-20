import { useState, useMemo } from 'react'
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { useEffect } from 'react'
import { db } from '../lib/firebase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Building2, Plus, CheckCircle2, Clock, Car } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Spinner, KpiCard, Badge, Modal, Field, PageHeader, EmptyState } from '../components/ui'
import PdfUploader from '../components/PdfUploader'
import { useFlota, updateUnidad } from '../hooks/useFirestore'

// ── Hook de datos ──────────────────────────────────────────────
function useServiciosEmpresariales() {
  const [servicios, setServicios] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'serviciosEmpresariales'), orderBy('fechaInicio', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setServicios(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  return { servicios, loading }
}

async function addServicioEmpresarial(data) {
  return addDoc(collection(db, 'serviciosEmpresariales'), {
    ...data,
    activo: true,
    creadoEn: serverTimestamp(),
  })
}

async function cerrarServicio(id) {
  return updateDoc(doc(db, 'serviciosEmpresariales', id), {
    activo: false,
    fechaCierre: format(new Date(), 'yyyy-MM-dd'),
  })
}

const MOTIVOS = [
  { value: 'auto_sustituto', label: 'Auto sustituto' },
  { value: 'renta_periodo',  label: 'Renta por periodo (días/semanas)' },
]
const MOTIVO_LABEL = Object.fromEntries(MOTIVOS.map(m => [m.value, m.label]))

// ── Modal nuevo servicio ───────────────────────────────────────
function NuevoServicioModal({ open, onClose }) {
  const { flota } = useFlota()
  const empty = {
    economico: '', empresa: '', placa: '', vehiculo: '',
    motivo: 'auto_sustituto', fechaInicio: format(new Date(), 'yyyy-MM-dd'),
    contratoMarco: '', contacto: '', notas: '',
  }
  const [form, setForm]   = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function aplicarExtraccion(datos) {
    setForm(f => ({
      ...f,
      economico: datos.economico || f.economico,
      empresa: datos.empresa || f.empresa,
      placa: datos.placa || f.placa,
      vehiculo: datos.vehiculo || f.vehiculo,
      contratoMarco: datos.contratoMarco || f.contratoMarco,
      fechaInicio: datos.fechaEntrega || f.fechaInicio,
    }))
  }

  async function handleSave() {
    if (!form.economico || !form.empresa || !form.fechaInicio) {
      setError('Económico, empresa y fecha de inicio son obligatorios.')
      return
    }
    setSaving(true)
    try {
      await addServicioEmpresarial(form)
      // Marcar la unidad como ocupada en la flota
      const unidad = flota.find(u => u.economico === form.economico)
      if (unidad) {
        await updateUnidad(unidad.id, {
          status: 'rentada',
          cliente: `${form.empresa} (${MOTIVO_LABEL[form.motivo]})`,
          hasta: 'Indefinido — ver Servicios Empresariales',
        })
      }
      setForm(empty)
      onClose()
    } catch (e) {
      setError('Error al guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo servicio empresarial">
      <div className="flex flex-col gap-4">

        <PdfUploader
          tipo="empresarial"
          label="Subir inventario/anexo en PDF (opcional)"
          onExtracted={aplicarExtraccion}
        />

        <div className="text-center text-xs text-gray-400 -my-1">— o captura manual abajo —</div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Económico">
            <input className="input" value={form.economico} onChange={e => set('economico', e.target.value)} placeholder="B09" />
          </Field>
          <Field label="Placa">
            <input className="input" value={form.placa} onChange={e => set('placa', e.target.value)} placeholder="KWR454A" />
          </Field>
        </div>

        <Field label="Vehículo (opcional)">
          <input className="input" value={form.vehiculo} onChange={e => set('vehiculo', e.target.value)} placeholder="Mitsubishi Montero Limited" />
        </Field>

        <Field label="Empresa">
          <input className="input" value={form.empresa} onChange={e => set('empresa', e.target.value)} placeholder="Humiclima México S.A. de C.V." />
        </Field>

        <Field label="Motivo del servicio">
          <select className="select" value={form.motivo} onChange={e => set('motivo', e.target.value)}>
            {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>

        <Field label="Fecha de inicio">
          <input className="input" type="date" value={form.fechaInicio} onChange={e => set('fechaInicio', e.target.value)} />
        </Field>

        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <p className="text-xs text-blue-700">
            No se captura fecha de término — la unidad queda marcada como ocupada hasta que presiones <strong>"Marcar como devuelto"</strong> el día que realmente regrese.
          </p>
        </div>

        <Field label="Contrato marco (si aplica)">
          <input className="input" value={form.contratoMarco} onChange={e => set('contratoMarco', e.target.value)} placeholder="Ej. 702" />
        </Field>

        <Field label="Contacto en la empresa (opcional)">
          <input className="input" value={form.contacto} onChange={e => set('contacto', e.target.value)} placeholder="Nombre y/o teléfono" />
        </Field>

        <Field label="Notas">
          <textarea className="input resize-none" rows={2} value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Instrucciones especiales…" />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
          <button className="btn-primary flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar servicio'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Tarjeta de servicio activo ──────────────────────────────────
function ServicioCard({ s }) {
  const { flota } = useFlota()
  const [closing, setClosing] = useState(false)

  async function handleCerrar() {
    setClosing(true)
    try {
      await cerrarServicio(s.id)
      const unidad = flota.find(u => u.economico === s.economico)
      if (unidad) {
        await updateUnidad(unidad.id, { status: 'disponible', cliente: '', hasta: '' })
      }
    } finally {
      setClosing(false)
    }
  }

  const dias = Math.floor((new Date() - new Date(s.fechaInicio)) / (1000 * 60 * 60 * 24))

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{s.economico}</span>
            <Badge color="amber">{MOTIVO_LABEL[s.motivo] ?? s.motivo}</Badge>
          </div>
          <p className="text-sm text-gray-700 mt-0.5">{s.empresa}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-400">desde</p>
          <p className="text-xs font-medium text-gray-700">{format(new Date(s.fechaInicio), 'd MMM yyyy', { locale: es })}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1"><Car size={12} />{s.vehiculo || '—'} {s.placa && `· ${s.placa}`}</span>
        <span className="flex items-center gap-1"><Clock size={12} />{dias} día{dias !== 1 ? 's' : ''} en servicio</span>
      </div>

      {s.contratoMarco && <p className="text-xs text-gray-400 mb-1">Contrato marco: {s.contratoMarco}</p>}
      {s.contacto && <p className="text-xs text-gray-400 mb-1">Contacto: {s.contacto}</p>}
      {s.notas && <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-2">⚠️ {s.notas}</p>}

      <button
        onClick={handleCerrar}
        disabled={closing}
        className="w-full mt-3 flex items-center justify-center gap-1.5 text-sm text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg py-2 transition-colors"
      >
        <CheckCircle2 size={15} />
        {closing ? 'Cerrando…' : 'Marcar como devuelto'}
      </button>
    </div>
  )
}

// ── Página ──────────────────────────────────────────────────────
export default function ServiciosEmpresariales() {
  const { servicios, loading } = useServiciosEmpresariales()
  const { can } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)

  const activos = useMemo(() => servicios.filter(s => s.activo), [servicios])
  const cerrados = useMemo(() => servicios.filter(s => !s.activo), [servicios])

  const porMotivo = useMemo(() => ({
    auto_sustituto: activos.filter(s => s.motivo === 'auto_sustituto').length,
    renta_periodo: activos.filter(s => s.motivo === 'renta_periodo').length,
  }), [activos])

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Servicios empresariales"
        subtitle="Auto sustituto y renta por periodo — clientes corporativos"
        action={can('admin') && (
          <button className="btn-primary flex items-center gap-1.5" onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Nuevo servicio
          </button>
        )}
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <KpiCard label="Unidades en servicio" value={activos.length} valueClass="text-amber-600" />
        <KpiCard label="Auto sustituto" value={porMotivo.auto_sustituto} />
        <KpiCard label="Renta por periodo" value={porMotivo.renta_periodo} />
      </div>

      {loading ? <Spinner /> : activos.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Sin servicios empresariales activos"
          description="Las unidades asignadas a clientes corporativos aparecerán aquí."
        />
      ) : (
        <div className="flex flex-col gap-3 mb-8">
          {activos.map(s => <ServicioCard key={s.id} s={s} />)}
        </div>
      )}

      {cerrados.length > 0 && (
        <>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Historial cerrado</p>
          <div className="flex flex-col gap-2">
            {cerrados.slice(0, 10).map(s => (
              <div key={s.id} className="card p-3 opacity-60">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-600">{s.economico} · {s.empresa}</span>
                  <span className="text-xs text-gray-400">
                    {format(new Date(s.fechaInicio), 'd MMM', { locale: es })} → {s.fechaCierre ? format(new Date(s.fechaCierre), 'd MMM', { locale: es }) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <NuevoServicioModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
