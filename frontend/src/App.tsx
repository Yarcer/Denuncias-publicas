import { useEffect, useState, type FormEvent } from 'react';
import './App.css';
import { api } from './lib/api';
import { useAuthStore } from './stores/auth-store';
import CrearDenuncia from './pages/CrearDenuncia'
import puntoReporteLogo from './assets/puntoreporte-logo.jpg';

type Report = { id: string; title: string; description: string; status: string };
type ManagedReport = Report & {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  reporter?: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  assignee?: { email: string } | null;
  evidence?: {
    id: string;
    url: string;
    type: string;
  }[];
};

function ReportImage({
  reportId,
  evidenceId,
}: {
  reportId: string;
  evidenceId: string;
}) {
  const [imageUrl, setImageUrl] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let url = '';
    let active = true;

    async function loadImage() {
      try {
        const response = await api.get(
          `/denuncias/${reportId}/evidencia/${evidenceId}`,
          { responseType: 'blob' },
        );

        url = URL.createObjectURL(response.data);

        if (active) {
          setImageUrl(url);
        } else {
          URL.revokeObjectURL(url);
        }
      } catch {
        // Si falla la foto, el reporte igualmente se muestra.
      }
    }

    void loadImage();

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [reportId, evidenceId]);

  useEffect(() => {
    if (!expanded) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [expanded]);

  if (!imageUrl) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="Ampliar foto del reporte"
        style={{
          display: 'block',
          padding: 0,
          border: 0,
          background: 'none',
          cursor: 'pointer',
          marginTop: '12px',
        }}
      >
        <img
          src={imageUrl}
          alt="Foto adjunta al reporte"
          style={{
            display: 'block',
            width: '180px',
            maxHeight: '140px',
            objectFit: 'cover',
            borderRadius: '8px',
          }}
        />
      </button>

      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'default',
          }}
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Cerrar foto"
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              fontSize: '28px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>

          <img
            src={imageUrl}
            alt="Foto ampliada del reporte"
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '90vh',
              objectFit: 'contain',
              cursor: 'default',
            }}
          />
        </div>
      )}
    </>
  );

}

function ManagementDashboard({ isAdmin, onLogout }: { isAdmin: boolean; onLogout: () => void }) {
  const [reports, setReports] = useState<ManagedReport[]>([]);
  const [filter, setFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  async function loadReports(selectedStatus = filter) {
    try {
      const response = await api.get(
        '/denuncias/gestion/bandeja',
        selectedStatus === 'active' ? {} : { params: { status: selectedStatus } },
      );
      setReports(response.data.data.items);
      setError('');
    } catch (loadError: any) {
      setError(loadError.response?.data?.message ?? 'No se pudo cargar la bandeja.');
    }
  }

  useEffect(() => {
    void loadReports();
  }, [filter]);

  async function archiveReport(id: string) {
    try {
      await api.patch(`/denuncias/${id}/archivar`);
      await loadReports();
    } catch (archiveError: any) {
      setError(
        archiveError.response?.data?.message ?? 'No se pudo archivar la denuncia.',
      );
    }
  }

  async function takeReport(id: string) {
    try {
      await api.post(`/denuncias/${id}/tomar`);
      await loadReports();
    } catch (takeError: any) {
      setError(takeError.response?.data?.message ?? 'No se pudo tomar la denuncia.');
    }
  }

  async function changeStatus(id: string, status: string) {
    try {
      await api.patch(`/denuncias/${id}/estado`, { status });
      await loadReports();
    } catch (statusError: any) {
      setError(statusError.response?.data?.message ?? 'No se pudo actualizar el estado.');
    }
  }

  const activeColumns = [
    { title: 'Pendientes', status: 'PENDIENTE' },
    { title: 'En revisión', status: 'EN_REVISION' },
    { title: 'Asignadas', status: 'ASIGNADO' },
    { title: 'En proceso', status: 'EN_PROCESO' },
  ];

  const filterLabels: Record<string, string> = {
    PENDIENTE: 'Pendientes',
    ASIGNADO: 'Asignadas',
    EN_REVISION: 'En revisión',
    EN_PROCESO: 'En proceso',
    RESUELTO: 'Resueltas',
    RECHAZADO: 'Denegadas',
    archived: 'Archivadas',
  };

  const columns = filter === 'active'
    ? activeColumns
    : [{ title: filterLabels[filter] ?? 'Reportes', status: '' }];

  const search = searchTerm.trim().toLowerCase();
  const visibleReports = reports.filter((item) => {
    const searchableText = [
      item.title,
      item.description,
      item.address,
      item.reporter?.firstName,
      item.reporter?.lastName,
      item.reporter?.email,
    ].filter(Boolean).join(' ').toLowerCase();
    return searchableText.includes(search);
  });

  const pendingCount = reports.filter((item) => item.status === 'PENDIENTE').length;
  const inProgressCount = reports.filter((item) => item.status === 'EN_PROCESO').length;
  const isArchivedView = filter === 'archived';

  function scrollToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <main className="app-shell admin-app-shell">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-brand" aria-label="PuntoReporte">
            <span>Punto</span>Reporte
            <small>Gestión urbana</small>
          </div>

          <nav className="admin-nav" aria-label="Navegación de administración">
            <button type="button" onClick={() => scrollToSection('admin-summary')}>
              <span aria-hidden="true">⌂</span> Resumen
            </button>
            <button
              type="button"
              className={!isArchivedView ? 'admin-nav-active' : ''}
              onClick={() => {
                setFilter('active');
                scrollToSection('admin-board');
              }}
            >
              <span aria-hidden="true">▤</span> Bandeja de denuncias
            </button>
            <button
              type="button"
              className={isArchivedView ? 'admin-nav-active' : ''}
              onClick={() => setFilter('archived')}
            >
              <span aria-hidden="true">▣</span> Archivadas
            </button>
          </nav>

          <button type="button" className="admin-logout" onClick={onLogout}>
            <span aria-hidden="true">↪</span> Cerrar sesión
          </button>
        </aside>

        <section className="admin-main">
          <header className="admin-header">
            <div className="admin-page-title">
              <span className="eyebrow">{isAdmin ? 'Administración' : 'Ente público'}</span>
              <h1>Bandeja de denuncias</h1>
              <p>Organiza y sigue los reportes de la ciudad.</p>
            </div>

            <div className="admin-header-tools">
              <label className="admin-search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  placeholder="Buscar denuncias..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  aria-label="Buscar denuncias"
                />
              </label>
              <select
                className="admin-filter"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                aria-label="Filtrar denuncias por estado"
              >
                <option value="active">Activas · tablero</option>
                <option value="PENDIENTE">Pendientes</option>
                <option value="ASIGNADO">Asignadas</option>
                <option value="EN_REVISION">En revisión</option>
                <option value="EN_PROCESO">En proceso</option>
                <option value="RESUELTO">Resueltas</option>
                <option value="RECHAZADO">Denegadas</option>
                <option value="archived">Archivadas</option>
              </select>
            </div>
          </header>

          {error && <p className="error management-error">{error}</p>}

          <section className="admin-summary" id="admin-summary" aria-label="Resumen de la vista">
            <article className="admin-summary-card admin-summary-blue">
              <span className="admin-summary-icon" aria-hidden="true">▤</span>
              <div><span>Casos en esta vista</span><strong>{reports.length}</strong></div>
            </article>
            <article className="admin-summary-card admin-summary-amber">
              <span className="admin-summary-icon" aria-hidden="true">◷</span>
              <div><span>Pendientes</span><strong>{pendingCount}</strong></div>
            </article>
            <article className="admin-summary-card admin-summary-green">
              <span className="admin-summary-icon" aria-hidden="true">✓</span>
              <div><span>En proceso</span><strong>{inProgressCount}</strong></div>
            </article>
          </section>

          <div className="admin-board-heading" id="admin-board">
            <div>
              <h2>{isArchivedView ? 'Reportes archivados' : 'Flujo de trabajo'}</h2>
              <p>{visibleReports.length} {visibleReports.length === 1 ? 'reporte visible' : 'reportes visibles'}</p>
            </div>
          </div>

          <section className={`admin-board ${filter === 'active' ? 'admin-board-active' : 'admin-board-single'}`}>
            {columns.map((column) => {
              const columnReports = column.status
                ? visibleReports.filter((item) => item.status === column.status)
                : visibleReports;

              return (
                <div className="admin-column" key={column.title}>
                  <header className="admin-column-header">
                    <h3>{column.title}</h3>
                    <span>{columnReports.length}</span>
                  </header>

                  <div className="admin-column-cards">
                    {columnReports.length === 0 ? (
                      <p className="admin-column-empty">
                        {search ? 'No hay coincidencias.' : 'No hay denuncias aquí.'}
                      </p>
                    ) : columnReports.map((item) => (
                      <article className="admin-report-card" key={item.id}>
                        <div className="admin-report-copy">
                          <span className={`admin-status-chip admin-status-${item.status.toLowerCase()}`}>
                            {item.status.replace(/_/g, ' ')}
                          </span>
                          <h4>{item.title}</h4>
                          <p>{item.description}</p>
                          <div className="admin-report-meta">
                            <span><b aria-hidden="true">⌖</b>{item.address || 'Ubicación sin dirección'}</span>
                            <span><b aria-hidden="true">♙</b>{item.reporter?.firstName || item.reporter?.email || 'Ciudadano'}</span>
                          </div>

                          {item.latitude != null && item.longitude != null && (
                            <a
                              className="admin-map-link"
                              href={`https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}#map=17/${item.latitude}/${item.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <span aria-hidden="true">⌖</span> Ver mapa
                            </a>
                          )}

                          {item.evidence?.map((photo) => (
                            <ReportImage
                              key={photo.id}
                              reportId={item.id}
                              evidenceId={photo.id}
                            />
                          ))}
                        </div>

                        <div className="admin-report-actions">
                          {!item.assignee && (
                            <button onClick={() => takeReport(item.id)}>Tomar denuncia</button>
                          )}
                          {item.assignee && (
                            <>
                              <button className="secondary" onClick={() => changeStatus(item.id, 'EN_REVISION')}>
                                En revisión
                              </button>
                              <button className="secondary" onClick={() => changeStatus(item.id, 'EN_PROCESO')}>
                                Iniciar trabajo
                              </button>
                              <button onClick={() => changeStatus(item.id, 'RESUELTO')}>
                                Marcar resuelta
                              </button>
                              <button className="danger" onClick={() => changeStatus(item.id, 'RECHAZADO')}>
                                Denegar
                              </button>
                            </>
                          )}
                          {item.status === 'RECHAZADO' && filter !== 'archived' && (
                            <button className="secondary" onClick={() => archiveReport(item.id)}>
                              Archivar
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        </section>
      </div>
    </main>
  );
}

function App() {
  const { user, setSession, clearSession } = useAuthStore();
  const [registering, setRegistering] = useState(false);
  const [credentials, setCredentials] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState('');
  const [menuCuentaAbierto, setMenuCuentaAbierto] = useState(false);
  const [vistaCiudadano, setVistaCiudadano] =
    useState<'crear' | 'reportes'>('crear');

  useEffect(() => {
    if (!user) return;

    async function cargarDatos() {
      try {
        const reportsResponse = await api.get('/denuncias');
        setReports(reportsResponse.data.data.items);
        console.log('Reportes cargados correctamente');
      } catch (error) {
        console.error('Error cargando reportes:', error);
      }

    }

    void cargarDatos();
  }, [user]);

  async function handleAuth(event: FormEvent) {
    event.preventDefault();

    setError('');

    try {
      const payload = registering
        ? credentials
        : {
          email: credentials.email,
          password: credentials.password,
        };

      const response = await api.post(
        registering ? '/auth/register' : '/auth/login',
        payload
      );

      setSession(response.data.data.user, response.data.data.accessToken);
    } catch (authError: any) {
      setError(
        authError.response?.data?.message ?? 'No se pudo iniciar sesión.'
      );
    }
  }

  async function handleAnonymousLogin() {
    setError('');
    try {
      const response = await api.post('/auth/anonymous');
      setSession(response.data.data.user, response.data.data.accessToken);
    } catch (anonymousError: any) {
      setError(anonymousError.response?.data?.message ?? 'No se pudo crear la sesión temporal.');
    }
  }

  if (!user) {
    return (
      <main className="app-shell">
        <section className="auth-card">
          <div className="hero-copy">
            <img
              src={puntoReporteLogo}
              alt="PuntoReporte"
              className="auth-logo"
            />

            <span className="eyebrow">Reportes públicos</span>

            <h1>Tu ciudad también se cuida reportando.</h1>

            <p>
              Registrá incidentes y consultá el avance de cada reporte desde un solo lugar.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleAuth}>
            <h2>{registering ? 'Crear cuenta' : 'Iniciar sesión'}</h2>

            {registering && (
              <div className="form-row">
                <input
                  placeholder="Nombre"
                  value={credentials.firstName}
                  onChange={(event) =>
                    setCredentials({
                      ...credentials,
                      firstName: event.target.value,
                    })
                  }
                />

                <input
                  placeholder="Apellido"
                  value={credentials.lastName}
                  onChange={(event) =>
                    setCredentials({
                      ...credentials,
                      lastName: event.target.value,
                    })
                  }
                />
              </div>
            )}

            <input
              required
              type="email"
              placeholder="Correo electrónico"
              value={credentials.email}
              onChange={(event) =>
                setCredentials({
                  ...credentials,
                  email: event.target.value,
                })
              }
            />

            <input
              required
              minLength={6}
              type="password"
              placeholder="Contraseña"
              value={credentials.password}
              onChange={(event) =>
                setCredentials({
                  ...credentials,
                  password: event.target.value,
                })
              }
            />

            {error && <p className="error">{error}</p>}

            <button type="submit">
              {registering ? 'Registrarme' : 'Entrar'}
            </button>

            <button
              type="button"
              className="link-button"
              onClick={() => setRegistering(!registering)}
            >
              {registering ? 'Ya tengo una cuenta' : 'Crear una cuenta'}
            </button>

            <span className="divider">o</span>

            <button
              type="button"
              className="secondary"
              onClick={handleAnonymousLogin}
            >
              Entrar como visitante
            </button>

            <small className="helper-text">
              La sesión de visitante es temporal y no requiere registro.
            </small>
          </form>
        </section>
      </main>
    );
  }

  if (user.role === 'ENTE_PUBLICO' || user.role === 'ADMINISTRADOR') {
    return <ManagementDashboard isAdmin={user.role === 'ADMINISTRADOR'} onLogout={clearSession} />;
  }
  return (
    <main className="app-shell">
      <section className="dashboard">

        <nav className="ciudadano-nav">
          <div className="ciudadano-nav-logo">
            <img
              src={puntoReporteLogo}
              alt="PuntoReporte"
            />
          </div>

          <div className="ciudadano-nav-links">
            <button type="button">
              Inicio
            </button>

            <button
              type="button"
              className={vistaCiudadano === 'crear' ? 'nav-activo' : ''}
              onClick={() => setVistaCiudadano('crear')}
            >
              Crear reporte
            </button>

            <button
              type="button"
              className={vistaCiudadano === 'reportes' ? 'nav-activo' : ''}
              onClick={() => setVistaCiudadano('reportes')}
            >
              Mis reportes
            </button>

            <div className="cuenta-menu">
              <button
                type="button"
                onClick={() => setMenuCuentaAbierto(!menuCuentaAbierto)}
              >
                Mi cuenta
              </button>

              {menuCuentaAbierto && (
                <div className="cuenta-dropdown">
                  <span>{user.firstName || user.email}</span>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuCuentaAbierto(false);
                      clearSession();
                    }}
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>

          </div>
        </nav>

        <header className="dashboard-header">
          <div>
            <span className="eyebrow">Panel ciudadano</span>
            <h1>Hola, {user.firstName || user.email}</h1>
          </div>
        </header>

        {vistaCiudadano === 'crear' && (
          <CrearDenuncia />
        )}

        {vistaCiudadano === 'reportes' && (
          <section className="reports-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow" style={{ color: '#000000' }}>
                  Historial
                </span>
                <h2>Mis reportes</h2>
              </div>

              <strong>{reports.length}</strong>
            </div>

            {reports.length === 0 ? (
              <p className="empty-state">
                Todavía no tienes reportes registrados.
              </p>
            ) : (
              reports.map((item) => (
                <article
                  className="report-item"
                  key={item.id}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>

                  <span>{item.status}</span>
                </article>
              ))
            )}
          </section>
        )}

      </section>
    </main>
  )
}
export default App;