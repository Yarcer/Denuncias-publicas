import { useEffect, useState, type FormEvent } from 'react'
import './CrearDenuncia.css'
import { api } from '../lib/api'
import { getApiErrorMessage } from '../lib/api-error'
import { formatReportIdentifier } from '../lib/report-id'

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
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
}

type SelectorUbicacionProps = {
  latitud: number | null
  longitud: number | null
  onSeleccionar: (latitud: number, longitud: number) => void
}

function SelectorUbicacion({
  latitud,
  longitud,
  onSeleccionar,
}: SelectorUbicacionProps) {
  useMapEvents({
    click(e) {
      onSeleccionar(e.latlng.lat, e.latlng.lng)
    },
  })

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
    setLatitud(nuevaLatitud)
    setLongitud(nuevaLongitud)
  }

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
            required
          />
        </div>

        <div>
          <label htmlFor="ubicacion">Ubicación</label>

          <input
            id="ubicacion"
            type="text"
            placeholder="Ej: Av. Italia 2450, esquina Propios"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
          />
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
            Hacé clic en el mapa para marcar dónde ocurre el problema.
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
              latitud={latitud}
              longitud={longitud}
              onSeleccionar={seleccionarUbicacion}
            />
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