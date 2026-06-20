/**
 * Generador de PDF — Mayan Mango
 * Usa jsPDF (cargado vía CDN en el componente React que lo llama)
 * Exporta tres funciones:
 *   generarAgendaDia(contratos, fecha)      → PDF agenda del día (imprimir)
 *   generarAgendaSemana(contratos, inicio)  → PDF agenda semanal
 *   generarHojaRuta(contrato)               → PDF hoja de ruta del chofer
 */

import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ── Colores Mayan Mango ──────────────────────────────────────
const C = {
  naranja:   [234, 88,  12],   // mango-600
  naranja_l: [255, 237, 213],  // mango-100
  gris:      [75,  85,  99],   // gray-600
  gris_l:    [249, 250, 251],  // gray-50
  texto:     [17,  24,  39],   // gray-900
  borde:     [229, 231, 235],  // gray-200
  verde:     [5,   150, 105],
  rojo:      [220, 38,  38],
  blanco:    [255, 255, 255],
}

function dateOf(val) {
  if (!val) return null
  if (val?.toDate) return val.toDate()
  return new Date(val)
}

function loadJsPDF() {
  return new Promise((resolve, reject) => {
    if (window.jspdf) { resolve(window.jspdf.jsPDF); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    s.onload  = () => resolve(window.jspdf.jsPDF)
    s.onerror = reject
    document.head.appendChild(s)
  })
}

// ── Encabezado común ─────────────────────────────────────────
function header(doc, titulo, subtitulo) {
  const W = doc.internal.pageSize.getWidth()

  // Banda naranja
  doc.setFillColor(...C.naranja)
  doc.rect(0, 0, W, 22, 'F')

  // Logo MM
  doc.setFillColor(...C.blanco)
  doc.roundedRect(8, 5, 12, 12, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...C.naranja)
  doc.text('MM', 14, 13, { align: 'center' })

  // Título
  doc.setTextColor(...C.blanco)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Mayan Mango', 24, 10)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(titulo, 24, 16)

  // Subtítulo derecha
  doc.setFontSize(8)
  doc.text(subtitulo, W - 8, 13, { align: 'right' })

  return 28  // y de inicio de contenido
}

function pie(doc, pagina, total) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  doc.setDrawColor(...C.borde)
  doc.line(8, H - 12, W - 8, H - 12)
  doc.setFontSize(7)
  doc.setTextColor(...C.gris)
  doc.setFont('helvetica', 'normal')
  doc.text('Transportadora Mango S. de R.L. de C.V. — RFC: TMA160205PU7', 8, H - 6)
  doc.text(`Pág. ${pagina} de ${total}`, W - 8, H - 6, { align: 'right' })
}

function lineaTabla(doc, y, cols, anchos, offsetX = 8) {
  let x = offsetX
  cols.forEach((txt, i) => {
    doc.text(String(txt ?? '—'), x + 2, y)
    x += anchos[i]
  })
  return y + 7
}

// ── 1. AGENDA DEL DÍA ────────────────────────────────────────
export async function generarAgendaDia(contratos, fecha = new Date()) {
  const jsPDF   = await loadJsPDF()
  const doc     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W       = doc.internal.pageSize.getWidth()
  const fechaStr = format(fecha, "EEEE d 'de' MMMM yyyy", { locale: es })
  const impresion = format(new Date(), 'dd/MM/yyyy HH:mm')

  let y = header(doc, 'Agenda del día', fechaStr)

  // Resumen
  const entregas    = contratos.filter(c => dateOf(c.fechaEntrega) && format(dateOf(c.fechaEntrega), 'yyyy-MM-dd') === format(fecha, 'yyyy-MM-dd'))
  const devoluciones = contratos.filter(c => dateOf(c.fechaDevolucion) && format(dateOf(c.fechaDevolucion), 'yyyy-MM-dd') === format(fecha, 'yyyy-MM-dd'))
  const urgentes    = contratos.filter(c => c.urgente)

  // Tarjetas KPI
  const kpis = [
    { lbl: 'Entregas',     val: entregas.length,     color: C.naranja },
    { lbl: 'Devoluciones', val: devoluciones.length, color: C.verde   },
    { lbl: 'Urgentes',     val: urgentes.length,     color: C.rojo    },
  ]
  const kW = (W - 16 - 8) / 3
  kpis.forEach((k, i) => {
    const kx = 8 + i * (kW + 4)
    doc.setFillColor(...C.gris_l)
    doc.roundedRect(kx, y, kW, 16, 2, 2, 'F')
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...k.color)
    doc.text(String(k.val), kx + kW / 2, y + 10, { align: 'center' })
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.gris)
    doc.text(k.lbl, kx + kW / 2, y + 15, { align: 'center' })
  })
  y += 22

  // Eventos combinados y ordenados por hora
  const eventos = [
    ...entregas.map(c => ({ ...c, _tipo: 'ENTREGA', _hora: c.hora ?? '00:00' })),
    ...devoluciones.map(c => ({ ...c, _tipo: 'DEVOLUCIÓN', _hora: c.hora ?? '00:00' })),
  ].sort((a, b) => a._hora.localeCompare(b._hora))

  if (eventos.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(...C.gris)
    doc.text('No hay eventos programados para este día.', W / 2, y + 10, { align: 'center' })
  } else {
    // Cabecera tabla
    const anchos = [18, 22, 40, 28, 45, 15]
    const cols   = ['Hora', 'Folio', 'Cliente', 'Vehículo', 'Lugar', 'Tipo']

    doc.setFillColor(...C.naranja)
    doc.rect(8, y, W - 16, 7, 'F')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.blanco)
    lineaTabla(doc, y + 5, cols, anchos)
    y += 7

    eventos.forEach((ev, idx) => {
      if (y > 245) {
        pie(doc, doc.internal.getCurrentPageInfo().pageNumber, '?')
        doc.addPage()
        y = 15
      }
      doc.setFillColor(...(idx % 2 === 0 ? C.gris_l : C.blanco))
      doc.rect(8, y, W - 16, 7, 'F')

      if (ev.urgente) {
        doc.setFillColor(...C.rojo)
        doc.rect(8, y, 1.5, 7, 'F')
      }

      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...C.texto)
      lineaTabla(doc, y + 5, [
        ev._hora,
        ev.folio,
        ev.cliente?.substring(0, 22),
        `${ev.vehiculo?.split(' ')[0]} ${ev.placa}`,
        (ev._tipo === 'ENTREGA' ? ev.lugarEntrega : ev.lugarDevolucion)?.substring(0, 28),
        ev._tipo,
      ], anchos)

      if (ev.notas) {
        y += 7
        doc.setFillColor(255, 251, 235)
        doc.rect(8, y, W - 16, 5, 'F')
        doc.setFontSize(6.5)
        doc.setTextColor(180, 117, 23)
        doc.text(`  ⚠ ${ev.notas.substring(0, 80)}`, 10, y + 3.5)
      }
      y += 7
    })
  }

  pie(doc, 1, 1)
  doc.save(`Agenda_${format(fecha, 'yyyy-MM-dd')}.pdf`)
}

// ── 2. AGENDA SEMANAL ─────────────────────────────────────────
export async function generarAgendaSemana(contratos, inicioSemana = new Date()) {
  const jsPDF = await loadJsPDF()
  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
  const W     = doc.internal.pageSize.getWidth()
  const semanaStr = `Semana del ${format(inicioSemana, "d 'de' MMMM", { locale: es })}`

  let y = header(doc, 'Agenda semanal', semanaStr)

  // Construir días
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana)
    d.setDate(d.getDate() + i)
    return d
  })

  const colW    = (W - 16) / 7
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  // Encabezados de día
  dias.forEach((d, i) => {
    const dx = 8 + i * colW
    const esHoy = format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
    doc.setFillColor(...(esHoy ? C.naranja : C.gris_l))
    doc.rect(dx, y, colW - 1, 10, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(esHoy ? C.blanco : C.texto))
    doc.text(`${dayNames[i]} ${format(d, 'd')}`, dx + colW / 2, y + 4, { align: 'center' })
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...(esHoy ? C.naranja_l : C.gris))
    doc.text(format(d, 'MMM', { locale: es }), dx + colW / 2, y + 8.5, { align: 'center' })
  })
  y += 12

  // Eventos por columna
  const maxY = 175
  dias.forEach((d, i) => {
    const dx    = 8 + i * colW
    const dayStr = format(d, 'yyyy-MM-dd')
    let cy = y

    const evs = contratos.filter(c => {
      const fe = dateOf(c.fechaEntrega)
      const fd = dateOf(c.fechaDevolucion)
      return (fe && format(fe, 'yyyy-MM-dd') === dayStr) ||
             (fd && format(fd, 'yyyy-MM-dd') === dayStr)
    })

    if (evs.length === 0) {
      doc.setFontSize(6.5)
      doc.setTextColor(...C.borde)
      doc.text('–', dx + colW / 2, cy + 4, { align: 'center' })
      return
    }

    evs.forEach(c => {
      if (cy > maxY) return
      const fe  = dateOf(c.fechaEntrega)
      const fd  = dateOf(c.fechaDevolucion)
      const esEntrega = fe && format(fe, 'yyyy-MM-dd') === dayStr
      const hora = c.hora ?? '—'

      doc.setFillColor(...(c.urgente ? [254, 226, 226] : (esEntrega ? [255, 237, 213] : [209, 250, 229])))
      doc.roundedRect(dx, cy, colW - 2, 16, 1.5, 1.5, 'F')

      if (c.urgente) {
        doc.setFillColor(...C.rojo)
        doc.roundedRect(dx, cy, 1.5, 16, 1.5, 1.5, 'F')
      }

      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...C.texto)
      doc.text(`${hora} ${c.folio}`, dx + 3, cy + 4.5)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.text(c.cliente?.substring(0, 18) ?? '—', dx + 3, cy + 8.5)
      doc.text(`${c.vehiculo?.split(' ')[0]} • ${c.placa}`, dx + 3, cy + 12)

      const tipo = esEntrega ? 'ENT' : 'DEV'
      doc.setTextColor(...(esEntrega ? C.naranja : C.verde))
      doc.text(tipo, dx + colW - 5, cy + 4.5)

      cy += 18
    })
  })

  pie(doc, 1, 1)
  doc.save(`Agenda_Semana_${format(inicioSemana, 'yyyy-MM-dd')}.pdf`)
}

// ── 3. HOJA DE RUTA DEL CHOFER ───────────────────────────────
export async function generarHojaRuta(c) {
  const jsPDF = await loadJsPDF()
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W     = doc.internal.pageSize.getWidth()

  const fe = dateOf(c.fechaEntrega)
  const fd = dateOf(c.fechaDevolucion)

  let y = header(doc, 'Hoja de ruta — Chofer', format(fe ?? new Date(), "d 'de' MMMM yyyy", { locale: es }))

  // Folio + urgente badge
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.naranja)
  doc.text(c.folio ?? '—', 8, y + 10)

  if (c.urgente) {
    doc.setFillColor(...C.rojo)
    doc.roundedRect(W - 45, y, 37, 12, 2, 2, 'F')
    doc.setFontSize(9)
    doc.setTextColor(...C.blanco)
    doc.text('🚨 URGENTE', W - 26, y + 7.5, { align: 'center' })
  }
  y += 16

  // Sección vehículo
  function seccion(titulo, contenido, yPos) {
    doc.setFillColor(...C.gris_l)
    doc.rect(8, yPos, W - 16, 6, 'F')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.gris)
    doc.text(titulo.toUpperCase(), 10, yPos + 4.5)
    let cy = yPos + 10
    contenido.forEach(([lbl, val]) => {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...C.gris)
      doc.text(lbl, 10, cy)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...C.texto)
      doc.text(String(val ?? '—'), 60, cy)
      cy += 7
    })
    return cy + 3
  }

  y = seccion('Vehículo', [
    ['Modelo',   c.vehiculo],
    ['Placa',    c.placa],
  ], y)

  y = seccion('Cliente', [
    ['Nombre',   c.cliente],
  ], y)

  y = seccion('Entrega', [
    ['Fecha',    fe ? format(fe, "EEEE d 'de' MMMM yyyy", { locale: es }) : '—'],
    ['Hora',     c.hora ?? '—'],
    ['Lugar',    c.lugarEntrega],
  ], y)

  if (fd) {
    y = seccion('Devolución', [
      ['Fecha',  format(fd, "EEEE d 'de' MMMM yyyy", { locale: es })],
      ['Lugar',  c.lugarDevolucion],
    ], y)
  }

  if (c.notas) {
    doc.setFillColor(255, 251, 235)
    doc.roundedRect(8, y, W - 16, 14, 2, 2, 'F')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(180, 117, 23)
    doc.text('⚠ Notas importantes', 12, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(C.texto)
    const lines = doc.splitTextToSize(c.notas, W - 26)
    doc.text(lines, 12, y + 10)
    y += 18
  }

  // Checklist preparación
  y += 2
  doc.setFillColor(...C.gris_l)
  doc.rect(8, y, W - 16, 6, 'F')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.gris)
  doc.text('CHECKLIST DE PREPARACIÓN', 10, y + 4.5)
  y += 10

  const checks = [
    ['lavado',     'Lavado exterior e interior'],
    ['gasolina',   'Tanque lleno'],
    ['ac',         'Aire acondicionado OK'],
    ['documentos', 'Documentos en orden'],
  ]
  checks.forEach(([key, label]) => {
    const done = c.preparacion?.[key]
    doc.setFillColor(...(done ? [209, 250, 229] : C.blanco))
    doc.roundedRect(8, y, W - 16, 9, 1.5, 1.5, done ? 'F' : 'S')
    doc.setDrawColor(...C.borde)

    doc.setFontSize(8)
    doc.setFont('helvetica', done ? 'bold' : 'normal')
    doc.setTextColor(...(done ? C.verde : C.gris))
    doc.text(done ? '✓' : '○', 14, y + 6)
    doc.setTextColor(...C.texto)
    doc.setFont('helvetica', 'normal')
    doc.text(label, 22, y + 6)
    y += 11
  })

  // Firma
  y += 10
  doc.setDrawColor(...C.borde)
  doc.line(8,     y, 90,  y)
  doc.line(W - 90, y, W - 8, y)
  doc.setFontSize(7)
  doc.setTextColor(...C.gris)
  doc.text('Firma del chofer', 49, y + 4, { align: 'center' })
  doc.text('Firma del cliente', W - 49, y + 4, { align: 'center' })

  pie(doc, 1, 1)
  doc.save(`HojaRuta_${c.folio ?? 'contrato'}.pdf`)
}
