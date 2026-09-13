import { useEffect, useState, type FormEvent } from 'react'
import './CrearDenuncia.css'
import { api } from '../lib/api'

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
  const [mensaje, setMensaje] = useState('')
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    setError('')
    setMensaje('')

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

      await api.post('/denuncias', {
        title: subcategoria,
        description: descripcion,
        type: categoriaSeleccionada?.type ?? 'URBANO',
        latitude: Number(latitud),
        longitude: Number(longitud),
        address: ubicacion,
        categoryId: categoriaId,
      })

      setCategoriaId('')
      setCategoriaNombre('')
      setSubcategoria('')
      setDescripcion('')
      setUbicacion('')
      setLatitud('')
      setLongitud('')

      setMensaje('Reporte registrado correctamente.')
    } catch (err: any) {
      setError(
        err.response?.data?.message ??
          'No se pudo registrar la denuncia.'
      )
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
  <label>Ubicación en el mapa</label>

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
  <label htmlFor="evidencia">Evidencia</label>

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
        {mensaje && <p className="notice">{mensaje}</p>}

        <button type="submit">Enviar reporte</button>
         </form>
    </main>
  )
  }
export default CrearDenuncia