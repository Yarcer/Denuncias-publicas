import { useCallback, useEffect, useState, type FormEvent } from 'react';
import './App.css';
import { api } from './lib/api';
import { useAuthStore } from './stores/auth-store';
import CrearDenuncia from './pages/CrearDenuncia'
import puntoReporteLogo from './assets/puntoreporte-logo.png';
import plazaConstitucionMelo from './assets/plaza-constitucion-melo.jpg';

type AuthRoute = 'login' | 'register' | 'anonymous';

function getAuthRoute(pathname = window.location.pathname): AuthRoute {
  if (pathname === '/registro') return 'register';
  if (pathname === '/anonimo') return 'anonymous';
  return 'login';
}

type Report = { id: string; title: string; description: string; status: string };
type ManagedReport = Report & {
  type?: string;
  category?: {
    id: string;
    name: string;
    type: string;
  }
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
  createdAt: string;
};
type ReportHistoryEntry = {
  id: string;
  fromStatus: string;
  toStatus: string;
  createdAt: string;
  report: { id: string; title: string };
  responsible: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    entityName: string | null;
  } | null;
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
  const [historyItems, setHistoryItems] = useState<ReportHistoryEntry[]>([]);
  const [activeSection, setActiveSection] = useState<'queue' | 'history'>('queue');
  const [filter, setFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateOrder, setDateOrder] = useState<'newest' | 'oldest'>('newest');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalityFilter, setModalityFilter] = useState('');
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

  async function loadHistory() {
    try {
      const response = await api.get('/denuncias/gestion/historial');
      setHistoryItems(response.data.data.items);
      setError('');
    } catch (loadError: any) {
      setError(loadError.response?.data?.message ?? 'No se pudo cargar el historial.');
    }
  }

  useEffect(() => {
    void loadReports();
  }, [filter]);

  useEffect(() => {
    if (activeSection === 'history') {
      void loadHistory();
    }
  }, [activeSection]);

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

  const categories = reports.reduce<NonNullable<ManagedReport['category']>[]>(
  (unique, report) => {
    const category = report.category;

    if (category && !unique.some((item) => item.id === category.id)) {
      unique.push(category);
    }

    return unique;
  },
  [],
).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const startOfRange = dateFrom
  ? new Date(`${dateFrom}T00:00:00`).getTime()
  : null;

  const endOfRange = dateTo
  ? new Date(`${dateTo}T23:59:59.999`).getTime()
  : null;

  const visibleReports = reports
    .filter((item) => {
      const createdAt = new Date(item.createdAt).getTime();
      const reporterEmail = item.reporter?.email ?? '';
      const isAnonymous = /^anon-.+@anonymous\.local$/i.test(reporterEmail);
      const searchableText = [
        item.title,
        item.description,
        item.address,
        item.reporter?.firstName,
        item.reporter?.lastName,
        item.reporter?.email,
      ].filter(Boolean).join(' ').toLowerCase();
      return (
        searchableText.includes(search) &&
        (!startOfRange || createdAt >= startOfRange) &&
        (!endOfRange || createdAt <= endOfRange) &&
        (!categoryFilter || item.category?.id === categoryFilter) &&
        (!modalityFilter ||
          (modalityFilter === 'anonymous' ? isAnonymous : !isAnonymous))
      );

    })
    .sort((a, b) => {
      const dateDifference = Date.parse(a.createdAt) - Date.parse(b.createdAt);
      return dateOrder === 'newest' ? -dateDifference : dateDifference;
    });

  const pendingCount = reports.filter((item) => item.status === 'PENDIENTE').length;
  const inProgressCount = reports.filter((item) => item.status === 'EN_PROCESO').length;
  const isArchivedView = filter === 'archived';
  const isHistoryView = activeSection === 'history';
  const visibleHistory = historyItems.filter((item) => {
    const responsibleName = item.responsible
      ? `${item.responsible.firstName ?? ''} ${item.responsible.lastName ?? ''} ${item.responsible.email} ${item.responsible.entityName ?? ''}`
      : 'usuario no disponible';
    return `${item.report.title} ${item.fromStatus} ${item.toStatus} ${responsibleName}`
      .toLowerCase()
      .includes(search);
  });


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
              className={!isArchivedView && !isHistoryView ? 'admin-nav-active' : ''}
              onClick={() => {
                setActiveSection('queue');
                setFilter('active');
                scrollToSection('admin-board');
              }}
            >
              <span aria-hidden="true">▤</span> Bandeja de denuncias
            </button>
            <button
              type="button"
              className={isArchivedView && !isHistoryView ? 'admin-nav-active' : ''}
              onClick={() => {
                setActiveSection('queue');
                setFilter('archived');
              }}
            >
              <span aria-hidden="true">▣</span> Archivadas
            </button>
            <button
              type="button"
              className={isHistoryView ? 'admin-nav-active' : ''}
              onClick={() => setActiveSection('history')}
            >
              <span aria-hidden="true">◷</span> Historial de cambios
            </button>
          </nav>

          <button type="button" className="admin-logout" onClick={onLogout}>
            <span aria-hidden="true">↪</span> Cerrar sesión
          </button>
        </aside>

        <section className="admin-main">
          <div className={`admin-page-layout${isHistoryView ? ' admin-page-layout-history' : ''}`}>
            <div className="admin-page-content">
              <header className="admin-header">
                <div className="admin-page-title">
                  <span className="eyebrow">{isAdmin ? 'Administración' : 'Ente público'}</span>
                  <h1>{isHistoryView ? 'Historial de cambios' : 'Bandeja de denuncias'}</h1>
                  <p>
                    {isHistoryView
                      ? 'Consulta los cambios de estado, cuándo ocurrieron y quién los realizó.'
                      : 'Organiza y sigue los reportes de la ciudad.'}
                  </p>
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
                </div>
              </header>

              {error && <p className="error management-error">{error}</p>}

              {!isHistoryView && <section className="admin-summary" id="admin-summary" aria-label="Resumen de la vista">
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
              </section>}

              {isHistoryView ? (
                <section className="admin-history-section" aria-label="Historial de cambios">
                  <header className="admin-board-heading">
                    <div>
                      <h2>Actividad reciente</h2>
                      <p>{visibleHistory.length} {visibleHistory.length === 1 ? 'cambio' : 'cambios'}</p>
                    </div>
                  </header>
                  {visibleHistory.length === 0 ? (
                    <p className="admin-column-empty">
                      {search ? 'No hay cambios que coincidan con la búsqueda.' : 'Todavía no hay cambios de estado registrados.'}
                    </p>
                  ) : (
                    <div className="admin-history-list">
                      {visibleHistory.map((item) => {
                        const responsibleName = item.responsible
                          ? item.responsible.entityName
                            || `${item.responsible.firstName ?? ''} ${item.responsible.lastName ?? ''}`.trim()
                            || item.responsible.email
                          : 'Usuario no disponible';

                        return (
                          <article className="admin-history-card" key={item.id}>
                            <div className="admin-history-change">
                              <span className={`admin-status-chip admin-status-${item.fromStatus.toLowerCase()}`}>
                                {item.fromStatus.replace(/_/g, ' ')}
                              </span>
                              <span aria-hidden="true">→</span>
                              <span className={`admin-status-chip admin-status-${item.toStatus.toLowerCase()}`}>
                                {item.toStatus.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <h3>{item.report.title}</h3>
                            <p>
                              Modificado por <strong>{responsibleName}</strong>
                            </p>
                            <time dateTime={item.createdAt}>
                              {new Intl.DateTimeFormat('es-UY', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              }).format(new Date(item.createdAt))}
                            </time>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              ) : (
              <div className="admin-results">
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
                                  <span>
                                    Enviado: {new Intl.DateTimeFormat('es-UY', {
                                      dateStyle: 'short',
                                      timeStyle: 'short',
                                    }).format(new Date(item.createdAt))}
                                    </span>
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
              </div>
              )}

            </div>

            {!isHistoryView && <aside className="admin-filter-panel" aria-label="Filtros de denuncias">
              <details open>
                <summary className="admin-filter-heading">
                  <span aria-hidden="true">☷</span>
                  <span className="admin-filter-title">
                    <strong>Filtros</strong>
                  </span>
                  <span className="admin-filter-chevron" aria-hidden="true">⌄</span>
                </summary>

                <div className="admin-filter-fields">
                <label className="admin-filter-control">
                  <span>Estado</span>
                  <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                    <option value="active">Activas · tablero</option>
                    <option value="PENDIENTE">Pendientes</option>
                    <option value="ASIGNADO">Asignadas</option>
                    <option value="EN_REVISION">En revisión</option>
                    <option value="EN_PROCESO">En proceso</option>
                    <option value="RESUELTO">Resueltas</option>
                    <option value="RECHAZADO">Denegadas</option>
                    <option value="archived">Archivadas</option>
                  </select>
                </label>

                <fieldset className="admin-filter-group">
                  <legend>Fecha de reporte</legend>

                  <label className="admin-filter-control">
                    <span>Desde</span>
                    <input
                      type="date"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={(event) => setDateFrom(event.target.value)}
                    />
                  </label>

                  <label className="admin-filter-control">
                    <span>Hasta</span>
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={(event) => setDateTo(event.target.value)}
                    />
                  </label>

                  <label className="admin-filter-control">
                    <span>Ordenar por fecha</span>
                    <select
                      value={dateOrder}
                      onChange={(event) =>
                        setDateOrder(event.target.value === 'oldest' ? 'oldest' : 'newest')
                      }
                    >
                      <option value="newest">Más recientes</option>
                      <option value="oldest">Más antiguas</option>
                    </select>
                  </label>
                </fieldset>

                <label className="admin-filter-control">
                  <span>Tipo de denuncia</span>
                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                  >
                    <option value="">Todos los tipos</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-filter-control">
                  <span>Modalidad</span>
                  <select
                    value={modalityFilter}
                    onChange={(event) => setModalityFilter(event.target.value)}
                  >
                    <option value="">Todas las modalidades</option>
                    <option value="anonymous">Anónima</option>
                    <option value="account">Con cuenta</option>
                  </select>
                </label>

                <button
                  type="button"
                  className="admin-clear-filters"
                  onClick={() => {
                    setFilter('active');
                    setDateFrom('');
                    setDateTo('');
                    setDateOrder('newest');
                    setCategoryFilter('');
                    setModalityFilter('');
                    setSearchTerm('');
                  }}
                >
                  Limpiar filtros
                </button>
                </div>
              </details>
            </aside>}
          </div>
        </section>
      </div>
    </main>
  );
}

function App() {
  const { user, setSession, clearSession } = useAuthStore();
  const [authRoute, setAuthRoute] = useState<AuthRoute>(() =>
    getAuthRoute(),
  );
  const registering = authRoute === 'register';
  const [credentials, setCredentials] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [reports, setReports] = useState<Report[]>([]);
  const [actualizandoReportes, setActualizandoReportes] = useState(false);
  const [errorReportes, setErrorReportes] = useState('');
  const [error, setError] = useState('');
  const [menuCuentaAbierto, setMenuCuentaAbierto] = useState(false);
  const [vistaCiudadano, setVistaCiudadano] =
    useState<'crear' | 'reportes'>('crear');

  function navigateAuth(route: AuthRoute) {
    const routePaths: Record<AuthRoute, string> = {
      login: '/login',
      register: '/registro',
      anonymous: '/anonimo',
    };

    window.history.pushState({}, '', routePaths[route]);
    setAuthRoute(route);
    setError('');
  }

  const cargarDatos = useCallback(async () => {
  setActualizandoReportes(true);
  setErrorReportes('');

  try {
    const response = await api.get('/denuncias');
    setReports(response.data.data.items);
  } catch (error) {
    console.error('Error cargando reportes:', error);
    setErrorReportes('No se pudieron actualizar los reportes.');
  } finally {
    setActualizandoReportes(false);
  }
}, []);

  useEffect(() => {
    function handlePopState() {
      setAuthRoute(getAuthRoute());
      setError('');
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!user) return;
    void cargarDatos();
  }, [user, cargarDatos]);

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
      <main className="app-shell auth-shell">
        <div className="auth-background" aria-hidden="true">
          <img
            className="auth-photo-image"
            src={plazaConstitucionMelo}
            alt=""
          />
          <div className="auth-photo-overlay" />
        </div>

        <div className="auth-access-stack">
          <img
            src={puntoReporteLogo}
            alt="PuntoReporte"
            className="auth-brand-logo"
          />

          <section className={`auth-panel auth-route-${authRoute}`} aria-label="Acceso a PuntoReporte">

            <nav className="auth-route-nav" aria-label="Opciones de acceso">
              <a
                href="/login"
                className={authRoute === 'login' ? 'active' : ''}
                aria-current={authRoute === 'login' ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  navigateAuth('login');
                }}
              >
                <svg className="auth-route-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" />
                  <path d="M10 17l5-5-5-5M15 12H4" />
                </svg>
                <span>Iniciar sesión</span>
              </a>
              <a
                href="/registro"
                className={authRoute === 'register' ? 'active' : ''}
                aria-current={authRoute === 'register' ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  navigateAuth('register');
                }}
              >
                <svg className="auth-route-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-4A4.5 4.5 0 0 0 2 18.5V20" />
                  <circle cx="8.5" cy="6.5" r="4" />
                  <path d="M19 8v6M16 11h6" />
                </svg>
                <span>Crear cuenta</span>
              </a>
              <a
                href="/anonimo"
                className={authRoute === 'anonymous' ? 'active' : ''}
                aria-current={authRoute === 'anonymous' ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  navigateAuth('anonymous');
                }}
              >
                Entrar como anónimo
              </a>
            </nav>

            {authRoute === 'anonymous' ? (
              <div className="auth-anonymous-content">
                <h2>Ingresar como anónimo</h2>
                <p>
                  Al continuar de forma anónima, no necesitas ingresar datos personales. La sesión será temporal.
                </p>
                
                {error && <p className="error">{error}</p>}
                <button
                  type="button"
                  className="auth-submit"
                  onClick={handleAnonymousLogin}
                >
                  Continuar como anónimo
                </button>
                <small className="auth-helper-text">
                  Para poder consultar el estado de tu reporte posteriormente, te recomendamos crear una cuenta.
                </small>
              </div>
            ) : (
              <form className="auth-form auth-form-redesign" onSubmit={handleAuth}>
                <span className="auth-section-label">

                </span>
                <h2>{registering ? 'Crear cuenta' : 'Bienvenido/a'}</h2>
                <p className="auth-form-intro">
                </p>

                {registering && (
                  <div className="auth-name-fields">
                    <label>
                      Nombre
                      <input
                        required
                        autoComplete="given-name"
                        placeholder="Tu nombre"
                        value={credentials.firstName}
                        onChange={(event) =>
                          setCredentials({
                            ...credentials,
                            firstName: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Apellido
                      <input
                        required
                        autoComplete="family-name"
                        placeholder="Tu apellido"
                        value={credentials.lastName}
                        onChange={(event) =>
                          setCredentials({
                            ...credentials,
                            lastName: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                )}

                <label htmlFor="auth-email">
                  Correo electrónico
                  <input
                    id="auth-email"
                    required
                    type="email"
                    autoComplete="email"
                    placeholder="nombre@correo.com"
                    value={credentials.email}
                    onChange={(event) =>
                      setCredentials({
                        ...credentials,
                        email: event.target.value,
                      })
                    }
                  />
                </label>

                <label htmlFor="auth-password">
                  Contraseña
                  <input
                    id="auth-password"
                    required
                    minLength={6}
                    type="password"
                    autoComplete={registering ? 'new-password' : 'current-password'}
                    placeholder="Ingresá tu contraseña"
                    value={credentials.password}
                    onChange={(event) =>
                      setCredentials({
                        ...credentials,
                        password: event.target.value,
                      })
                    }
                  />
                </label>

                {error && <p className="error">{error}</p>}

                <button type="submit" className="auth-submit">
                  {registering ? 'Crear mi cuenta' : 'Entrar'}
                </button>
              </form>
            )}

            <p className="auth-panel-footer">
              Reportá. Informá. Mejorá.
            </p>
          </section>
        </div>
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
            <h1>Hola, {user.firstName || user.email}</h1>
          </div>
        </header>

        {vistaCiudadano === 'crear' && (
          <CrearDenuncia />
        )}

        {vistaCiudadano === 'reportes' && (
          <>
          <div className="reports-actions">
                <button
                  type="button"
                  onClick={() => void cargarDatos()}
                  disabled={actualizandoReportes}
                >
                  <span aria-hidden="true">⟳ </span>
                  {actualizandoReportes ? 'Actualizando...' : 'Actualizar'}
                </button>
          </div>

          <section className="reports-panel">
            <div className="panel-heading">
              <div>
                <h2>Mis reportes</h2>
              </div>

              <strong>{reports.length}</strong>
            </div>

              {errorReportes && <p className="error">{errorReportes}</p>}

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
          </>
        )}

      </section>
    </main>
  )
}
export default App;
