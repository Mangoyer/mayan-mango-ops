import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Search, ChevronRight, FileText } from 'lucide-react'
import { useContratos } from '../hooks/useFirestore'
import { Spinner, Badge, PageHeader, EmptyState } from '../components/ui'

function dateOf(val) {
  if (!val) return null
  if (val?.toDate) return val.toDate()
  return new Date(val)
}

export default function Contratos() {
  const { contratos, loading } = useContratos()
  const [busqueda, setBusqueda] = useState('')

  const filtered = useMemo(() => {
    if (!busqueda) return contratos
    const q = busqueda.toLowerCase()
    return contratos.filter(c =>
      (c.folio + c.cliente + c.vehiculo + c.placa).toLowerCase().includes(q)
    )
  }, [contratos, busqueda])

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Contratos"
        subtitle={`${contratos.length} contratos registrados`}
      />

      <div className="relative mb-5">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Buscar por folio, cliente, vehículo…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Sin contratos" description="No hay contratos que coincidan." />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(c => {
            const fe = dateOf(c.fechaEntrega)
            const fd = dateOf(c.fechaDevolucion)
            return (
              <Link key={c.id} to={`/contratos/${c.id}`} className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-mango-50 flex items-center justify-center">
                  <FileText size={16} className="text-mango-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{c.folio}</span>
                    {c.urgente && <Badge color="red">Urgente</Badge>}
                  </div>
                  <p className="text-sm text-gray-600 truncate">{c.cliente}</p>
                  <p className="text-xs text-gray-400">{c.vehiculo} · {c.placa}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {fe && <p className="text-xs text-gray-600 font-medium">{format(fe, 'd MMM', { locale: es })}</p>}
                  {fd && <p className="text-xs text-gray-400">dev. {format(fd, 'd MMM', { locale: es })}</p>}
                </div>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
