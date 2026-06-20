import { useEffect, useState } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, where
} from 'firebase/firestore'
import { db } from '../lib/firebase'

// ── Contratos ─────────────────────────────────────────────────
export function useContratos() {
  const [contratos, setContratos] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'contratos'), orderBy('fechaEntrega', 'asc'))
    const unsub = onSnapshot(q, snap => {
      setContratos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  return { contratos, loading }
}

export function useContratosHoy() {
  const { contratos, loading } = useContratos()
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1)

  const hoyContratos = contratos.filter(c => {
    const fe = c.fechaEntrega?.toDate?.() ?? new Date(c.fechaEntrega)
    const fd = c.fechaDevolucion?.toDate?.() ?? new Date(c.fechaDevolucion)
    return (fe >= hoy && fe < manana) || (fd >= hoy && fd < manana)
  })
  return { contratos: hoyContratos, loading }
}

export async function addContrato(data) {
  return addDoc(collection(db, 'contratos'), {
    ...data,
    creadoEn: serverTimestamp(),
    preparacion: { lavado: false, gasolina: false, ac: false, documentos: false },
  })
}

export async function updateContrato(id, data) {
  return updateDoc(doc(db, 'contratos', id), data)
}

export async function deleteContrato(id) {
  return deleteDoc(doc(db, 'contratos', id))
}

// ── Flota ─────────────────────────────────────────────────────
export function useFlota() {
  const [flota,   setFlota]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'flota'), orderBy('economico', 'asc'))
    const unsub = onSnapshot(q, snap => {
      setFlota(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  return { flota, loading }
}

export async function updateUnidad(id, data) {
  return updateDoc(doc(db, 'flota', id), data)
}

// ── Usuarios ──────────────────────────────────────────────────
export function useUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'usuarios'), snap => {
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  return { usuarios, loading }
}
