import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  CalendarDays, Wrench, Car, FileText, Users, LogOut, Menu, X, Settings
} from 'lucide-react'
import { useState } from 'react'

const nav = [
  { to: '/agenda',      label: 'Agenda',         icon: CalendarDays },
  { to: '/preparacion', label: 'Preparación',    icon: Wrench       },
  { to: '/flota',       label: 'Disponibilidad', icon: Car          },
  { to: '/contratos',   label: 'Contratos',      icon: FileText     },
]

function NavItem({ to, label, Icon, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-mango-50 text-mango-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  )
}

export default function Layout() {
  const { profile, logout, can } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-gray-50">

      {/* ── Sidebar desktop ── */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 fixed top-0 left-0 h-full z-20">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-mango-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">MM</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">Mayan Mango</p>
            <p className="text-xs text-gray-400 leading-tight truncate">Panel Operativo</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavItem key={to} to={to} label={label} Icon={Icon} />
          ))}
          {can('admin') && (
            <>
              <NavItem to="/usuarios"      label="Usuarios"       Icon={Users}    />
              <NavItem to="/configuracion" label="Configuración"  Icon={Settings} />
            </>
          )}
        </nav>

        {/* Profile + logout */}
        <div className="px-3 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2 px-2">
            <div className="w-7 h-7 rounded-full bg-mango-100 flex items-center justify-center flex-shrink-0">
              <span className="text-mango-700 text-xs font-medium">
                {profile?.name?.charAt(0)?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">{profile?.name ?? '—'}</p>
              <p className="text-xs text-gray-400 capitalize">{profile?.role ?? ''}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-100 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-mango-600 flex items-center justify-center">
            <span className="text-white text-xs font-semibold">MM</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">Mayan Mango</span>
        </div>
        <button onClick={() => setMobileOpen(v => !v)} className="p-2 rounded-lg hover:bg-gray-100">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/30"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute top-14 left-0 right-0 bg-white border-b border-gray-100 px-3 py-3 flex flex-col gap-0.5"
            onClick={e => e.stopPropagation()}
          >
            {nav.map(({ to, label, icon: Icon }) => (
              <NavItem key={to} to={to} label={label} Icon={Icon} onClick={() => setMobileOpen(false)} />
            ))}
            {can('admin') && (
              <>
                <NavItem to="/usuarios"      label="Usuarios"       Icon={Users}    onClick={() => setMobileOpen(false)} />
                <NavItem to="/configuracion" label="Configuración"  Icon={Settings} onClick={() => setMobileOpen(false)} />
              </>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 md:ml-56 pt-14 md:pt-0 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
