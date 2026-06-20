import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Trash2, Edit2, MapPin, Clock, Car, Phone, Mail, AlertCircle, Plane } from 'lucide-react'
import { db } from '../lib/firebase'
import { updateContrato, deleteContrato } from '../hooks/useFirestore'
import { useAuth } from '../contexts/AuthContext'
import { Spinner, Badge, Modal, Field } from '../components/ui'
import { BtnHojaRuta } from '../components/PdfButtons'

function dateOf(val) {
  if (!val) return null
  if (val?.toDate) return val.toDate()
  return new Date(val)
}

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

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <Icon size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-gray-400 leading-none mb-0.5">{label}</p>
        <p className="text-sm text-gray-800">{value}</p>
      </div>
    </div>
  )
}

export default function ContratoDetalle() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const { can }     = useAuth()
  const canAdmin    = can('admin')

  const [contrato,   setContrato]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [editOpen,   setEditOpen]   = useState(false)
  const [deleteConf, setDeleteConf] = useState(false)
  const [form,       setForm]       = useState({})

  useEffect(() => {
    getDoc(doc(db, 'contratos', id)).then(snap => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() }
        setContrato(data)
        setForm({
          folio:               data.folio               ?? '',
          cliente:             data.cliente              ?? '',
          telefono:            data.telefono              ?? '',
          email:               data.email                 ?? '',
          vehiculo:            data.vehiculo              ?? VEHICULOS[0],
          placa:               data.placa                 ?? '',
          fechaEntrega:        data.fechaEntrega          ?? '',
          hora:                data.hora                  ?? '',
          tipoServicioEntrega: data.tipoServicioEntrega    ?? 'directo',
          lugarEntrega:        data.lugarEntrega           ?? PUNTOS[0],
          vueloAerolinea:      data.vuelo?.aerolinea       ?? '',
          vueloNumero:         data.vuelo?.numero          ?? '',
          vueloHoraLlegada:    data.vuelo?.horaLlegada     ?? '',
          fechaDevolucion:     data.fechaDevolucion        ?? '',
          lugarDevolucion:     data.lugarDevolucion        ?? PUNTOS[0],
          notas:               data.notas                  ?? '',
          urgente:             data.urgente                ?? false,
        })
      }
      setLoading(false)
    })
  }, [id])

  async function handleSave() {
    const payload = {
      folio: form.folio,
      cliente: form.cliente,
      telefono: form.telefono,
      email: form.email,
      vehiculo: form.vehiculo,
      placa: form.placa,
      fechaEntrega: form.fechaEntrega,
      hora: form.hora,
      tipoServicioEntrega: form.tipoServicioEntrega,
      lugarEntrega: form.lugarEntrega,
      vuelo: form.tipoServicioEntrega === 'traslado' ? {
        aerolinea: form.vueloAerolinea,
        numero: form.vueloNumero,
        horaLlegada: form.vueloHoraLlegada,
      } : null,
      fechaDevolucion: form.fechaDevolucion,
      lugarDevolucion: form.lugarDevolucion,
      notas: form.notas,
      urgente: form.urgente,
    }
    await updateContrato(id, payload)
    setContrato(c => ({ ...c, ...payload }))
    setEditOpen(false)
  }

  async function handleDelete() {
    await deleteContrato(id)
    navigate('/contratos')
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  if (loading)    return <Spinner />
  if (!contrato)  return <div className="p-6 text-gray-400">Contrato no encontrado.</div>

  const fe = dateOf(contrato.fechaEntrega)
  const fd = dateOf(contrato.fechaDevolucion)
  const esTraslado = contrato.tipoServicioEntrega === 'traslado'

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5"
      >
        <ArrowLeft size={16} /> Volver
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-gray-900">{contrato.folio}</h1>
            {esTraslado && <Badge color="blue">✈️ Traslado</Badge>}
            {contrato.urgente && <Badge color="red">Urgente</Badge>}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{contrato.cliente}</p>
        </div>
        {canAdmin && (
          <div className="flex gap-2 flex-wrap items-center">
            <BtnHojaRuta contrato={contrato} />
            <button className="btn-ghost" onClick={() => setEditOpen(true)}>
              <Edit2 size={15} />
            </button>
            <button
              className="btn-ghost text-red-500 hover:bg-red-50"
              onClick={() => setDeleteConf(true)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Contacto del cliente */}
      {(contrato.telefono || contrato.email) && (
        <div className="card p-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contacto del cliente</p>
          <InfoRow icon={Phone} label="Teléfono" value={contrato.telefono} />
          <InfoRow icon={Mail}  label="Email"    value={contrato.email} />
        </div>
      )}

      {/* Info del servicio */}
      <div className="card p-4 mb-4">
        <InfoRow icon={Car}     label="Vehículo"            value={`${contrato.vehiculo} · ${contrato.placa}`} />
        <InfoRow icon={Clock}   label="Fecha de entrega"    value={fe ? format(fe, "EEEE d 'de' MMMM yyyy", { locale: es }) + (contrato.hora ? ` — ${contrato.hora}` : '') : null} />
        <InfoRow icon={MapPin}  label={esTraslado ? 'Punto de entrega final' : 'Lugar de entrega'} value={contrato.lugarEntrega} />
        {esTraslado && contrato.vuelo && (
          <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
            <Plane size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400 leading-none mb-0.5">Vuelo del cliente</p>
              <p className="text-sm text-gray-800">
                {contrato.vuelo.aerolinea} {contrato.vuelo.numero}
                {contrato.vuelo.horaLlegada && ` — llega ${contrato.vuelo.horaLlegada}`}
              </p>
            </div>
          </div>
        )}
        <InfoRow icon={Clock}   label="Fecha de devolución" value={fd ? format(fd, "EEEE d 'de' MMMM yyyy", { locale: es }) : null} />
        <InfoRow icon={MapPin}  label="Lugar de devolución" value={contrato.lugarDevolucion} />
        {contrato.notas && (
          <InfoRow icon={AlertCircle} label="Notas" value={contrato.notas} />
        )}
      </div>

      {/* Preparación */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Preparación</p>
        {['lavado','gasolina','ac','documentos'].map(k => (
          <div key={k} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <span className="text-sm text-gray-700 capitalize">{k}</span>
            <span className={`text-xs font-medium ${contrato.preparacion?.[k] ? 'text-emerald-600' : 'text-gray-400'}`}>
              {contrato.preparacion?.[k] ? '✓ Listo' : 'Pendiente'}
            </span>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Editar ${contrato.folio}`}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Folio">
              <input className="input" value={form.folio} onChange={e => set('folio', e.target.value)} />
            </Field>
            <Field label="Urgente">
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={form.urgente} onChange={e => set('urgente', e.target.checked)} className="accent-mango-600 w-4 h-4" />
                <span className="text-sm text-gray-700">Sí</span>
              </label>
            </Field>
          </div>

          <Field label="Cliente">
            <input className="input" value={form.cliente} onChange={e => set('cliente', e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono del cliente">
              <input className="input" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+1 555 123 4567" />
            </Field>
            <Field label="Email del cliente">
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Vehículo">
              <select className="select" value={form.vehiculo} onChange={e => set('vehiculo', e.target.value)}>
                {VEHICULOS.map(v => <option key={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Placa">
              <input className="input" value={form.placa} onChange={e => set('placa', e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha entrega">
              <input className="input" type="date" value={form.fechaEntrega} onChange={e => set('fechaEntrega', e.target.value)} />
            </Field>
            <Field label="Hora">
              <input className="input" type="time" value={form.hora} onChange={e => set('hora', e.target.value)} />
            </Field>
          </div>

          <Field label="Tipo de servicio">
            <select className="select" value={form.tipoServicioEntrega} onChange={e => set('tipoServicioEntrega', e.target.value)}>
              {TIPO_SERVICIO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>

          <Field label={form.tipoServicioEntrega === 'traslado' ? 'Punto de entrega final' : 'Lugar de entrega'}>
            <select className="select" value={form.lugarEntrega} onChange={e => set('lugarEntrega', e.target.value)}>
              {PUNTOS.map(l => <option key={l}>{l}</option>)}
            </select>
          </Field>

          {form.tipoServicioEntrega === 'traslado' && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex flex-col gap-3">
              <p className="text-xs font-semibold text-blue-800">✈️ Datos del vuelo</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Aerolínea">
                  <input className="input" value={form.vueloAerolinea} onChange={e => set('vueloAerolinea', e.target.value)} />
                </Field>
                <Field label="Número de vuelo">
                  <input className="input" value={form.vueloNumero} onChange={e => set('vueloNumero', e.target.value)} />
                </Field>
              </div>
              <Field label="Hora de llegada">
                <input className="input" type="time" value={form.vueloHoraLlegada} onChange={e => set('vueloHoraLlegada', e.target.value)} />
              </Field>
            </div>
          )}

          <Field label="Fecha devolución">
            <input className="input" type="date" value={form.fechaDevolucion} onChange={e => set('fechaDevolucion', e.target.value)} />
          </Field>
          <Field label="Lugar devolución">
            <select className="select" value={form.lugarDevolucion} onChange={e => set('lugarDevolucion', e.target.value)}>
              {PUNTOS.map(l => <option key={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Notas">
            <textarea className="input resize-none" rows={2} value={form.notas} onChange={e => set('notas', e.target.value)} />
          </Field>
          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setEditOpen(false)}>Cancelar</button>
            <button className="btn-primary flex-1" onClick={handleSave}>Guardar cambios</button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={deleteConf} onClose={() => setDeleteConf(false)} title="¿Eliminar contrato?">
        <p className="text-sm text-gray-600 mb-5">
          Esta acción no se puede deshacer. ¿Seguro que quieres eliminar el contrato <strong>{contrato.folio}</strong>?
        </p>
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={() => setDeleteConf(false)}>Cancelar</button>
          <button
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg text-sm"
            onClick={handleDelete}
          >
            Sí, eliminar
          </button>
        </div>
      </Modal>
    </div>
  )
}
