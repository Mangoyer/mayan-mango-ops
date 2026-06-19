import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const AuthContext = createContext(null)

// Roles:  "admin" → acceso total (Yesenia)
//         "operador" → puede editar preparación y ver todo
//         "consulta" → solo lectura
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)   // Firebase user
  const [profile, setProfile] = useState(null)   // Firestore profile {name, role}
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        const snap = await getDoc(doc(db, 'usuarios', firebaseUser.uid))
        setProfile(snap.exists() ? snap.data() : { name: firebaseUser.email, role: 'consulta' })
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password)

  const logout = () => signOut(auth)

  const can = (action) => {
    if (!profile) return false
    if (profile.role === 'admin') return true
    if (profile.role === 'operador') return ['edit_prep', 'view'].includes(action)
    return action === 'view'
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
