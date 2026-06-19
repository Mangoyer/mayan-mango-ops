import { useUsuarios } from '../hooks/useFirestore'
import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { Spinner, PageHeader, Badge } from '../components/ui'
import { Users } from 'lucide-react'

const ROLE_COLOR = { admin: 'orange', operador: 'blue', consulta: 'gray' }
const ROLE_LABEL = { admin: 'Admin', operador: 'Operador', consulta: 'Consulta' }

export default function Usuarios() {
  const { can }              = useAuth()
  const { usuarios, loading } = useUsuarios()

  if (!can('admin')) return <Navigate to="/agenda" replace />

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Usuarios"
        subtitle="Equipo con acceso al panel"
      />

      <div className="card p-4 mb-6 text-sm text-gray-600">
        <p className="font-medium mb-2">Cómo crear nuevos usuarios:</p>
        <ol className="list-decimal list-inside space-y-1 text-gray-500 text-xs">
          <li>Ve a <strong>Firebase Console → Authentication → Add user</strong></li>
          <li>Ingresa el correo y contraseña del colaborador</li>
          <li>Copia el UID generado</li>
          <li>Ve a <strong>Firestore → colección "usuarios"</strong> y crea un documento con ese UID</li>
          <li>Campos: <code className="bg-gray-100 px-1 rounded">name</code>, <code className="bg-gray-100 px-1 rounded">role</code> (admin / operador / consulta)</li>
        </ol>
      </div>

      {loading ? <Spinner /> : (
        <div className="flex flex-col gap-2">
          {usuarios.map(u => (
            <div key={u.id} className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-mango-100 flex items-center justify-center flex-shrink-0">
                <span className="text-mango-700 text-sm font-medium">
                  {u.name?.charAt(0)?.toUpperCase() ?? '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{u.name}</p>
                <p className="text-xs text-gray-400">{u.email ?? u.id}</p>
              </div>
              <Badge color={ROLE_COLOR[u.role] ?? 'gray'}>
                {ROLE_LABEL[u.role] ?? u.role}
              </Badge>
            </div>
          ))}
          {usuarios.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">
              <Users size={32} className="mx-auto mb-3 text-gray-200" />
              No hay usuarios registrados aún.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
