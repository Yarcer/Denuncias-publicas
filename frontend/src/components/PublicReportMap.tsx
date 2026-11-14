import { useEffect, useState } from 'react'
import {
  Circle,
  MapContainer,
  TileLayer,
  Tooltip,
} from 'react-leaflet'
import { api } from '../lib/api'
import { getApiErrorMessage } from '../lib/api-error'
import './PublicReportMap.css'
import 'leaflet/dist/leaflet.css'

type PublicMapZone = {
  latitude: number
  longitude: number
  count: number
}

type PublicMapData = {
  items: PublicMapZone[]
  resolvedCount: number
  categories: string[]
}

function getHeatStyle(count: number) {
  if (count >= 20) {
    return { color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 0.66 }
  }
  if (count >= 10) {
    return { color: '#c2410c', fillColor: '#f97316', fillOpacity: 0.58 }
  }
  if (count >= 6) {
    return { color: '#a16207', fillColor: '#eab308', fillOpacity: 0.5 }
  }
  return { color: '#15803d', fillColor: '#22c55e', fillOpacity: 0.42 }
}

function PublicReportMap() {
  const [zones, setZones] = useState<PublicMapZone[]>([])
  const [resolvedCount, setResolvedCount] = useState<number | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadZones() {
      try {
        const { data } = await api.get<{ data: PublicMapData }>(
          '/denuncias/public/mapa',
          { params: category ? { category } : {} },
        )
        if (active) {
          setZones(data.data.items)
          setResolvedCount(data.data.resolvedCount)
          setCategories(data.data.categories)
          setError('')
        }
      } catch (cause: unknown) {
        if (active) {
          setError(getApiErrorMessage(cause, 'No se pudo cargar el mapa.'))
        }
      }
    }

    void loadZones()
    const refreshInterval = window.setInterval(() => {
      void loadZones()
    }, 60_000)

    return () => {
      active = false
      window.clearInterval(refreshInterval)
    }
  }, [category])

  const orderedZones = [...zones].sort((a, b) => a.count - b.count)

  return (
    <div className="public-home-map-column">
      <section
        className="public-report-map-resolved-summary"
        aria-label="Reportes resueltos hasta ahora"
        aria-live="polite"
      >
        <span>Reportes resueltos hasta ahora</span>
        <strong>{resolvedCount ?? '—'}</strong>
      </section>
      <div className="public-home-map-frame">
        <section className="public-report-map" aria-labelledby="public-report-map-title">
          <h2 id="public-report-map-title">Reportes en curso ahora</h2>
          <p className="public-report-map-description">
            En el mapa puedes ver los reportes que están en proceso de ser
            arreglados. ¡Estamos trabajando en mejorar nuestra ciudad ahora mismo!
          </p>
          {error && <p className="public-report-map-error" role="alert">{error}</p>}
          <MapContainer
            center={[-32.3667, -54.1833]}
            zoom={12}
            minZoom={11}
            maxZoom={15}
            maxBounds={[
              [-32.48, -54.31],
              [-32.25, -54.05],
            ]}
            maxBoundsViscosity={1}
            className="public-report-map-canvas"
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {orderedZones.map((zone) => (
              <Circle
                key={`${zone.latitude},${zone.longitude}`}
                center={[zone.latitude, zone.longitude]}
                radius={1250}
                pathOptions={{
                  ...getHeatStyle(zone.count),
                  weight: 1,
                }}
              >
                <Tooltip sticky>
                  {zone.count} {zone.count === 1 ? 'reporte' : 'reportes'} en esta zona
                </Tooltip>
              </Circle>
            ))}
          </MapContainer>
          {!error && zones.length === 0 && (
            <p className="public-report-map-empty">
              No hay zonas con suficientes reportes para esta categoría.
            </p>
          )}
          <div className="public-report-map-filter-section">
            <div className="public-report-map-filter-heading">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5h16l-6.2 7v5l-3.6 2v-7L4 5Z" />
              </svg>
              <span>Categorías</span>
            </div>
            <div className="public-report-map-filters" role="group" aria-label="Filtrar reportes por categoría">
              <button
                type="button"
                className={category === '' ? 'active' : ''}
                aria-pressed={category === ''}
                onClick={() => setCategory('')}
              >
                Todas
              </button>
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={category === item ? 'active' : ''}
                  aria-pressed={category === item}
                  onClick={() => setCategory(category === item ? '' : item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default PublicReportMap
