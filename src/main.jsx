import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login       from './pages/Login'
import Layout      from './components/Layout'
import Agenda      from './pages/Agenda'
import Preparacion from './pages/Preparacion'
import Flota       from './pages/Flota'
import Contratos   from './pages/Contratos'
import ContratoDetalle from './pages/ContratoDetalle'
import Usuarios    from './pages/Usuarios'
import Configuracion from './pages/Configuracion'
import ServiciosEmpresariales from './pages/ServiciosEmpresariales'
import MapaFlota from './pages/MapaFlota'
import './index.css'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-mango-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Cargando…</span>
      </div>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
            <Route index           element={<Navigate to="/agenda" replace />} />
            <Route path="agenda"   element={<Agenda />} />
            <Route path="preparacion" element={<Preparacion />} />
            <Route path="flota"    element={<Flota />} />
            <Route path="contratos" element={<Contratos />} />
            <Route path="contratos/:id" element={<ContratoDetalle />} />
            <Route path="empresarial" element={<ServiciosEmpresariales />} />
            <Route path="mapa" element={<MapaFlota />} />
            <Route path="usuarios"  element={<Usuarios />} />
            <Route path="configuracion" element={<Configuracion />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
