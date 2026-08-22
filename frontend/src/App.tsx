import './App.css'

function App() {
  return (
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
            <button type="button" className="secondary">
              Crear reporte
            </button>
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
  )
}

export default App
