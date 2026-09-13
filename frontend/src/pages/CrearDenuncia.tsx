import { useEffect, useState, type FormEvent } from 'react'
import './CrearDenuncia.css'
import { api } from '../lib/api'

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

function CrearDenuncia() {
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriaId, setCategoriaId] = useState('')
  const [categoriaNombre, setCategoriaNombre] = useState('')
  const [subcategoria, setSubcategoria] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [latitud, setLatitud] = useState('')
  const [longitud, setLongitud] = useState('')
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

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
          <label htmlFor="latitud">Latitud</label>

          <input
            id="latitud"
            type="number"
            step="any"
            placeholder="-34.9011"
            value={latitud}
            onChange={(e) => setLatitud(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="longitud">Longitud</label>

          <input
            id="longitud"
            type="number"
            step="any"
            placeholder="-56.1645"
            value={longitud}
            onChange={(e) => setLongitud(e.target.value)}
            required
          />
        </div>

        {error && <p className="error">{error}</p>}
        {mensaje && <p className="notice">{mensaje}</p>}

        <button type="submit">Enviar reporte</button>
      </form>
    </main>
  )
}

export default CrearDenuncia