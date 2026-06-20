import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { PageHeader, Field, Spinner } from '../components/ui'
import { Plus, Trash2, Save, MessageCircle, Calendar, CheckCircle2 } from 'lucide-react'

function NumeroItem({ numero, onDelete }) {
  return (
    <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
      <MessageCircle size={14} className="text-green-600 flex-shrink-0" />
      <span className="text-sm text-gray-800 flex-1 font-mono">{numero}</span>
      <button onClick={() => onDelete(numero)} className="text-gray-400 hover:text-red-500 transition-colors">
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export default function Configuracion() {
  const { can } = useAuth()
  if (!can('admin')) return <Navigate to="/agenda" replace />

  const [numeros,   setNumeros]   = useState([])
  const [nuevo,     setNuevo]     = useState('')
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [calId,     setCalId]     = useState('')
  const [calSaved,  setCalSaved]  = useState(false)

  useEffect(() => {
    Promise.all([
      getDoc(doc(db, 'config', 'whatsapp')),
      getDoc(doc(db, 'config', 'gcalendar')),
    ]).then(([wa, gc]) => {
      if (wa.exists())  setNumeros(wa.data().numeros ?? [])
      if (gc.exists())  setCalId(gc.data().calendarId ?? '')
      setLoading(false)
    })
  }, [])

  function agregarNumero() {
    const n = nuevo.trim()
    if (!n) return
    // Formato internacional +52...
    const clean = n.startsWith('+') ? n : `+${n}`
    if (numeros.includes(clean)) return
    setNumeros(v => [...v, clean])
    setNuevo('')
  }

  function eliminarNumero(n) {
    setNumeros(v => v.filter(x => x !== n))
  }

  async function guardarWhatsApp() {
    setSaving(true)
    await setDoc(doc(db, 'config', 'whatsapp'), { numeros })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function guardarCalendar() {
    setSaving(true)
    await setDoc(doc(db, 'config', 'gcalendar'), { calendarId: calId.trim() })
    setSaving(false)
    setCalSaved(true)
    setTimeout(() => setCalSaved(false), 2500)
  }

  if (loading) return <Spinner />

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Configuración"
        subtitle="WhatsApp, Google Calendar y notificaciones"
      />

      {/* ── WhatsApp ─────────────────────────────────────── */}
      <div className="card p-5 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle size={16} className="text-green-600" />
          <h2 className="text-sm font-semibold text-gray-900">Números de WhatsApp</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Estos números recibirán notificaciones automáticas de contratos nuevos,
          urgentes y recordatorios de entrega. Formato internacional: <code className="bg-gray-100 px-1 rounded">+521234567890</code>
        </p>

        <div className="flex flex-col gap-2 mb-3">
          {numeros.length === 0
            ? <p className="text-xs text-gray-400 italic py-2">Sin números configurados.</p>
            : numeros.map(n => (
                <NumeroItem key={n} numero={n} onDelete={eliminarNumero} />
              ))
          }
        </div>

        {/* Agregar número */}
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="+521234567890"
            value={nuevo}
            onChange={e => setNuevo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && agregarNumero()}
          />
          <button className="btn-secondary flex items-center gap-1" onClick={agregarNumero}>
            <Plus size={15} /> Agregar
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            className="btn-primary flex items-center gap-1.5"
            onClick={guardarWhatsApp}
            disabled={saving}
          >
            {saved
              ? <><CheckCircle2 size={14} /> Guardado</>
              : <><Save size={14} /> Guardar números</>
            }
          </button>
          {saved && <span className="text-xs text-emerald-600">✓ Cambios guardados</span>}
        </div>

        {/* Instrucciones Twilio */}
        <div className="mt-5 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-800 mb-2">¿Cómo configurar Twilio (WhatsApp)?</p>
          <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
            <li>Crea cuenta gratis en <strong>twilio.com</strong></li>
            <li>Activa el <strong>WhatsApp Sandbox</strong> en Twilio Console</li>
            <li>En Firebase Console → Functions → Secrets, agrega:
              <ul className="ml-4 mt-1 space-y-0.5 list-disc">
                <li><code className="bg-blue-100 px-1 rounded">TWILIO_SID</code> → Account SID de Twilio</li>
                <li><code className="bg-blue-100 px-1 rounded">TWILIO_TOKEN</code> → Auth Token de Twilio</li>
                <li><code className="bg-blue-100 px-1 rounded">TWILIO_FROM</code> → <code>whatsapp:+14155238886</code> (sandbox)</li>
              </ul>
            </li>
            <li>Cada número debe enviar el código sandbox a Twilio la primera vez</li>
            <li>Para producción, solicita el número WhatsApp Business en Twilio</li>
          </ol>
        </div>
      </div>

      {/* ── Google Calendar ───────────────────────────────── */}
      <div className="card p-5 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Calendar size={16} className="text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Google Calendar</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Cada contrato nuevo crea automáticamente un evento en el calendario compartido del equipo.
          Los cambios y cancelaciones se sincronizan en tiempo real.
        </p>

        <Field label="ID del calendario de Google">
          <input
            className="input font-mono text-xs"
            placeholder="abc123@group.calendar.google.com"
            value={calId}
            onChange={e => setCalId(e.target.value)}
          />
        </Field>

        <div className="mt-4 flex items-center gap-3">
          <button
            className="btn-primary flex items-center gap-1.5"
            onClick={guardarCalendar}
            disabled={saving}
          >
            {calSaved
              ? <><CheckCircle2 size={14} /> Guardado</>
              : <><Save size={14} /> Guardar Calendar ID</>
            }
          </button>
          {calSaved && <span className="text-xs text-emerald-600">✓ Guardado</span>}
        </div>

        {/* Instrucciones Google Calendar */}
        <div className="mt-5 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-800 mb-2">¿Cómo conectar Google Calendar?</p>
          <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
            <li>Ve a <strong>console.cloud.google.com</strong> → crea proyecto</li>
            <li>Activa la API de Google Calendar</li>
            <li>Crea una <strong>Cuenta de servicio</strong> → descarga el JSON de credenciales</li>
            <li>En Firebase Secrets agrega: <code className="bg-blue-100 px-1 rounded">GCAL_SA_JSON</code> con el contenido del JSON</li>
            <li>En Google Calendar → tu calendario → Compartir con personas → agrega el email de la cuenta de servicio con permisos de edición</li>
            <li>Copia el ID del calendario (formato <code>xxx@group.calendar.google.com</code>) y pégalo aquí</li>
            <li>En Firebase Secrets agrega: <code className="bg-blue-100 px-1 rounded">GCAL_ID</code> con ese mismo ID</li>
          </ol>
        </div>

        {/* Vista previa de cómo se verá el evento */}
        <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-xs font-semibold text-gray-600 mb-2">Vista previa del evento en Calendar:</p>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-400 flex-shrink-0"></div>
              <span className="text-xs font-medium text-gray-800">🚗 F-747 — James Whitfield</span>
            </div>
            <p className="text-xs text-gray-500 ml-4">Vehículo: Mitsubishi Xpander (PLR-0812)</p>
            <p className="text-xs text-gray-500 ml-4">Entrega: Aeropuerto CUN T2</p>
            <p className="text-xs text-gray-500 ml-4">Devolución: 25 Jun — Hotel Riu Tulum</p>
            <p className="text-xs text-gray-400 ml-4 mt-1">🔔 Recordatorio: 2h antes · 30 min antes</p>
          </div>
        </div>
      </div>

      {/* ── Qué dispara cada notificación ─────────────────── */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Resumen de notificaciones automáticas</h2>
        <div className="space-y-2">
          {[
            { emoji: '🆕', evento: 'Contrato nuevo',              cuando: 'Inmediato al guardar' },
            { emoji: '🚨', evento: 'Contrato marcado urgente',     cuando: 'Inmediato al editar' },
            { emoji: '☀️', evento: 'Agenda del día',               cuando: 'Todos los días 6:00 AM' },
            { emoji: '⏰', evento: 'Recordatorio 2h antes',        cuando: 'Automático por entrega' },
            { emoji: '📅', evento: 'Evento en Google Calendar',    cuando: 'Al crear / editar / borrar' },
          ].map(r => (
            <div key={r.evento} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <span className="text-base">{r.emoji}</span>
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-800">{r.evento}</p>
                <p className="text-xs text-gray-400">{r.cuando}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
