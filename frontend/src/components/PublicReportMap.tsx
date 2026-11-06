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
  subcategories: string[]
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
  const [subcategories, setSubcategories] = useState<string[]>([])
  const [subcategory, setSubcategory] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadZones() {
      try {
        const { data } = await api.get<{ data: PublicMapData }>(
          '/denuncias/public/mapa',
          { params: subcategory ? { subcategory } : {} },
        )
        if (active) {
          setZones(data.data.items)
          setResolvedCount(data.data.resolvedCount)
          setSubcategories(data.data.subcategories)
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
  }, [subcategory])

  const orderedZones = [...zones].sort((a, b) => a.count - b.count)

  return (
    <section className="public-report-map" aria-labelledby="public-report-map-title">
      <h2 id="public-report-map-title">Reportes en curso</h2>
      <div className="public-report-map-intro">
        <p>
          Estos reportes están activos actualmente. ¡Estamos trabajando para
          mejorar nuestra ciudad!
        </p>
        <div className="public-report-map-resolved" aria-live="polite">
          <strong>{resolvedCount ?? '—'}</strong>
          <span>reportes resueltos</span>
        </div>
      </div>
      <label className="public-report-map-filter" htmlFor="public-map-subcategory">
        Filtrar por subcategoría
        <select
          id="public-map-subcategory"
          value={subcategory}
          onChange={(event) => setSubcategory(event.target.value)}
        >
          <option value="">Todas las subcategorías</option>
          {subcategories.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>
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
          No hay zonas con suficientes reportes para este filtro.
        </p>
      )}
      <div className="public-report-map-legend" aria-label="Intensidad del mapa">
        <span>Menos</span>
        <i className="heat-low" aria-hidden="true" />
        <i className="heat-medium" aria-hidden="true" />
        <i className="heat-high" aria-hidden="true" />
        <i className="heat-very-high" aria-hidden="true" />
        <span>Más reportes</span>
      </div>
    </section>
  )
}

export default PublicReportMap
