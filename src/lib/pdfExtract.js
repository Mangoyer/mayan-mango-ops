/**
 * Extracción gratuita de datos de contratos PDF — sin IA, sin costo.
 * Usa pdf.js (cargado vía CDN) para leer el texto del PDF en el navegador,
 * y expresiones regulares para extraer los campos de la plantilla fija de Mayan Mango.
 *
 * IMPORTANTE: esto funciona porque la plantilla de contrato es siempre la misma.
 * Si algún día cambias el diseño del PDF, hay que ajustar las expresiones de abajo.
 */

let pdfjsLoaded = null

function loadPdfJs() {
  if (pdfjsLoaded) return pdfjsLoaded
  pdfjsLoaded = new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve(window.pdfjsLib)
    }
    s.onerror = reject
    document.head.appendChild(s)
  })
  return pdfjsLoaded
}

// Extrae todo el texto plano de un PDF.
// IMPORTANTE: pdf.js NO preserva el orden visual de lectura como pdftotext -layout —
// extrae los bloques de texto en el orden interno del PDF, que puede mezclar
// etiquetas y valores. Por eso la extracción de abajo NO asume un orden lineal:
// busca cada valor por proximidad a su ancla más confiable (FOLIO, NUMERO ECONOMICO, etc.)
async function extraerTextoPDF(file) {
  const pdfjsLib = await loadPdfJs()
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  let texto = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // Cada item de pdf.js es un fragmento de texto; lo separamos con salto de línea
    // (no con espacio) para poder usar anclas de "línea completa" en las expresiones.
    texto += content.items.map(it => it.str).join('\n') + '\n'
  }
  return texto
}

function dmyToISO(dmy) {
  const m = dmy?.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return ''
  return `${m[3]}-${m[2]}-${m[1]}`
}

const PALABRAS_EXCLUIR = new Set([
  'USA','MEXICO','CANADA','QUEBEC','TEXAS','CALIFORNIA','FLORIDA','NUEVO LEON',
  'QUINTANA ROO','FOLIO','NOMBRE','APELLIDOS','TIPO','DOMICILIO','EL BARRIAL',
  'SANTIAGO','INDIO','CADDO MILLS','PUERTO MORELOS','TROIS RIVIERES',
])

function esLineaNombreValida(linea) {
  if (!/^[A-ZÁÉÍÓÚÑ\s]+$/.test(linea)) return false
  const limpio = linea.replace(/\s/g, '')
  if (limpio.length < 2) return false
  if (PALABRAS_EXCLUIR.has(linea)) return false
  return true
}

function nombreCercaDeEtiqueta(texto) {
  const idx = texto.indexOf('NOMBRE (first name)')
  if (idx === -1) return []
  const antes = texto.slice(0, idx)
  const lineas = antes.split('\n').map(l => l.trim()).filter(Boolean)
  const out = []
  for (let i = lineas.length - 1; i >= 0; i--) {
    const l = lineas[i]
    if (esLineaNombreValida(l)) {
      out.unshift(l)
      if (out.length === 2) break
    } else {
      break
    }
  }
  return out
}

function apellidoCercaDeFolio(texto) {
  const m = texto.match(/FOLIO\s*\n\s*\d+\s*\n/)
  if (!m) return []
  const despues = texto.slice(m.index + m[0].length)
  const lineas = despues.split('\n').map(l => l.trim()).filter(Boolean)
  let saltos = 1
  for (const l of lineas) {
    if (esLineaNombreValida(l)) return [l]
    if (saltos > 0) { saltos--; continue }
    break
  }
  return []
}

function extraerCliente(texto) {
  const cercaNombre = nombreCercaDeEtiqueta(texto)
  const cercaFolio  = apellidoCercaDeFolio(texto)

  if (cercaNombre.length === 2) return cercaNombre.join(' ')

  const nombre   = cercaNombre[0] ?? ''
  let apellido   = cercaFolio[0] ?? ''
  if (apellido === nombre) apellido = ''
  return [nombre, apellido].filter(Boolean).join(' ')
}

// ── Contrato turístico (renta vehicular) ──────────────────────
export function extraerContratoTuristico(texto) {
  const get = (regex) => texto.match(regex)?.[1]?.trim() ?? ''

  const folio = get(/FOLIO\s*\n?\s*(\d+)/i)
  const cliente = extraerCliente(texto)

  const economico = get(/NUMERO ECONOMICO\s*\n\s*([A-Z]\d+)/i)
  const serie     = get(/\b([A-Z0-9]{17})\b/)
  const placa     = get(/\n([A-Z]{2,3}\d{3,6}[A-Z]?)\s*\n/)

  // El modelo del vehículo aparece justo después de NUMERO ECONOMICO + su valor
  const vehiculo  = get(new RegExp(`NUMERO ECONOMICO\\s*\\n\\s*${economico}\\s*\\n\\s*([A-Z0-9ÁÉÍÓÚÑ\\s]+?)\\n`, 'i'))

  const fechaEntrega    = dmyToISO(get(/(\d{2}\/\d{2}\/\d{4})\s+HORA\s*\n\s*FECHA DE RETORNO/i))
  const fechaDevolucion = dmyToISO(get(/FECHA DE RETORNO\s+(\d{2}\/\d{2}\/\d{4})/i))

  const total = get(/TOTAL\s*\n?\s*\$?\s*\n?\s*([\d,]+\.?\d*)/i)

  return {
    folio, cliente, economico, serie, placa, vehiculo,
    fechaEntrega, fechaDevolucion, total,
    _camposExtraidos: [folio, cliente, economico, placa, fechaEntrega].filter(Boolean).length,
  }
}

// ── Anexo / inventario empresarial (auto sustituto o renta por periodo) ──
export function extraerInventarioEmpresarial(texto) {
  const get = (regex) => texto.match(regex)?.[1]?.trim() ?? ''

  const economico = get(/NUMERO ECONOMICO\s*\n?\s*([A-Z]\d+)/i)
  const empresa   = get(/ARRENDATARIO[:\s]*\n?\s*([A-ZÁÉÍÓÚÑ0-9.\s]+?)\s*\n/i)
  const serie     = get(/\b([A-Z0-9]{17})\b/)
  const placa     = get(/\n([A-Z]{2,3}-?\d{3,6}-?[A-Z]?)\s*\n/)
  const vehiculo  = get(/VEHICULO\s*\(vehicle\):\s*\n?\s*([A-ZÁÉÍÓÚÑ0-9\s]+?)\n/i)
  const contratoMarco = get(/CONTRATO DE ARRENDAMIENTO VEHICULAR\s+(\d+)/i)
  const fechaEntrega  = dmyToISO(get(/FECHA DE ENTREGA\s*\n?\s*(\d{2}\/\d{2}\/\d{4})/i))

  return {
    economico, empresa, serie, placa, vehiculo, contratoMarco, fechaEntrega,
    _camposExtraidos: [economico, empresa, placa].filter(Boolean).length,
  }
}

// ── Punto de entrada único ────────────────────────────────────
export async function leerPDFContrato(file, tipo) {
  const texto = await extraerTextoPDF(file)
  if (tipo === 'turistico') return extraerContratoTuristico(texto)
  if (tipo === 'empresarial') return extraerInventarioEmpresarial(texto)
  throw new Error('Tipo de documento no soportado')
}
