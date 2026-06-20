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
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.js'
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js'
      resolve(window.pdfjsLib)
    }
    s.onerror = reject
    document.head.appendChild(s)
  })
  return pdfjsLoaded
}

// Extrae todo el texto plano de un PDF (igual que pdftotext -layout)
async function extraerTextoPDF(file) {
  const pdfjsLib = await loadPdfJs()
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  let texto = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    texto += content.items.map(it => it.str).join(' ') + '\n'
  }
  return texto
}

function dmyToISO(dmy) {
  // "16/06/2026" -> "2026-06-16"
  const m = dmy?.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return ''
  return `${m[3]}-${m[2]}-${m[1]}`
}

// ── Contrato turístico (renta vehicular) ──────────────────────
export function extraerContratoTuristico(texto) {
  const get = (regex) => texto.match(regex)?.[1]?.trim() ?? ''

  const folio = get(/FOLIO\s+(\d+)/i)

  const nombre    = get(/NOMBRE\s*\(first name\):\s*([A-ZÁÉÍÓÚÑ\s]+?)\s+APELLIDOS/i)
  const apellidos = get(/APELLIDOS\s*\(last name\):\s*([A-ZÁÉÍÓÚÑ\s]+?)\s+(?:FECHA|$)/i)
  const cliente = `${nombre} ${apellidos}`.trim()

  const economico = get(/NUMERO ECONOMICO\s+([A-Z]\d+)/i)
  const serie     = get(/N[º°o]\s*DE SERIE[^:]*:\s*([A-Z0-9]+)/i)
  const placa     = get(/PLACAS\s*\(license plate\):\s*([A-Z0-9-]+)/i)

  const fechaEntrega    = dmyToISO(get(/FECHA DE ENTREGA\s+(\d{2}\/\d{2}\/\d{4})/i))
  const fechaDevolucion = dmyToISO(get(/FECHA DE RETORNO\s+(\d{2}\/\d{2}\/\d{4})/i))
  const hora = get(/FECHA DE ENTREGA\s+\d{2}\/\d{2}\/\d{4}\s+HORA\s+(\d{2}:\d{2})/i)

  const total = get(/TOTAL\s*(?:IVA INCLUIDO)?\s*\$\s*([\d,]+\.?\d*)/i)

  return {
    folio, cliente, economico, serie, placa,
    fechaEntrega, fechaDevolucion, hora, total,
    _camposExtraidos: [folio, cliente, economico, placa, fechaEntrega].filter(Boolean).length,
  }
}

// ── Anexo / inventario empresarial (auto sustituto o renta por periodo) ──
export function extraerInventarioEmpresarial(texto) {
  const get = (regex) => texto.match(regex)?.[1]?.trim() ?? ''

  const economico = get(/NUMERO ECONOMICO\s+([A-Z]\d+)/i)
  const empresa   = get(/ARRENDATARIO[:\s]*([A-ZÁÉÍÓÚÑ0-9.\s]+?)\s*(?:DATOS DEL VEHICULO|$)/i)
  const serie     = get(/N[º°o]\s*DE SERIE[^:]*:\s*([A-Z0-9]+)/i)
  const placa     = get(/PLACAS\s*\(license plate\):\s*([A-Z0-9-]+)/i)
  const vehiculo  = get(/VEHICULO\s*\(vehicle\):\s*([A-ZÁÉÍÓÚÑ0-9\s]+?)\s*MARCA/i)
  const contratoMarco = get(/CONTRATO DE ARRENDAMIENTO VEHICULAR\s+(\d+)/i)
  const fechaEntrega  = dmyToISO(get(/FECHA DE ENTREGA\s+(\d{2}\/\d{2}\/\d{4})/i))

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
