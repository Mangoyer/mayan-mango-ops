import { useMemo } from 'react'
import { format, addDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, Circle, Droplets, Fuel, Wind, FileCheck } from 'lucide-react'
import { useContratos, updateContrato } from '../hooks/useFirestore'
import { useAuth } from '../contexts/AuthContext'
import { Spinner, KpiCard, Badge, PageHeader } from '../components/ui'

function dateOf(val) {
  if (!val) return null
  if (val?.toDate) return val.toDate()
  return new Date(val)
}

const CHECKS = [
  { key: 'lavado',      label: 'Lavado',      icon: Droplets  },
  { key: 'gasolina',    label: 'Gasolina',    icon: Fuel      },
  { key: 'ac',          label: 'A/C',          icon: Wind      },
  { key: 'documentos',  label: 'Documentos',  icon: FileCheck },
]

function CheckItem({ done, label, Icon, onClick, canEdit }) {
  return (
    <button
      disabled={!canEdit}
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
        done
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
      } ${!canEdit ? 'cursor-default' : 'cursor-pointer'}`}
    >
      {done
        ? <CheckCircle2 size={14} className="text-emerald-600" />
        : <Circle       size={14} className="text-gray-300" />
      }
      <Icon size={13} />
      {label}
    </button>
  )
}

export default function Preparacion() {
  const { contratos, loading } = useContratos()
  const { can } = useAuth()
  const canEdit = can('edit_prep') || can('admin')

  // Solo entregas en próximas 72 horas
  const ahora  = new Date()
  const limite = addDays(ahora, 3)

  const proximas = useMemo(() =>
    contratos
      .filter(c => {
        const fe = dateOf(c.fechaEntrega)
        return fe && fe >= ahora && fe <= limite
      })
      .sort((a, b) => dateOf(a.fechaEntrega) - dateOf(b.fechaEntrega)),
  [contratos])

  async function toggleCheck(contrato, key) {
    if (!canEdit) return
    const prev = contrato.preparacion?.[key] ?? false
    await updateContrato(contrato.id, {
      [`preparacion.${key}`]: !prev,
    })
  }

  // KPIs
  const total   = proximas.length
  const listas  = proximas.filter(c =>
    CHECKS.every(ch => c.preparacion?.[ch.key])
  ).length
  const enProceso = proximas.filter(c =>
    CHECKS.some(ch => c.preparacion?.[ch.key]) &&
    !CHECKS.every(ch => c.preparacion?.[ch.key])
  ).length
  const porEmpezar = total - listas - enProceso

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Preparación de unidades"
        subtitle="Vehículos a entregar en las próximas 72 horas"
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <KpiCard label="Por preparar"  value={porEmpezar}  valueClass="text-red-600" />
        <KpiCard label="En proceso"    value={enProceso}   valueClass="text-amber-600" />
        <KpiCard label="Listas ✓"      value={listas}      valueClass="text-emerald-600" />
      </div>

      {loading ? <Spinner /> : proximas.length === 0 ? (
        <div className="card p-8 text-center text-gray-400 text-sm">
          No hay entregas programadas en las próximas 72 horas.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {proximas.map(c => {
            const fe    = dateOf(c.fechaEntrega)
            const lista = CHECKS.every(ch => c.preparacion?.[ch.key])
            const done  = CHECKS.filter(ch => c.preparacion?.[ch.key]).length

            return (
              <div key={c.id} className={`card p-4 ${lista ? 'border-emerald-200' : ''}`}>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{c.vehiculo}</span>
                      <span className="text-xs text-gray-500">{c.placa}</span>
                      {c.urgente && <Badge color="red">Urgente</Badge>}
                      {lista && <Badge color="green">Lista ✓</Badge>}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{c.cliente} · {c.folio}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-medium text-gray-900">
                      {fe ? format(fe, "EEE d MMM", { locale: es }) : '—'}
                    </p>
                    <p className="text-xs text-gray-400">{c.hora || '—'}</p>
                  </div>
                </div>

                {/* Lugar */}
                <p className="text-xs text-gray-400 mb-3">📍 {c.lugarEntrega}</p>

                {/* Checks */}
                <div className="flex gap-2 flex-wrap">
                  {CHECKS.map(({ key, label, icon: Icon }) => (
                    <CheckItem
                      key={key}
                      done={c.preparacion?.[key] ?? false}
                      label={label}
                      Icon={Icon}
                      canEdit={canEdit}
                      onClick={() => toggleCheck(c, key)}
                    />
                  ))}
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-400">Progreso</span>
                    <span className="text-xs font-medium text-gray-600">{done}/{CHECKS.length}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${lista ? 'bg-emerald-500' : 'bg-mango-500'}`}
                      style={{ width: `${(done / CHECKS.length) * 100}%` }}
                    />
                  </div>
                </div>

                {c.notas && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 mt-3">
                    ⚠️ {c.notas}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
