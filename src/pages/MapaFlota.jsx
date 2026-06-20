import { useState, useMemo, useEffect } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths,
  isSameDay, isWeekend, getDate,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plane } from 'lucide-react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useContratos, useFlota } from '../hooks/useFirestore'
import { PageHeader, Spinner } from '../components/ui'
import { Link } from 'react-router-dom'

function dateOf(val) {
  if (!val) return null
  if (val?.toDate) return val.toDate()
  return new Date(val)
}

function useServiciosEmpresariales() {
  const [servicios, setServicios] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'serviciosEmpresariales'), snap => {
      setServicios(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])
  return { servicios, loading }
}

function construirBarras({ contratos, servicios, mesInicio, mesFin }) {
  const porEconomico = {}

  function add(economico, barra) {
    if (!economico) return
    if (!porEconomico[economico]) porEconomico[economico] = []
    porEconomico[economico].push(barra)
  }

  contratos.forEach(c => {
    const fe = dateOf(c.fechaEntrega)
    const fd = dateOf(c.fechaDevolucion) ?? fe
    if (!fe) return
    if (fd < mesInicio || fe > mesFin) return
    add(c.economico || c.placa, {
      tipo: 'turistico',
      inicio: fe < mesInicio ? mesInicio : fe,
      fin: fd > mesFin ? mesFin : fd,
      label: `${c.folio} · ${c.cliente}`,
      urgente: c.urgente,
      esTraslado: c.tipoServicioEntrega === 'traslado',
      linkId: c.id,
    })
  })

  servicios.forEach(s => {
    if (!s.activo && !s.fechaCierre) return
    const inicio = s.fechaInicio ? new Date(s.fechaInicio) : null
    if (!inicio) return
    const fin = s.fechaCierre ? new Date(s.fechaCierre) : (s.activo ? mesFin : inicio)
    if (fin < mesInicio || inicio > mesFin) return
    add(s.economico, {
      tipo: 'empresarial',
      inicio: inicio < mesInicio ? mesInicio : inicio,
      fin: fin > mesFin ? mesFin : fin,
      label: `${s.empresa}`,
      abierto: s.activo,
      motivo: s.motivo,
    })
  })

  return porEconomico
}

const COLOR = {
  turistico:   { bar: 'bg-orange-400' },
  empresarial: { bar: 'bg-amber-400' },
}

export default function MapaFlota() {
  const { contratos, loading: loadingContratos } = useContratos()
  const { flota, loading: loadingFlota } = useFlota()
  const { servicios, loading: loadingServicios } = useServiciosEmpresariales()
  const [mesRef, setMesRef] = useState(new Date())

  const mesInicio = startOfMonth(mesRef)
  const mesFin = endOfMonth(mesRef)
  const dias = eachDayOfInterval({ start: mesInicio, end: mesFin })
  const hoy = new Date()

  const barrasPorUnidad = useMemo(
    () => construirBarras({ contratos, servicios, mesInicio, mesFin }),
    [contratos, servicios, mesInicio, mesFin]
  )

  const loading = loadingContratos || loadingFlota || loadingServicios
  const totalDias = dias.length

  function posicion(fecha) {
    const dia = getDate(fecha) - 1
    return (dia / totalDias) * 100
  }
  function ancho(inicio, fin) {
    const diasOcupados = Math.max(1, getDate(fin) - getDate(inicio) + 1)
    return (diasOcupados / totalDias) * 100
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Mapa de flota"
        subtitle="Disponibilidad mensual — turístico y empresarial"
      />

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMesRef(m => addMonths(m, -1))}
          className="btn-secondary flex items-center gap-1.5"
        >
          <ChevronLeft size={15} /> Anterior
        </button>
        <span className="text-sm font-semibold text-gray-900 capitalize">
          {format(mesRef, "MMMM yyyy", { locale: es })}
        </span>
        <button
          onClick={() => setMesRef(m => addMonths(m, 1))}
          className="btn-secondary flex items-center gap-1.5"
        >
          Siguiente <ChevronRight size={15} />
        </button>
      </div>

      <div className="flex items-center gap-4 mb-4 flex-wrap text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-400 inline-block" /> Turístico</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Empresarial</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-red-400 inline-block" /> Urgente</span>
        <span className="flex items-center gap-1.5"><Plane size={12} /> Con traslado</span>
      </div>

      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <div style={{ minWidth: Math.max(600, totalDias * 32) }}>

            <div className="flex border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="w-28 flex-shrink-0 px-2 py-2 text-xs font-medium text-gray-400">Unidad</div>
              <div className="flex-1 flex relative">
                {dias.map(d => (
                  <div
                    key={d.toISOString()}
                    className={`flex-1 text-center py-2 text-[10px] border-l border-gray-50 ${
                      isSameDay(d, hoy) ? 'bg-mango-50 text-mango-700 font-semibold' :
                      isWeekend(d) ? 'text-gray-300' : 'text-gray-400'
                    }`}
                  >
                    {getDate(d)}
                  </div>
                ))}
              </div>
            </div>

            {flota.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No hay unidades cargadas en la flota todavía.
              </div>
            ) : flota.map(u => {
              const barras = barrasPorUnidad[u.economico] ?? []
              return (
                <div key={u.id} className="flex border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <div className="w-28 flex-shrink-0 px-2 py-2.5 flex flex-col">
                    <span className="text-xs font-semibold text-gray-800">{u.economico}</span>
                    <span className="text-[10px] text-gray-400 truncate">{u.modelo?.split(' ').slice(0,2).join(' ')}</span>
                  </div>
                  <div className="flex-1 relative" style={{ minHeight: 38 }}>
                    <div className="absolute inset-0 flex">
                      {dias.map(d => (
                        <div key={d.toISOString()} className={`flex-1 border-l border-gray-50 ${isSameDay(d, hoy) ? 'bg-mango-50/40' : ''}`} />
                      ))}
                    </div>
                    {barras.map((b, i) => {
                      const c = COLOR[b.tipo]
                      const left = posicion(b.inicio)
                      const width = ancho(b.inicio, b.fin)
                      const content = (
                        <div
                          className={`absolute top-1.5 h-5 rounded ${c.bar} ${b.urgente ? 'ring-2 ring-red-400' : ''} flex items-center px-1.5 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity`}
                          style={{ left: `${left}%`, width: `${width}%`, minWidth: 18 }}
                          title={b.label}
                        >
                          {b.esTraslado && <Plane size={9} className="text-white flex-shrink-0 mr-0.5" />}
                          <span className="text-[9px] text-white font-medium truncate">{b.label}</span>
                        </div>
                      )
                      return b.linkId ? (
                        <Link key={i} to={`/contratos/${b.linkId}`}>{content}</Link>
                      ) : (
                        <div key={i}>{content}</div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Toca una barra de turístico para abrir el contrato. Las barras de empresarial sin fecha de cierre se extienden hasta hoy.
      </p>
    </div>
  )
}
