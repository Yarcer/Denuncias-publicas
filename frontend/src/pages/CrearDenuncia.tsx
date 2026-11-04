import { useEffect, useRef, useState, type FormEvent } from 'react'
import './CrearDenuncia.css'
import { api } from '../lib/api'
import { getApiErrorMessage } from '../lib/api-error'
import { formatReportIdentifier } from '../lib/report-id'

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet'

import 'leaflet/dist/leaflet.css'


type Category = {
  id: string
  name: string
  type: string
}

type CreateReportResponse = {
  data: {
    id: string
    entityName: string | null
    emailConfirmation: 'sent' | 'failed' | 'not_configured' | 'skipped'
  }
}

const MAX_DESCRIPTION_LENGTH = 500

const subcategorias = {
  infraestructura: [
    'Baches o calles en mal estado',
    'Semáforos dañados o fuera de funcionamiento',
    'Señalización dañada o faltante',
    'Luminarias públicas dañadas',
    'Alcantarillas tapadas o dañadas',
  ],

  limpieza: [
    'Acumulación excesiva de basura',
    'Contenedores llenos o dañados',
    'Contenedores faltantes',
    'Presencia de escombros',
  ],

  convivencia: [
    'Animales sueltos',
    'Ruidos molestos',
    'Obstrucción de la vía pública',
  ],

  saneamiento: [
    'Pérdidas de agua en vía pública',
    'Falta de agua o baja presión',
    'Problemas con la calidad del agua',
  ],
}

const limitesMelo = {
  west: -54.25,
  south: -32.42,
  east: -54.11,
  north: -32.31,
}

type SelectorUbicacionProps = {
  onSeleccionar: (latitud: number, longitud: number) => void
}

function SelectorUbicacion({ onSeleccionar }: SelectorUbicacionProps) {
  useMapEvents({
    click(e) {
      onSeleccionar(e.latlng.lat, e.latlng.lng)
    },
  })

  return null
}

function CentrarUbicacion({
  latitud,
  longitud,
}: {
  latitud: number | null
  longitud: number | null
}) {
  const map = useMap()

  useEffect(() => {
    if (latitud !== null && longitud !== null) {
      map.flyTo([latitud, longitud], Math.max(map.getZoom(), 16))
    }
  }, [latitud, longitud, map])

  if (latitud === null || longitud === null) {
    return null
  }

  return (
    <CircleMarker
      center={[latitud, longitud]}
      radius={9}
    >
      <Popup>Ubicación seleccionada</Popup>
    </CircleMarker>
  )
}

function CrearDenuncia() {
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriaId, setCategoriaId] = useState('')
  const [categoriaNombre, setCategoriaNombre] = useState('')
  const [subcategoria, setSubcategoria] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [latitud, setLatitud] = useState<number | null>(null)
  const [longitud, setLongitud] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState<{
    codigo: string
    detalles: string
    aviso: string
  } | null>(null)
  const [codigoCopiado, setCodigoCopiado] = useState(false)
  const [evidencia, setEvidencia] = useState<File | null>(null)
  const [vistaPrevia, setVistaPrevia] = useState('')
  const [estadoUbicacion, setEstadoUbicacion] = useState('')
  const geocodificacionRef = useRef<AbortController | null>(null)
  const temporizadorGeocodificacionRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ubicacionDesdeMapaRef = useRef('')

  function cancelarGeocodificacion() {
    geocodificacionRef.current?.abort()
    geocodificacionRef.current = null
    if (temporizadorGeocodificacionRef.current) {
      clearTimeout(temporizadorGeocodificacionRef.current)
      temporizadorGeocodificacionRef.current = null
    }
  }


  useEffect(() => {
    async function cargarCategorias() {
      try {
        const response = await api.get('/categorias')
        setCategories(response.data.data.items)
      } catch {
        setError('No se pudieron cargar las categorías.')
      }
    }

    void cargarCategorias()
  }, [])

  function obtenerClaveCategoria(nombre: string) {
    const nombreNormalizado = nombre.toLowerCase()

    if (nombreNormalizado.includes('infraestructura')) {
      return 'infraestructura'
    }

    if (nombreNormalizado.includes('limpieza')) {
      return 'limpieza'
    }

    if (nombreNormalizado.includes('convivencia')) {
      return 'convivencia'
    }

    if (nombreNormalizado.includes('saneamiento')) {
      return 'saneamiento'
    }

    return ''
  }

  function handleCategoriaChange(id: string) {
    setCategoriaId(id)
    setSubcategoria('')

    const categoriaSeleccionada = categories.find(
      (category) => category.id === id
    )

    setCategoriaNombre(categoriaSeleccionada?.name ?? '')
  }

  function seleccionarUbicacion(
    nuevaLatitud: number,
    nuevaLongitud: number
  ) {
    cancelarGeocodificacion()
    setLatitud(nuevaLatitud)
    setLongitud(nuevaLongitud)
    setEstadoUbicacion('Buscando la dirección del punto...')

    temporizadorGeocodificacionRef.current = setTimeout(async () => {
      const controller = new AbortController()
      geocodificacionRef.current = controller

      try {
        const params = new URLSearchParams({
          format: 'jsonv2',
          lat: String(nuevaLatitud),
          lon: String(nuevaLongitud),
          zoom: '18',
          'accept-language': 'es',
        })
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?${params}`,
          { signal: controller.signal },
        )
        if (!response.ok) {
          throw new Error(`Geocodificación inversa falló (${response.status})`)
        }

        const result: { display_name?: string } = await response.json()
        const direccion = result.display_name?.trim()
          || `${nuevaLatitud.toFixed(6)}, ${nuevaLongitud.toFixed(6)}`
        ubicacionDesdeMapaRef.current = direccion
        setUbicacion(direccion)
        setEstadoUbicacion(
          result.display_name
            ? 'La dirección se completó desde el mapa.'
            : 'No se encontró una dirección; se guardará el punto seleccionado.',
        )
      } catch (locationError: unknown) {
        if (locationError instanceof Error && locationError.name === 'AbortError') {
          return
        }
        const coordenadas = `${nuevaLatitud.toFixed(6)}, ${nuevaLongitud.toFixed(6)}`
        ubicacionDesdeMapaRef.current = coordenadas
        setUbicacion(coordenadas)
        setEstadoUbicacion(
          'No se pudo buscar la dirección; se guardaron las coordenadas del punto.',
        )
      }
    }, 1000)
  }

  useEffect(() => {
    const consulta = ubicacion.trim()
    if (!consulta || consulta === ubicacionDesdeMapaRef.current) {
      return
    }
    if (consulta.length < 4) {
      return
    }

    const controller = new AbortController()
    geocodificacionRef.current?.abort()
    geocodificacionRef.current = controller

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          format: 'jsonv2',
          addressdetails: '1',
          countrycodes: 'uy',
          limit: '1',
          bounded: '1',
          viewbox: `${limitesMelo.west},${limitesMelo.north},${limitesMelo.east},${limitesMelo.south}`,
          q: `${consulta}, Melo, Uruguay`,
        })
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?${params}`,
          { signal: controller.signal },
        )
        if (!response.ok) {
          throw new Error(`Geocodificación falló (${response.status})`)
        }

        const results: { lat: string; lon: string }[] = await response.json()
        if (results.length === 0) {
          setEstadoUbicacion('No encontramos esa dirección dentro de Melo.')
          return
        }

        setLatitud(Number(results[0].lat))
        setLongitud(Number(results[0].lon))
        setEstadoUbicacion('Ubicación encontrada en el mapa.')
      } catch (locationError: unknown) {
        if (locationError instanceof Error && locationError.name === 'AbortError') {
          return
        }
        setEstadoUbicacion('No se pudo buscar la dirección. Podés marcar el punto en el mapa.')
      }
    }, 1000)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [ubicacion])

  useEffect(() => () => cancelarGeocodificacion(), [])

  function handleEvidenciaChange(file: File | null) {
    setEvidencia(file)

    if (!file) {
      setVistaPrevia('')
      return
    }

    const url = URL.createObjectURL(file)
    setVistaPrevia(url)
  }

  async function copiarCodigoSeguimiento() {
    if (!resultado) return

    try {
      await navigator.clipboard.writeText(resultado.codigo)
      setCodigoCopiado(true)
      window.setTimeout(() => setCodigoCopiado(false), 1800)
    } catch {
      setCodigoCopiado(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    setError('')
    setResultado(null)
    setCodigoCopiado(false)

    if (
      !categoriaId ||
      !subcategoria ||
      !descripcion ||
      !latitud ||
      !longitud
    ) {
      setError('Completá todos los campos obligatorios.')
      return
    }

    try {
      const categoriaSeleccionada = categories.find(
        (category) => category.id === categoriaId
      )

      const response = await api.post<CreateReportResponse>('/denuncias', {
        title: subcategoria,
        description: descripcion,
        type: categoriaSeleccionada?.type ?? 'URBANO',
        latitude: Number(latitud),
        longitude: Number(longitud),
        address: ubicacion,
        categoryId: categoriaId,
      })

      let fotoAdjuntada = true

      if (evidencia) {
        const formData = new FormData()
        formData.append('file', evidencia)

        try {
          await api.post(
            `/denuncias/${response.data.data.id}/evidencia`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          )
        } catch {
          fotoAdjuntada = false
        }
      }

      setCategoriaId('')
      setCategoriaNombre('')
      setSubcategoria('')
      setDescripcion('')
      setUbicacion('')
      ubicacionDesdeMapaRef.current = ''
      setEstadoUbicacion('')
      setLatitud(null)
      setLongitud(null)

      setEvidencia(null)
      setVistaPrevia('')

      const { emailConfirmation, entityName, id } = response.data.data;
      const routingMessage = entityName
        ? ` Organismo asignado: ${entityName}.`
        : ' La denuncia quedó sin organismo asignado.';
      const confirmationMessage =
        emailConfirmation === 'sent'
          ? ' Se envió la confirmación a tu correo.'
          : emailConfirmation === 'skipped'
            ? ''
            : ' No se pudo enviar la confirmación por correo; guarda el identificador.';
      setResultado({
        codigo: formatReportIdentifier(id),
        detalles: [routingMessage.trim(), confirmationMessage.trim()]
          .filter(Boolean)
          .join(' '),
        aviso: fotoAdjuntada
          ? ''
          : 'El reporte se guardó, pero no se pudo adjuntar la foto.',
      })
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'No se pudo registrar la denuncia.'))
    }
  }

  const claveCategoria = obtenerClaveCategoria(categoriaNombre)

  return (
    <main className="denuncia-page">

      <h1>Crear reporte</h1>
      <p>Completá los datos para registrar un nuevo reporte.</p>

      <form className="denuncia-form" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="categoria">Categoría</label>

          <select
            id="categoria"
            value={categoriaId}
            onChange={(e) => handleCategoriaChange(e.target.value)}
            required
          >
            <option value="">Seleccioná una categoría</option>

            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="subcategoria">Subcategoría</label>

          <select
            id="subcategoria"
            value={subcategoria}
            onChange={(e) => setSubcategoria(e.target.value)}
            disabled={!claveCategoria}
            required
          >
            <option value="">
              {claveCategoria
                ? 'Seleccioná una subcategoría'
                : 'Primero elegí una categoría'}
            </option>

            {claveCategoria &&
              subcategorias[
                claveCategoria as keyof typeof subcategorias
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label htmlFor="descripcion">Descripción</label>

          <textarea
            id="descripcion"
            placeholder="Describí el problema..."
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={MAX_DESCRIPTION_LENGTH}
            required
          />
          <p className="descripcion-character-count" aria-live="polite">
            {MAX_DESCRIPTION_LENGTH - descripcion.length} caracteres disponibles
          </p>
        </div>

        <div>
          <label htmlFor="ubicacion">Ubicación</label>

          <input
            id="ubicacion"
            type="text"
            placeholder="Ej: Av. Italia 2450, esquina Propios"
            value={ubicacion}
            onChange={(e) => {
              const value = e.target.value
              ubicacionDesdeMapaRef.current = ''
              cancelarGeocodificacion()
              setLatitud(null)
              setLongitud(null)
              setEstadoUbicacion(
                value.trim().length >= 4 ? 'Buscando esta ubicación en el mapa...' : '',
              )
              setUbicacion(value)
            }}
          />
          {estadoUbicacion && (
            <p className="ubicacion-estado" role="status">{estadoUbicacion}</p>
          )}
        </div>

        <div>
          <label>
            <span className="denuncia-label-content">
              <svg className="denuncia-label-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              Ubicación en el mapa
            </span>
          </label>

          <p className="mapa-ayuda">
            Escribí una dirección de Melo o haz clic en el mapa. La búsqueda
            de direcciones usa OpenStreetMap.
          </p>

          <MapContainer
            center={[-32.3667, -54.1833]}
            zoom={14}
            minZoom={13}
            maxBounds={[
              [-32.42, -54.25],
              [-32.31, -54.11],
            ]}
            maxBoundsViscosity={1.0}
            className="mapa-ubicacion"
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <SelectorUbicacion
              onSeleccionar={seleccionarUbicacion}
            />
            <CentrarUbicacion latitud={latitud} longitud={longitud} />
          </MapContainer>

          {latitud !== null && longitud !== null && (
            <p className="ubicacion-seleccionada">
              ✓ Ubicación seleccionada
            </p>
          )}
        </div>

        <div>
          <label htmlFor="evidencia">
            <span className="denuncia-label-content">
              <svg className="denuncia-label-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 4h-4L8.5 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.5L14 4Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Evidencia
            </span>
          </label>

          <input
            id="evidencia"
            type="file"
            accept="image/*"
            onChange={(e) =>
              handleEvidenciaChange(e.target.files?.[0] ?? null)
            }
          />

          <p className="evidencia-ayuda">
            Podés adjuntar una foto del problema.
          </p>

          {vistaPrevia && (
            <div className="evidencia-preview">
              <img
                src={vistaPrevia}
                alt="Vista previa de la evidencia"
              />
            </div>
          )}
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit">Enviar reporte</button>
      </form>

      {resultado && (
        <div className="reporte-success-overlay">
          <section
            className="reporte-success-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reporte-success-title"
          >
            <div className="reporte-success-check" aria-hidden="true">✓</div>

            <h2 id="reporte-success-title">Reporte enviado con éxito</h2>
            <p className="reporte-success-description">
              Tu reporte fue registrado correctamente.
            </p>

            {resultado.aviso && (
              <p className="reporte-success-warning">{resultado.aviso}</p>
            )}

            <div className="tracking-code-group">
              <span>Código de seguimiento</span>
              <div className="tracking-code-box">
                <code>{resultado.codigo}</code>
                <button
                  type="button"
                  className={`tracking-copy-button${codigoCopiado ? ' is-copied' : ''}`}
                  aria-label={codigoCopiado ? 'Código copiado' : 'Copiar código'}
                  title={codigoCopiado ? 'Copiado' : 'Copiar código'}
                  onClick={() => void copiarCodigoSeguimiento()}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="8" y="8" width="12" height="12" rx="2" />
                    <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
                  </svg>
                </button>
              </div>
            </div>

            {resultado.detalles && (
              <p className="reporte-success-details">{resultado.detalles}</p>
            )}

            <button
              type="button"
              className="reporte-success-accept"
              onClick={() => setResultado(null)}
            >
              Aceptar
            </button>
          </section>
        </div>
      )}

    </main>
  )
}
export default CrearDenuncia