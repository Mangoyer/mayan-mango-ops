import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { generarAgendaDia, generarAgendaSemana, generarHojaRuta } from '../lib/pdf'
import { startOfWeek } from 'date-fns'

// ── Botón PDF agenda del día ──────────────────────────────────
export function BtnAgendaDia({ contratos, fecha }) {
  const [loading, setLoading] = useState(false)
  async function handle() {
    setLoading(true)
    try { await generarAgendaDia(contratos, fecha ?? new Date()) }
    finally { setLoading(false) }
  }
  return (
    <button onClick={handle} disabled={loading}
      className="btn-secondary flex items-center gap-1.5 text-xs">
      {loading
        ? <Loader2 size={13} className="animate-spin" />
        : <FileDown size={13} />}
      PDF día
    </button>
  )
}

// ── Botón PDF agenda semanal ──────────────────────────────────
export function BtnAgendaSemana({ contratos }) {
  const [loading, setLoading] = useState(false)
  async function handle() {
    setLoading(true)
    const lunes = startOfWeek(new Date(), { weekStartsOn: 1 })
    try { await generarAgendaSemana(contratos, lunes) }
    finally { setLoading(false) }
  }
  return (
    <button onClick={handle} disabled={loading}
      className="btn-secondary flex items-center gap-1.5 text-xs">
      {loading
        ? <Loader2 size={13} className="animate-spin" />
        : <FileDown size={13} />}
      PDF semana
    </button>
  )
}

// ── Botón hoja de ruta (para ContratoDetalle) ─────────────────
export function BtnHojaRuta({ contrato }) {
  const [loading, setLoading] = useState(false)
  async function handle() {
    setLoading(true)
    try { await generarHojaRuta(contrato) }
    finally { setLoading(false) }
  }
  return (
    <button onClick={handle} disabled={loading}
      className="btn-secondary flex items-center gap-1.5">
      {loading
        ? <Loader2 size={14} className="animate-spin" />
        : <FileDown size={14} />}
      Hoja de ruta PDF
    </button>
  )
}
