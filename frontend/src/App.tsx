import './App.css'
import { Routes, Route, Link } from 'react-router-dom'
import CrearDenuncia from './pages/CrearDenuncia'

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <main className="app-shell">
            <section className="hero-card">
              <div className="hero-copy">
                <span className="eyebrow">Denuncias públicas</span>
                <h1>Reporta incidentes urbanos, de bomberos y policiales.</h1>

                <p>
                  Una plataforma para registrar denuncias ciudadanas, asignarlas a entes
                  públicos y dar seguimiento en tiempo real.
                </p>
                <div className="actions">
  <button type="button">Iniciar sesión</button>

  <Link to="/crear-denuncia" className="btn-secondary">
    Crear reporte
  </Link>
</div>
              </div>

              <div className="stats-panel">
                <div className="stat-box">
                  <strong>1.240</strong>
                  <span>reportes activos</span>
                </div>

                <div className="stat-box">
                  <strong>86%</strong>
                  <span>resolución en 72h</span>
                </div>

                <div className="stat-box">
                  <strong>24</strong>
                  <span>entes conectados</span>
                </div>
              </div>
            </section>
          </main>
        }
      />

      <Route path="/crear-denuncia" element={<CrearDenuncia />} />
    </Routes>
  )
}

export default App
