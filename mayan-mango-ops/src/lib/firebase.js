// ─────────────────────────────────────────────────────────────
//  INSTRUCCIONES: Reemplaza los valores de abajo con los datos
//  de tu proyecto Firebase (los encuentras en Firebase Console
//  → Configuración del proyecto → Tus apps → SDK de Firebase).
// ─────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app'
import { getFirestore }   from 'firebase/firestore'
import { getAuth }        from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyCS_z3pT2ybgd0tCUFlVlNSqdGC2x3GZ_o",
  authDomain: "mayan-mango-ops.firebaseapp.com",
  projectId: "mayan-mango-ops",
  storageBucket: "mayan-mango-ops.firebasestorage.app",
  messagingSenderId: "440785553420",
  appId: "1:440785553420:web:0e55d0f01481c9f0574629"
}; 

const app = initializeApp(firebaseConfig)
export const db   = getFirestore(app)
export const auth = getAuth(app)
