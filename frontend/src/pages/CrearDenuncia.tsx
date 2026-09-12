import { useState } from 'react'
import './CrearDenuncia.css'

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
  const [categoria, setCategoria] = useState('')

  return (
    <main className='denuncia-page'>
      <h1>Crear denuncia</h1>
      <p>Completá los datos para registrar una nueva denuncia.</p>

      <form className='denuncia-form'>
        <div>
          <label htmlFor="categoria">Categoría</label>

          <select
            id="categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="">Seleccioná una categoría</option>
            <option value="infraestructura">Infraestructura</option>
            <option value="limpieza">Limpieza</option>
            <option value="convivencia">Convivencia</option>
          </select>
        </div>

          <div>
  <label htmlFor="subcategoria">Subcategoría</label>

  <select
    id="subcategoria"
    disabled={!categoria}
  >
    <option value="">
      {categoria
        ? 'Seleccioná una subcategoría'
        : 'Primero elegí una categoría'}
    </option>

    {categoria &&
      subcategorias[categoria as keyof typeof subcategorias].map(
        (subcategoria) => (
          <option key={subcategoria} value={subcategoria}>
            {subcategoria}
          </option>
        )
      )}
  </select>
</div>
        <div>
          <label htmlFor="descripcion">Descripción</label>

          <textarea
            id="descripcion"
            placeholder="Describí el problema..."
          />
        </div>
        <div>
  <label htmlFor="ubicacion">Ubicación</label>

  <input
    id="ubicacion"
    type="text"
    placeholder="Ej: Av. Italia 2450, esquina Propios"
  />
</div>
<div>
  <label htmlFor="evidencia">Evidencia</label>

  <input
    id="evidencia"
    type="file"
    accept="image/*"
  />
</div>
        <button type="submit">Enviar denuncia</button>
      </form>
    </main>
  )
}


export default CrearDenuncia