# Mayan Mango — Panel Operativo

App web React + Firebase para gestión de contratos, preparación de flota y disponibilidad.

---

## Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Base de datos**: Firebase Firestore (tiempo real)
- **Autenticación**: Firebase Authentication (email/contraseña)
- **Hosting**: Vercel (gratis)

---

## Guía de despliegue paso a paso

### 1. Crear proyecto en Firebase (gratis)

1. Ve a https://console.firebase.google.com
2. Clic en **"Agregar proyecto"** → nombre: `mayan-mango-ops`
3. Deshabilita Google Analytics (no es necesario) → **Crear proyecto**

### 2. Habilitar Authentication

1. En el menú lateral: **Build → Authentication**
2. Clic en **Comenzar**
3. Pestaña **Sign-in method** → habilitar **Correo electrónico/contraseña**

### 3. Crear base de datos Firestore

1. **Build → Firestore Database**
2. Clic en **Crear base de datos**
3. Selecciona **Modo de producción** → elige región `us-central` → Listo

### 4. Subir reglas de seguridad

1. En Firestore → pestaña **Reglas**
2. Pega el contenido de `firestore.rules` de este proyecto
3. Clic en **Publicar**

### 5. Conectar la app a Firebase

1. En Firebase Console → **Configuración del proyecto** (ícono engranaje)
2. Sección **Tus apps** → clic en `</>` (web)
3. Nombre: `mayan-mango-web` → **Registrar app**
4. Copia el objeto `firebaseConfig` que aparece
5. Abre `src/lib/firebase.js` y reemplaza los valores con los tuyos

### 6. Crear tu primer usuario (tú, como admin)

1. Firebase Console → **Authentication → Usuarios → Agregar usuario**
2. Correo: `yesenia@mayanmango.com` | Contraseña: la que elijas
3. Copia el **UID** que aparece en la tabla
4. Ve a **Firestore → Colección "usuarios"**
5. Clic en **Agregar documento** → ID del documento: **pega el UID**
6. Agrega campos:
   - `name` (string) → `Yesenia Enríquez`
   - `role` (string) → `admin`
   - `email` (string) → `yesenia@mayanmango.com`

### 7. Crear usuarios para tu equipo (operadores)

Repite el paso 6 para cada colaborador, con `role: "operador"` o `role: "consulta"`:
- **operador**: puede palomear preparación, ver todo
- **consulta**: solo lectura

### 8. Cargar tu flota inicial en Firestore

En **Firestore → Colección "flota"**, agrega un documento por unidad con:
```
economico: "U-01"
modelo: "Dodge Attitude"
placa: "EKS-1245"
status: "disponible"   // disponible | rentada | mantenimiento | preparacion
cliente: ""
hasta: ""
```

(Puedes usar la app para agregar unidades desde la pantalla de Disponibilidad)

### 9. Desplegar en Vercel

```bash
# Instala dependencias
npm install

# Prueba local
npm run dev

# Opción A: Vercel CLI
npm install -g vercel
vercel --prod

# Opción B: desde vercel.com
# 1. Sube este proyecto a GitHub (github.com)
# 2. Ve a vercel.com → New Project → importa el repo
# 3. Framework: Vite → Deploy
```

Tu app quedará en una URL como `mayan-mango-ops.vercel.app`

---

## Estructura de colecciones Firestore

### `contratos/{id}`
```
folio: "F-747"
cliente: "James Whitfield"
vehiculo: "Mitsubishi Xpander Cross"
placa: "PLR-0812"
fechaEntrega: Timestamp
hora: "09:00"
lugarEntrega: "Aeropuerto CUN T2"
fechaDevolucion: Timestamp
lugarDevolucion: "Hotel Riu Tulum"
notas: "Cliente VIP"
urgente: false
preparacion: { lavado: false, gasolina: false, ac: false, documentos: false }
creadoEn: Timestamp
```

### `flota/{id}`
```
economico: "U-01"
modelo: "Dodge Attitude"
placa: "EKS-1245"
status: "disponible" | "rentada" | "mantenimiento" | "preparacion"
cliente: "SAMPOL"
hasta: "25 Jun"
```

### `usuarios/{uid}`
```
name: "Yesenia Enríquez"
email: "yesenia@mayanmango.com"
role: "admin" | "operador" | "consulta"
```

---

## Roles y permisos

| Acción                          | admin | operador | consulta |
|----------------------------------|:-----:|:--------:|:--------:|
| Ver agenda, flota, contratos     |  ✓   |    ✓     |    ✓     |
| Palomear preparación de unidades |  ✓   |    ✓     |    ✗     |
| Agregar / editar contratos       |  ✓   |    ✗     |    ✗     |
| Cambiar estado de unidades       |  ✓   |    ✗     |    ✗     |
| Eliminar contratos               |  ✓   |    ✗     |    ✗     |
| Gestionar usuarios               |  ✓   |    ✗     |    ✗     |

---

## Soporte

Generado para Transportadora Mango S. de R.L. de C.V. (Mayan Mango)
RFC: TMA160205PU7 — Riviera Maya, México

---

## Módulo WhatsApp (Twilio)

### Qué envía automáticamente
| Evento | Cuándo |
|--------|--------|
| 🆕 Contrato nuevo | Inmediato al guardar |
| 🚨 Marcado urgente | Inmediato al editar |
| ☀️ Agenda del día | Todos los días 6:00 AM hora Cancún |
| ⏰ Recordatorio 2h antes | Automático antes de cada entrega |

### Configurar Twilio (paso a paso)
1. Crea cuenta en https://twilio.com (tier gratuito disponible)
2. En Twilio Console → Messaging → Try it out → Send a WhatsApp message
3. Activa el **Sandbox de WhatsApp** (cada número debe enviar el código una vez)
4. Ve a Firebase Console → **Functions → Secrets Manager** y agrega:
   - `TWILIO_SID` → Account SID (empieza con AC...)
   - `TWILIO_TOKEN` → Auth Token
   - `TWILIO_FROM` → `whatsapp:+14155238886` (sandbox) o tu número aprobado
5. Despliega las Functions: `cd functions && npm install && firebase deploy --only functions`
6. En la app → Configuración → agrega los números del equipo

### Para producción (fuera de sandbox)
Solicita un número WhatsApp Business en Twilio (~$15 USD/mes).
Los mensajes sandbox solo llegan a números previamente registrados.

---

## Módulo PDF

### Tres formatos disponibles

**Agenda del día** (botón en pantalla Agenda)
- Tabla con todos los eventos del día ordenados por hora
- Código de color por urgencia
- KPIs: número de entregas, devoluciones y urgentes
- Pie de página con razón social y RFC

**Agenda semanal** (botón en pantalla Agenda)
- Vista de 7 columnas, orientación horizontal
- Cada día muestra sus eventos con color por tipo (entrega/devolución)
- Hoy resaltado en naranja

**Hoja de ruta del chofer** (botón en detalle de contrato)
- Todos los datos del contrato en formato de entrega física
- Checklist de preparación con estado actual
- Espacio para firma del chofer y del cliente
- Indicador URGENTE en rojo si aplica

El PDF se genera directamente en el navegador (jsPDF) sin backend.
No requiere configuración adicional.

---

## Google Calendar

### Sincronización automática
- **Contrato nuevo** → crea evento en el calendario compartido
- **Contrato editado** → actualiza el evento existente
- **Contrato eliminado** → borra el evento de Calendar

### Formato del evento
```
Título:      🚗 F-747 — James Whitfield
Descripción: Vehículo: Mitsubishi Xpander (PLR-0812)
             Entrega: Aeropuerto CUN T2
             Devolución: 25 Jun — Hotel Riu Tulum
Recordatorios: 2 horas antes · 30 minutos antes
Color:       Naranja (normal) / Rojo (urgente)
```

### Configurar Google Calendar (paso a paso)
1. Ve a https://console.cloud.google.com → Crea proyecto
2. Busca y activa la API: **Google Calendar API**
3. Ve a **IAM y administración → Cuentas de servicio** → Crear cuenta de servicio
4. Nombre: `mayan-mango-calendar` → Crear y continuar → Listo
5. Clic en la cuenta creada → pestaña **Claves** → Agregar clave → JSON → se descarga un archivo
6. En Firebase Secrets agrega: `GCAL_SA_JSON` con **todo el contenido** del archivo JSON descargado
7. Abre **Google Calendar** en el navegador → crea un calendario nuevo: "Mayan Mango Operaciones"
8. Click en los tres puntos del calendario → **Configuración y uso compartido**
9. Sección **Compartir con usuarios específicos** → agrega el email de la cuenta de servicio (termina en `@...iam.gserviceaccount.com`) → permiso: **Realizar cambios en eventos**
10. Copia el **ID del calendario** (sección "Integrar calendario", formato `xxx@group.calendar.google.com`)
11. En Firebase Secrets agrega: `GCAL_ID` con ese ID
12. En la app → Configuración → pega el mismo Calendar ID y guarda
13. Despliega las Functions: `firebase deploy --only functions`

### Compartir el calendario con el equipo
En Google Calendar → tu calendario → Compartir → agrega los correos del equipo.
Todos verán los eventos en tiempo real desde su propio Google Calendar o celular.

---

## Despliegue de Cloud Functions

```bash
# Instalar Firebase CLI (solo la primera vez)
npm install -g firebase-tools

# Login
firebase login

# Inicializar en el proyecto (solo la primera vez)
firebase init functions
# → Selecciona proyecto existente
# → JavaScript
# → Directorio: functions/

# Configurar secrets (una vez)
firebase functions:secrets:set TWILIO_SID
firebase functions:secrets:set TWILIO_TOKEN
firebase functions:secrets:set TWILIO_FROM
firebase functions:secrets:set GCAL_SA_JSON
firebase functions:secrets:set GCAL_ID

# Desplegar
cd functions && npm install
firebase deploy --only functions
```

Las funciones quedan activas en Firebase. El cron de 6 AM y el recordatorio
de 2h corren automáticamente sin ninguna acción adicional.

---

## Soporte

Generado para Transportadora Mango S. de R.L. de C.V. (Mayan Mango)
RFC: TMA160205PU7 — Riviera Maya, México
