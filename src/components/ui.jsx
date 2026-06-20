import { Loader2 } from 'lucide-react'

export function Spinner({ className = 'h-8 w-8' }) {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className={`${className} animate-spin text-mango-500`} />
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      {Icon && <Icon size={36} className="text-gray-300 mb-4" />}
      <p className="text-base font-medium text-gray-700">{title}</p>
      {description && <p className="text-sm text-gray-400 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

export function KpiCard({ label, value, sub, valueClass = '' }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${valueClass || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export function Badge({ children, color = 'gray' }) {
  return <span className={`badge badge-${color}`}>{children}</span>
}

// Modal backdrop + dialog
export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-4 overflow-y-auto max-h-[80vh]">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

export function StatusDot({ status }) {
  const map = {
    disponible:    'bg-emerald-500',
    rentada:       'bg-orange-400',
    mantenimiento: 'bg-red-400',
    preparacion:   'bg-yellow-400',
  }
  return <span className={`inline-block w-2 h-2 rounded-full ${map[status] ?? 'bg-gray-300'}`} />
}
