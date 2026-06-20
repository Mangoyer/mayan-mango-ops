/**
 * Mayan Mango — Firebase Cloud Functions
 *
 * Funciones:
 *  1. onContratoCreated   → WhatsApp a todos los números configurados
 *  2. onContratoUrgente   → WhatsApp inmediato si urgente=true
 *  3. recordatorios       → Cron diario 6 AM → WhatsApp de entregas del día
 *  4. recordatorio2h      → Cron cada hora → WhatsApp 2h antes de cada entrega
 *  5. syncGoogleCalendar  → Crea/actualiza evento en Google Calendar al guardar contrato
 *  6. deleteCalendarEvent → Borra evento de Calendar al eliminar contrato
 */

const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } =
  require('firebase-functions/v2/firestore')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret } = require('firebase-functions/params')
const admin  = require('firebase-admin')
const twilio = require('twilio')
const { google } = require('googleapis')
const { format, addHours, isWithinInterval, parseISO } = require('date-fns')
const { toZonedTime } = require('date-fns-tz')

admin.initializeApp()
const db = admin.firestore()

// ── Secrets (configura en Firebase Console → Functions → Secrets) ──────────
const TWILIO_SID    = defineSecret('TWILIO_SID')
const TWILIO_TOKEN  = defineSecret('TWILIO_TOKEN')
const TWILIO_FROM   = defineSecret('TWILIO_FROM')   // whatsapp:+14155238886
const GCAL_SA_JSON  = defineSecret('GCAL_SA_JSON')  // JSON de service account
const GCAL_ID       = defineSecret('GCAL_ID')       // ID del calendario compartido

const TZ = 'America/Cancun'

// ── Helpers ────────────────────────────────────────────────────────────────

function dateOf(val) {
  if (!val) return null
  if (val.toDate) return val.toDate()
  return new Date(val)
}

async function getNumeros() {
  // Colección "config/whatsapp" → campo "numeros": ["+521234567890", ...]
  const snap = await db.doc('config/whatsapp').get()
  return snap.exists ? (snap.data().numeros ?? []) : []
}

async function sendWhatsApp(to, body, secrets) {
  const client = twilio(secrets.sid, secrets.token)
  return client.messages.create({
    from: secrets.from,
    to:   `whatsapp:${to}`,
    body,
  })
}

async function broadcastWhatsApp(mensaje, secrets) {
  const numeros = await getNumeros()
  return Promise.allSettled(
    numeros.map(n => sendWhatsApp(n, mensaje, secrets))
  )
}

function contratoMsg(c, tipo) {
  const fecha = dateOf(c.fechaEntrega)
  const fechaStr = fecha
    ? format(toZonedTime(fecha, TZ), "dd/MM/yyyy 'a las' HH:mm")
    : '—'
  const emoji = tipo === 'NUEVA' ? '🆕' : tipo === 'URGENTE' ? '🚨' : '⏰'
  return [
    `${emoji} *Mayan Mango — ${tipo}*`,
    `Folio: ${c.folio} | ${c.cliente}`,
    `🚗 ${c.vehiculo} (${c.placa})`,
    `📅 Entrega: ${fechaStr}`,
    `📍 ${c.lugarEntrega}`,
    c.notas ? `⚠️ ${c.notas}` : '',
  ].filter(Boolean).join('\n')
}

// ── Google Calendar helper ────────────────────────────────────────────────

async function getCalendarClient(saJson, calendarId) {
  const sa = JSON.parse(saJson)
  const auth = new google.auth.GoogleAuth({
    credentials: sa,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
  const calendar = google.calendar({ version: 'v3', auth })
  return { calendar, calendarId }
}

function contratoToEvent(c) {
  const fe  = dateOf(c.fechaEntrega)
  const fd  = dateOf(c.fechaDevolucion)
  if (!fe) return null

  // Evento de entrega
  const start = fe
  const end   = fd ?? addHours(fe, 1)

  return {
    summary: `🚗 ${c.folio} — ${c.cliente}`,
    description: [
      `Vehículo: ${c.vehiculo} (${c.placa})`,
      `Entrega: ${c.lugarEntrega}`,
      fd ? `Devolución: ${format(toZonedTime(fd, TZ), 'dd/MM/yyyy')} — ${c.lugarDevolucion ?? ''}` : '',
      c.notas ? `Notas: ${c.notas}` : '',
      c.urgente ? '⚠️ URGENTE' : '',
    ].filter(Boolean).join('\n'),
    location: c.lugarEntrega ?? '',
    start:    { dateTime: start.toISOString(), timeZone: TZ },
    end:      { dateTime: end.toISOString(),   timeZone: TZ },
    colorId:  c.urgente ? '11' : '6',   // rojo urgente, turquesa normal
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 120 },
        { method: 'popup', minutes: 30  },
      ],
    },
  }
}

// ── 1. Nuevo contrato → WhatsApp + Calendar ───────────────────────────────

exports.onContratoCreated = onDocumentCreated(
  { document: 'contratos/{id}', secrets: [TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, GCAL_SA_JSON, GCAL_ID] },
  async (event) => {
    const c  = event.data.data()
    const id = event.params.id

    const secrets = {
      sid:   TWILIO_SID.value(),
      token: TWILIO_TOKEN.value(),
      from:  TWILIO_FROM.value(),
    }

    // WhatsApp
    const tipo = c.urgente ? 'URGENTE' : 'NUEVA ENTREGA'
    await broadcastWhatsApp(contratoMsg(c, tipo), secrets)

    // Google Calendar
    const ev = contratoToEvent(c)
    if (!ev) return

    const { calendar, calendarId } = await getCalendarClient(
      GCAL_SA_JSON.value(), GCAL_ID.value()
    )
    const res = await calendar.events.insert({ calendarId, requestBody: ev })

    // Guardar el calendarEventId en Firestore para poder actualizarlo/borrarlo
    await db.doc(`contratos/${id}`).update({ calendarEventId: res.data.id })
  }
)

// ── 2. Contrato actualizado → actualizar evento Calendar ──────────────────

exports.onContratoUpdated = onDocumentUpdated(
  { document: 'contratos/{id}', secrets: [TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, GCAL_SA_JSON, GCAL_ID] },
  async (event) => {
    const antes  = event.data.before.data()
    const despues = event.data.after.data()

    // Si se marcó urgente por primera vez → WhatsApp
    if (!antes.urgente && despues.urgente) {
      const secrets = {
        sid:   TWILIO_SID.value(),
        token: TWILIO_TOKEN.value(),
        from:  TWILIO_FROM.value(),
      }
      await broadcastWhatsApp(contratoMsg(despues, 'URGENTE'), secrets)
    }

    // Actualizar evento en Calendar
    const eventId = despues.calendarEventId
    if (!eventId) return

    const ev = contratoToEvent(despues)
    if (!ev) return

    const { calendar, calendarId } = await getCalendarClient(
      GCAL_SA_JSON.value(), GCAL_ID.value()
    )
    await calendar.events.update({ calendarId, eventId, requestBody: ev })
  }
)

// ── 3. Contrato eliminado → borrar evento Calendar ────────────────────────

exports.onContratoDeleted = onDocumentDeleted(
  { document: 'contratos/{id}', secrets: [GCAL_SA_JSON, GCAL_ID] },
  async (event) => {
    const c       = event.data.data()
    const eventId = c.calendarEventId
    if (!eventId) return

    const { calendar, calendarId } = await getCalendarClient(
      GCAL_SA_JSON.value(), GCAL_ID.value()
    )
    await calendar.events.delete({ calendarId, eventId }).catch(() => {})
  }
)

// ── 4. Cron 6 AM → agenda del día por WhatsApp ───────────────────────────

exports.recordatoriosDiarios = onSchedule(
  { schedule: '0 6 * * *', timeZone: TZ, secrets: [TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM] },
  async () => {
    const hoy   = new Date()
    const inicio = new Date(hoy); inicio.setHours(0, 0, 0, 0)
    const fin    = new Date(hoy); fin.setHours(23, 59, 59, 999)

    const snap = await db.collection('contratos').get()
    const hoy_contratos = snap.docs
      .map(d => d.data())
      .filter(c => {
        const fe = dateOf(c.fechaEntrega)
        return fe && fe >= inicio && fe <= fin
      })
      .sort((a, b) => dateOf(a.fechaEntrega) - dateOf(b.fechaEntrega))

    if (!hoy_contratos.length) return

    const lineas = hoy_contratos.map(c => {
      const hora = dateOf(c.fechaEntrega)
        ? format(toZonedTime(dateOf(c.fechaEntrega), TZ), 'HH:mm')
        : '—'
      return `${c.urgente ? '🚨' : '🔹'} ${hora} | ${c.folio} — ${c.cliente} | ${c.vehiculo} (${c.placa}) | ${c.lugarEntrega}`
    })

    const msg = [
      `☀️ *Mayan Mango — Agenda de hoy ${format(toZonedTime(hoy, TZ), 'dd/MM/yyyy')}*`,
      `${hoy_contratos.length} entregas programadas:`,
      '',
      ...lineas,
    ].join('\n')

    const secrets = {
      sid:   TWILIO_SID.value(),
      token: TWILIO_TOKEN.value(),
      from:  TWILIO_FROM.value(),
    }
    await broadcastWhatsApp(msg, secrets)
  }
)

// ── 5. Cron cada hora → recordatorio 2h antes de cada entrega ────────────

exports.recordatorio2h = onSchedule(
  { schedule: '0 * * * *', timeZone: TZ, secrets: [TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM] },
  async () => {
    const ahora    = new Date()
    const en2h     = addHours(ahora, 2)
    // Ventana: entregas entre 1h55m y 2h05m desde ahora
    const ventanaInicio = addHours(ahora, 1 + 55/60)
    const ventanaFin    = addHours(ahora, 2 + 5/60)

    const snap = await db.collection('contratos').get()
    const proximas = snap.docs
      .map(d => d.data())
      .filter(c => {
        const fe = dateOf(c.fechaEntrega)
        return fe && isWithinInterval(fe, { start: ventanaInicio, end: ventanaFin })
      })

    const secrets = {
      sid:   TWILIO_SID.value(),
      token: TWILIO_TOKEN.value(),
      from:  TWILIO_FROM.value(),
    }

    for (const c of proximas) {
      const hora = format(toZonedTime(dateOf(c.fechaEntrega), TZ), 'HH:mm')
      const msg = [
        `⏰ *Recordatorio — Entrega en 2 horas*`,
        `Folio: ${c.folio} | ${c.cliente}`,
        `🚗 ${c.vehiculo} (${c.placa})`,
        `🕐 ${hora} — ${c.lugarEntrega}`,
        c.urgente ? '🚨 URGENTE' : '',
      ].filter(Boolean).join('\n')
      await broadcastWhatsApp(msg, secrets)
    }
  }
)
