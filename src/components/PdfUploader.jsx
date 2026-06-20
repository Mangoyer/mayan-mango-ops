import { useState, useRef } from 'react'
import { Upload, FileCheck, AlertTriangle, X, Loader2 } from 'lucide-react'
import { leerPDFContrato } from '../lib/pdfExtract'

/**
 * Componente de carga de PDF con extracción automática.
 * SIEMPRE opcional — el formulario manual funciona sin esto.
 * Si la extracción falla o el documento no se cargó, no pasa nada:
 * el usuario simplemente llena los campos a mano.
 */
export default function PdfUploader({ tipo, onExtracted, label }) {
  const [estado, setEstado] = useState('idle') // idle | leyendo | ok | error
  const [nombreArchivo, setNombreArchivo] = useState('')
  const inputRef = useRef(null)

  async function handleFile(file) {
    if (!file) return
    setNombreArchivo(file.name)
    setEstado('leyendo')
    try {
      const datos = await leerPDFContrato(file, tipo)
      if (datos._camposExtraidos === 0) {
        setEstado('error')
        return
      }
      setEstado('ok')
      onExtracted(datos, file)
    } catch (e) {
      console.error(e)
      setEstado('error')
    }
  }

  function limpiar() {
    setEstado('idle')
    setNombreArchivo('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="border border-dashed border-gray-300 rounded-xl p-3 bg-gray-50">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />

      {estado === 'idle' && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 py-2 hover:text-mango-700"
        >
          <Upload size={16} />
          {label ?? 'Subir PDF del contrato (opcional)'}
        </button>
      )}

      {estado === 'leyendo' && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-2">
          <Loader2 size={16} className="animate-spin" />
          Leyendo {nombreArchivo}…
        </div>
      )}

      {estado === 'ok' && (
        <div className="flex items-center justify-between gap-2 text-sm text-emerald-700 py-1">
          <span className="flex items-center gap-2 truncate">
            <FileCheck size={16} className="flex-shrink-0" />
            <span className="truncate">{nombreArchivo} — datos extraídos, revisa abajo</span>
          </span>
          <button type="button" onClick={limpiar} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {estado === 'error' && (
        <div className="flex items-center justify-between gap-2 text-sm text-amber-700 py-1">
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} className="flex-shrink-0" />
            No se pudo leer el PDF automáticamente — captura los datos abajo a mano.
          </span>
          <button type="button" onClick={limpiar} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {estado === 'idle' && (
        <p className="text-xs text-gray-400 text-center mt-1">
          Si no tienes el documento o el operador no lo llenó, omite este paso y captura abajo.
        </p>
      )}
    </div>
  )
}
