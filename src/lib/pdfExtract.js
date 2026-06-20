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

// Extrae el texto reconstruyendo las FILAS REALES según la posición en la página
// (igual que hace pdftotext -layout). Esto es indispensable: pdf.js entrega los
// fragmentos de texto en el orden interno del PDF, que casi nunca coincide con
// el orden visual de lectura — agrupar por coordenada Y y ordenar por X dentro
// de cada fila reconstruye el documento como se ve en pantalla.
async function extraerTextoPDF(file) {
  const pdfjsLib = await loadPdfJs()
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

  let texto = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    // Cada item trae 'transform': [a, b, c, d, x, y] — x,y son la posición real.
    const filas = new Map() // y agrupado -> [{x, str}]
    for (const item of content.items) {
      if (!item.str.trim()) continue
      const x = item.transform[4]
      const y = Math.round(item.transform[5] / 3) * 3 // tolerancia de agrupado
      if (!filas.has(y)) filas.set(y, [])
      filas.get(y).push({ x, str: item.str })
    }

    // En PDF el eje Y crece hacia ARRIBA, así que para leer de arriba a abajo
    // ordenamos las filas de mayor a menor Y.
    const ysOrdenados = [...filas.keys()].sort((a, b) => b - a)
    const lineas = ysOrdenados.map(y =>
      filas.get(y).sort((a, b) => a.x - b.x).map(p => p.str).join(' ')
    )
    texto += lineas.join('\n') + '\n'
  }
  return texto
}

function dmyToISO(dmy) {
  const m = dmy?.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return ''
  return `${m[3]}-${m[2]}-${m[1]}`
}

// ── Contrato turístico (renta vehicular) ──────────────────────
export function extraerContratoTuristico(texto) {
  const get = (regex) => texto.match(regex)?.[1]?.trim() ?? ''

  const folio = get(/FOLIO\s+(\d+)/i)

  // El nombre y apellido completos vienen en la MISMA línea que la palabra "NOMBRE"
  // (la reconstrucción por filas los junta), terminando antes del salto de línea.
  const clienteRaw = get(/NOMBRE\s+([A-ZÁÉÍÓÚÑ\s]+?)\s*\n/i)
  const cliente = clienteRaw.replace(/\s+/g, ' ').trim()

  const economico = get(/NUMERO ECONOMICO\s+([A-Z]\d+)/i)
  const serie     = get(/\b([A-Z0-9]{17})\b/)
  const placa     = get(/PLACAS\(license\s+([A-Z0-9-]+)/i)

  // Modelo del vehículo: línea inmediatamente arriba de "VEHICULO (vehicle):"
  const vehiculo  = get(/\n([A-Z0-9ÁÉÍÓÚÑ\s]+?)\s+VEHICULO\s*\(vehicle\)/i)

  const fechaEntrega    = dmyToISO(get(/FECHA DE ENTREGA\s+(\d{2}\/\d{2}\/\d{4})/i))
  const fechaDevolucion = dmyToISO(get(/FECHA DE RETORNO\s+(\d{2}\/\d{2}\/\d{4})/i))

  const total = get(/TOTAL\s*(?:IVA INCLUIDO)?\s*\$?\s*([\d,]+\.?\d*)/i)

  return {
    folio, cliente, economico, serie, placa, vehiculo,
    fechaEntrega, fechaDevolucion, total,
    _camposExtraidos: [folio, cliente, economico, placa, fechaEntrega].filter(Boolean).length,
  }
}

// ── Anexo / inventario empresarial (auto sustituto o renta por periodo) ──
export function extraerInventarioEmpresarial(texto) {
  const get = (regex) => texto.match(regex)?.[1]?.trim() ?? ''

  const economico = get(/NUMERO ECONOMICO\s+([A-Z]\d+)/i)
  const empresa   = get(/ARRENDATARIO:?\s+([A-ZÁÉÍÓÚÑ0-9.\s]+?)\s*\n/i)
  const serie     = get(/\b([A-Z0-9]{17})\b/)
  const placa     = get(/PLACAS\(license\s+([A-Z0-9-]+)/i)
  const vehiculo  = get(/\n([A-Z0-9ÁÉÍÓÚÑ\s]+?)\s+VEHICULO\s*\(vehicle\)/i)
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
