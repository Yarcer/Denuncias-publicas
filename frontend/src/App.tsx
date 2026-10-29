import { useCallback, useEffect, useState, type FormEvent } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './App.css';
import { api } from './lib/api';
import { getApiErrorMessage } from './lib/api-error';
import { useAuthStore } from './stores/auth-store';
import CrearDenuncia from './pages/CrearDenuncia'
import { formatReportIdentifier } from './lib/report-id';
import GestionUsuarios from './pages/GestionUsuarios';
import SolicitudesFuncionarios from './pages/SolicitudesFuncionarios';
import puntoReporteLogo from './assets/puntoreporte-logo.png';
import plazaConstitucionMelo from './assets/plaza-constitucion-melo.jpg';

type AuthRoute = 'login' | 'register' | 'anonymous' | 'management-login';

function getAuthRoute(pathname = window.location.pathname): AuthRoute {
  if (pathname === '/gestion/login') return 'management-login';
  if (pathname === '/registro') return 'register';
  if (pathname === '/anonimo') return 'anonymous';
  return 'login';
}

type Report = { id: string; title: string; description: string; status: string; priority?: string };
type ManagedReport = Report & {
  type?: string;
  entityName?: string | null;
  createdAt: string;
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
    isAnonymous: boolean;
  };
  assignee?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  evidence?: {
    id: string;
    url: string;
    type: string;
  }[];
};

function normalizeExportValue(value: string | number | null | undefined): string {
  const normalized = String(value ?? '').replace(/\r?\n/g, ' ');
  return normalized.replace(/"/g, '""');
}

function buildExportRows(reports: ManagedReport[]) {
  return reports.map((item) => ({
    'ID': item.id,
    'Título': item.title,
    'Descripción': item.description,
    'Estado': item.status.replace(/_/g, ' '),
    'Prioridad': item.priority ?? 'Sin prioridad',
    'Organismo': item.entityName ?? 'Sin asignar',
    'Dirección': item.address ?? 'Sin dirección',
    'Ciudadano': item.reporter?.isAnonymous ? 'Anónimo' : `${item.reporter?.firstName ?? ''} ${item.reporter?.lastName ?? ''}`.trim() || item.reporter?.email || 'Ciudadano',
    'Email': item.reporter?.email ?? '',
    'Latitud': item.latitude ?? '',
    'Longitud': item.longitude ?? '',
    'Asignado a': item.assignee?.email ?? 'Sin asignar',
  }));
}

function downloadExportFile(filename: string, content: string | Blob, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}


type AssignableUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  entityName?: string | null;
};

function EmergencyShortcuts() {
  const hotlines = [
    { label: 'Emergencias', number: '911', description: 'Atención inmediata' },
    { label: 'Bomberos', number: '104', description: 'Incendios y rescates' },
    { label: 'Emergencia médica', number: '105', description: 'Asistencia médica' },
  ];

  return (
    <section className="emergency-shortcuts" aria-label="Teléfonos de emergencia de Uruguay">
      <div className="emergency-heading">
        <span aria-hidden="true">!</span>
        <div>
          <h2>¿Es una emergencia?</h2>
          <p>Usá estos accesos directos para llamar.</p>
        </div>
      </div>
      <div className="emergency-links">
        {hotlines.map((hotline) => (
          <a key={hotline.number} href={`tel:${hotline.number}`}>
            <strong>{hotline.number}</strong>
            <span>{hotline.label}</span>
            <small>{hotline.description}</small>
          </a>
        ))}
      </div>
    </section>
  );
}

type StatisticGroup = { status?: string; type?: string; priority?: string; count: number };
type StatisticsData = {
  total: number;
  byStatus: StatisticGroup[];
  byType: StatisticGroup[];
  byPriority: StatisticGroup[];
  byMonth: { month: string; count: number }[];
};

function GeneralStatistics() {
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadStatistics() {
      try {
        const response = await api.get('/denuncias/gestion/estadisticas', {
          params: { ...(from ? { from } : {}), ...(to ? { to } : {}) },
        });
        if (active) {
          setStatistics(response.data.data);
          setError('');
        }
      } catch (loadError: unknown) {
        if (active) {
          setError(
            getApiErrorMessage(
              loadError,
              'No se pudieron cargar las estadísticas.',
            ),
          );
        }
      }
    }

    void loadStatistics();
    return () => {
      active = false;
    };
  }, [from, to]);

  const sections = statistics
    ? [
        {
          title: 'Por estado',
          items: statistics.byStatus.map((item) => ({
            label: item.status?.replace(/_/g, ' ') ?? '',
            count: item.count,
          })),
        },
        {
          title: 'Por tipo',
          items: statistics.byType.map((item) => ({
            label: item.type ?? '',
            count: item.count,
          })),
        },
        {
          title: 'Por prioridad',
          items: statistics.byPriority.map((item) => ({
            label: item.priority ?? '',
            count: item.count,
          })),
        },
      ]
    : [];
  const maximumMonthlyCount = Math.max(
    1,
    ...(statistics?.byMonth.map((item) => item.count) ?? []),
  );

  return (
    <section className="statistics-page">
      <header className="statistics-header">
        <div>
          <span className="statistics-eyebrow">Administración</span>
          <h1>Estadísticas generales</h1>
          <p>Resumen de denuncias registradas en el sistema.</p>
        </div>
        <div className="statistics-date-filters">
          <label>
            Desde
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {statistics && (
        <>
          <article className="statistics-total">
            <span>Total de denuncias</span>
            <strong>{statistics.total}</strong>
          </article>
          <div className="statistics-grid">
            {sections.map((section) => (
              <article className="statistics-card" key={section.title}>
                <h2>{section.title}</h2>
                {section.items.length ? (
                  section.items.map((item) => (
                    <div className="statistics-row" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))
                ) : (
                  <p>No hay datos para el período.</p>
                )}
              </article>
            ))}
            <article className="statistics-card statistics-monthly">
              <h2>Evolución mensual</h2>
              {statistics.byMonth.length ? (
                statistics.byMonth.map((item) => (
                  <div className="statistics-row" key={item.month}>
                    <span>{item.month}</span>
                    <div className="statistics-bar-track">
                      <div
                        className="statistics-bar"
                        style={{
                          width: `${(item.count / maximumMonthlyCount) * 100}%`,
                        }}
                      />
                    </div>
                    <strong>{item.count}</strong>
                  </div>
                ))
              ) : (
                <p>No hay datos para el período.</p>
              )}
            </article>
          </div>
        </>
      )}
    </section>
  );
}

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

function ManagementDashboard({
  isAdmin,
  isEntityAdmin,
  currentUserId,
  onLogout,
}: {
  isAdmin: boolean;
  isEntityAdmin: boolean;
  currentUserId: string;
  onLogout: () => void;
}) {
  const [reports, setReports] = useState<ManagedReport[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [managementView, setManagementView] = useState<
    'reports' | 'users' | 'create-user' | 'statistics' | 'requests'
  >(isAdmin ? 'users' : 'reports');
  const [dateOrder, setDateOrder] = useState<'newest' | 'oldest'>('newest');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalityFilter, setModalityFilter] = useState('');
  const [filter, setFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  async function loadReports(selectedStatus = filter) {
    if (isAdmin) return;
    try {
      const response = await api.get(
        '/denuncias/gestion/bandeja',
        selectedStatus === 'active' ? {} : { params: { status: selectedStatus } },
      );
      setReports(response.data.data.items);
      setError('');
    } catch (loadError: unknown) {
      setError(getApiErrorMessage(loadError, 'No se pudo cargar la bandeja.'));
    }
  }

  useEffect(() => {
    if (isAdmin) return;
    let active = true;

    async function fetchReports() {
      try {
        const response = await api.get(
          '/denuncias/gestion/bandeja',
          filter === 'active' ? {} : { params: { status: filter } },
        );
        if (active) {
          setReports(response.data.data.items);
          setError('');
        }
      } catch (loadError: unknown) {
        if (active) {
          setError(getApiErrorMessage(loadError, 'No se pudo cargar la bandeja.'));
        }
      }
    }

    void fetchReports();
    return () => {
      active = false;
    };
  }, [filter, isAdmin]);

  function exportReports(format: 'csv' | 'xlsx' | 'pdf') {
    if (!visibleReports.length) {
      setError('No hay reportes visibles para exportar.');
      return;
    }

    const rows = buildExportRows(visibleReports);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const baseName = `denuncias-${filter === 'active' ? 'activa' : filter}-${timestamp}`;

    if (format === 'csv') {
      const headers = Object.keys(rows[0]);
      const csvContent = [
        headers.join(','),
        ...rows.map((row) => headers.map((header) => `"${normalizeExportValue(row[header as keyof typeof row])}"`).join(',')),
      ].join('\n');

      downloadExportFile(`${baseName}.csv`, csvContent, 'text/csv;charset=utf-8;');
      return;
    }

    if (format === 'xlsx') {
      const sheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Denuncias');
      XLSX.writeFile(workbook, `${baseName}.xlsx`);
      return;
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const headers = Object.keys(rows[0]);
    const tableRows = rows.map((row) => headers.map((header) => row[header as keyof typeof row] ?? ''));

    doc.setFontSize(16);
    doc.text('Listado de denuncias', 40, 48);
    doc.setFontSize(10);
    doc.text(`Exportado: ${new Date().toLocaleString('es-UY')}`, 40, 66);

    autoTable(doc, {
      head: [headers],
      body: tableRows,
      startY: 84,
      margin: { left: 40, right: 40 },
      styles: { fontSize: 7, cellPadding: 4 },
      headStyles: { fillColor: [21, 86, 181], textColor: 255 },
      alternateRowStyles: { fillColor: [247, 250, 255] },
    });

    doc.save(`${baseName}.pdf`);
  }

  useEffect(() => {
    if (isAdmin) return;
    async function loadAssignableUsers() {
      try {
        const response = await api.get('/denuncias/gestion/funcionarios');
        setAssignableUsers(response.data.data.items);
      } catch (loadError: unknown) {
        setError(getApiErrorMessage(loadError, 'No se pudieron cargar los funcionarios.'));
      }
    }

    void loadAssignableUsers();
  }, [isAdmin]);

  async function archiveReport(id: string) {
    try {
      await api.patch(`/denuncias/${id}/archivar`);
      await loadReports();
    } catch (archiveError: unknown) {
      setError(getApiErrorMessage(archiveError, 'No se pudo archivar la denuncia.'));
    }
  }

  async function takeReport(id: string) {
    try {
      await api.post(`/denuncias/${id}/tomar`);
      await loadReports();
    } catch (takeError: unknown) {
      setError(getApiErrorMessage(takeError, 'No se pudo tomar la denuncia.'));
    }
  }

  async function assignReport(id: string, assigneeId: string) {
    try {
      await api.patch(`/denuncias/${id}/asignar`, { assigneeId });
      await loadReports();
    } catch (assignError: unknown) {
      setError(getApiErrorMessage(assignError, 'No se pudo asignar la denuncia.'));
    }
  }

  async function changeStatus(id: string, status: string) {
    try {
      await api.patch(`/denuncias/${id}/estado`, { status });
      await loadReports();
    } catch (statusError: unknown) {
      setError(getApiErrorMessage(statusError, 'No se pudo actualizar el estado.'));
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

  function scrollToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <main className={`app-shell admin-app-shell ${isAdmin ? 'superadmin-shell' : 'entity-shell'}`}>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-brand" aria-label="PuntoReporte">
            <span>Punto</span>Reporte
            <small>Gestión urbana</small>
          </div>

          <nav className="admin-nav" aria-label="Navegación de administración">
            {!isAdmin && (
              <>
                <button type="button" onClick={() => scrollToSection('admin-summary')}>
                  <span aria-hidden="true">⌂</span> Inicio
                </button>
                <button
                  type="button"
                  className={managementView === 'reports' && !isArchivedView ? 'admin-nav-active' : ''}
                  onClick={() => {
                    setManagementView('reports');
                    setFilter('active');
                    scrollToSection('admin-board');
                  }}
                >
                  <span aria-hidden="true">▤</span> Bandeja de reportes
                </button>
                <button
                  type="button"
                  className={managementView === 'reports' && isArchivedView ? 'admin-nav-active' : ''}
                  onClick={() => { setManagementView('reports'); setFilter('archived'); }}
                >
                  <span aria-hidden="true">▣</span> Archivadas
                </button>
              </>
            )}
            {isAdmin && (
              <>
                <button
                  type="button"
                  className={managementView === 'statistics' ? 'admin-nav-active' : ''}
                  onClick={() => setManagementView('statistics')}
                >
                  <span aria-hidden="true">▥</span> Estadísticas generales
                </button>
                <button
                  type="button"
                  className={managementView === 'users' ? 'admin-nav-active' : ''}
                  onClick={() => setManagementView('users')}
                >
                  <span aria-hidden="true">◉</span> Cuentas de funcionarios
                </button>

                <button
                  type="button"
                  className={managementView === 'requests' ? 'admin-nav-active' : ''}
                  onClick={() => setManagementView('requests')}
                >
                  <span aria-hidden="true">＋</span> Solicitudes de funcionarios
                </button>
              </>
            )}
            {isEntityAdmin && (
              <button
                type="button"
                className={managementView === 'requests' ? 'admin-nav-active' : ''}
                onClick={() => setManagementView('requests')}
              >
                <span aria-hidden="true">＋</span> Solicitar funcionario
              </button>
            )}
          </nav>

          <button type="button" className="admin-logout" onClick={onLogout}>
            <span aria-hidden="true">↪</span> Cerrar sesión
          </button>
        </aside>

        <section className="admin-main">
          {managementView === 'requests' ? (
            <SolicitudesFuncionarios isSuperAdmin={isAdmin} />
          ) : isAdmin ? (
            managementView === 'statistics' ? (
              <GeneralStatistics />
            ) : (
              <GestionUsuarios
                currentUserId={currentUserId}
                view={managementView === 'create-user' ? 'create-user' : 'users'}
                onViewChange={(view) => setManagementView(view)}
              />
            )
          ) : (
            <>
             <div className="admin-page-layout">
            <div className="admin-page-content">
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
                  <div className="admin-export-actions" aria-label="Exportar denuncias">
                    <button type="button" onClick={() => exportReports('csv')}>CSV</button>
                    <button type="button" onClick={() => exportReports('xlsx')}>Excel</button>
                    <button type="button" onClick={() => exportReports('pdf')}>PDF</button>
                  </div>
                </div>
              </header>

              <EmergencyShortcuts />

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
                                <div className="admin-report-chips">
                                  <span className={`admin-status-chip admin-status-${item.status.toLowerCase()}`}>
                                    {item.status.replace(/_/g, ' ')}
                                  </span>
                                  {item.priority && (
                                    <span className={`admin-priority-chip admin-priority-${item.priority.toLowerCase()}`}>
                                      Prioridad {item.priority.toLowerCase()}
                                    </span>
                                  )}
                                </div>
                                <h4>{item.title}</h4>
                                <p>{item.description}</p>
                                <div className="admin-report-meta">
                                  <span><b aria-hidden="true">▣</b>{item.entityName || 'Organismo sin asignar'}</span>
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
                                <label className="report-assignment">
                                  <span>Asignar a</span>
                                  <select
                                    value={item.assignee?.id ?? ''}
                                    onChange={(event) => {
                                      if (event.target.value) {
                                        void assignReport(item.id, event.target.value);
                                      }
                                    }}
                                  >
                                    <option value="">Seleccionar funcionario</option>
                                    {assignableUsers.map((assignableUser) => (
                                      <option key={assignableUser.id} value={assignableUser.id}>
                                        {[assignableUser.firstName, assignableUser.lastName]
                                          .filter(Boolean)
                                          .join(' ') || assignableUser.email}
                                      </option>
                                    ))}
                                  </select>
                                </label>
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
            </div>

            <aside className="admin-filter-panel" aria-label="Filtros de denuncias">
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
                    <option value="">Todas</option>
                    <option value="identified">Identificadas</option>
                    <option value="anonymous">Anónimas</option>
                  </select>
                </label>
                </div>
              </details>
            </aside>
          </div>
            </>
          )}
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
  const managementLogin = authRoute === 'management-login';
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState('');
  const [menuCuentaAbierto, setMenuCuentaAbierto] = useState(false);
   const [actualizandoReportes, setActualizandoReportes] = useState(false);
  const [errorReportes, setErrorReportes] = useState('');
  const [vistaCiudadano, setVistaCiudadano] =
    useState<'crear' | 'reportes'>('crear');

  function navigateAuth(route: AuthRoute) {
    const routePaths: Record<AuthRoute, string> = {
      login: '/login',
      register: '/registro',
      anonymous: '/anonimo',
      'management-login': '/gestion/login',
    };

    window.history.pushState({}, '', routePaths[route]);
    setAuthRoute(route);
    setError('');
  }

  useEffect(() => {
    function handlePopState() {
      setAuthRoute(getAuthRoute());
      setError('');
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const cargarDatos = useCallback(async () => {
    try {
      const response = await api.get('/denuncias');
      setReports(response.data.data.items);
      setErrorReportes('');
    } catch (loadError: unknown) {
      setErrorReportes(getApiErrorMessage(loadError, 'No se pudieron cargar los reportes.'));
    } finally {
      setActualizandoReportes(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;

    async function fetchReports() {
      try {
        const response = await api.get('/denuncias');
        if (active) {
          setReports(response.data.data.items);
          setErrorReportes('');
        }
      } catch (loadError: unknown) {
        if (active) {
          setErrorReportes(getApiErrorMessage(loadError, 'No se pudieron cargar los reportes.'));
        }
      }
    }

    void fetchReports();
    return () => {
      active = false;
    };
  }, [user]);

  async function handleAuth(event: FormEvent) {
    event.preventDefault();

    setError('');

    if (registering && credentials.password !== credentials.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    try {
      const payload = registering
        ? {
          email: credentials.email,
          password: credentials.password,
          firstName: credentials.firstName,
          lastName: credentials.lastName,
        }
        : {
          email: credentials.email,
          password: credentials.password,
        };

      const response = await api.post(
        registering ? '/auth/register' : '/auth/login',
        registering
          ? payload
          : { ...payload, portal: managementLogin ? 'gestion' : 'ciudadano' },
      );

      setSession(response.data.data.user, response.data.data.csrfToken);
    } catch (authError: unknown) {
      setError(getApiErrorMessage(authError, 'No se pudo iniciar sesión.'));
    }
  }

  async function handleAnonymousLogin() {
    setError('');
    try {
      const response = await api.post('/auth/anonymous');
      setSession(response.data.data.user, response.data.data.csrfToken);
    } catch (anonymousError: unknown) {
      setError(getApiErrorMessage(anonymousError, 'No se pudo crear la sesión temporal.'));
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

            <nav
              className={`auth-route-nav ${managementLogin ? 'auth-route-nav-management' : ''}`}
              aria-label="Opciones de acceso"
            >
              {managementLogin ? (
                <a
                  href="/login"
                  onClick={(event) => {
                    event.preventDefault();
                    navigateAuth('login');
                  }}
                >
                  Acceso ciudadano
                </a>
              ) : (
                <>
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
                </>
              )}
            </nav>

            {!managementLogin && (
              <a
                className="institutional-access-link"
                href="/gestion/login"
                onClick={(event) => {
                  event.preventDefault();
                  navigateAuth('management-login');
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10 21v-4h4v4" />
                </svg>
                <span>
                  <strong>Acceso para funcionarios</strong>
                  <small>Ingresar al portal del ente público</small>
                </span>
                <b aria-hidden="true">→</b>
              </a>
            )}
            {authRoute === 'anonymous' ? (
              <div className="auth-anonymous-content">
                <h2>Ingresar como anónimo</h2>
                <p>
                  Podés continuar sin crear una cuenta. La sesión será temporal.
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
                  Para consultar tus reportes luego, te recomendamos crear una cuenta.
                </small>
              </div>
            ) : (
              <form className="auth-form auth-form-redesign" onSubmit={handleAuth}>
                <span className="auth-section-label">
                  {managementLogin
                    ? 'PORTAL INSTITUCIONAL'
                    : registering
                      ? 'CUENTA CIUDADANA'
                      : 'ACCESO CIUDADANO'}
                </span>
                <h2>
                  {registering
                    ? 'Crear cuenta'
                    : managementLogin
                      ? 'Acceso de ente público'
                      : 'Bienvenido/a'}
                </h2>
                <p className="auth-form-intro">
                  {managementLogin
                    ? 'Ingresá con tu cuenta institucional para gestionar denuncias.'
                    : registering
                      ? ''
                      : 'Ingresá para crear y seguir tus denuncias.'}
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
                  <span className="password-input-wrap">
                    <input
                      id="auth-password"
                      required
                      minLength={6}
                      type={showPassword ? 'text' : 'password'}
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
                    <button
                      className="password-visibility-toggle"
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                          <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.2 9.5 6-.4.8-1.3 2-2.6 3.2M6.2 6.2C3.9 7.6 2.7 9.7 2.5 11c.5.9 3.9 7 9.5 7 1.1 0 2.1-.2 3-.6" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </span>
                </label>

                {registering && (
                  <label htmlFor="auth-confirm-password">
                    Confirmar contraseña
                    <input
                      id="auth-confirm-password"
                      required
                      minLength={6}
                      type="password"
                      autoComplete="new-password"
                      placeholder="Ingresá nuevamente tu contraseña"
                      value={credentials.confirmPassword}
                      onChange={(event) =>
                        setCredentials({
                          ...credentials,
                          confirmPassword: event.target.value,
                        })
                      }
                    />
                  </label>
                )}

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

  if (
    user.role === 'FUNCIONARIO' ||
    user.role === 'FUNCIONARIO_ADMINISTRADOR' ||
    user.role === 'SUPERADMINISTRADOR'
  ) {
    return (
      <ManagementDashboard
        isAdmin={user.role === 'SUPERADMINISTRADOR'}
        isEntityAdmin={user.role === 'FUNCIONARIO_ADMINISTRADOR'}
        currentUserId={user.id}
        onLogout={clearSession}
      />
    );
  }
  return (
    <main className="app-shell ciudadano-shell">
      <nav className="ciudadano-nav">
        <div className="ciudadano-nav-logo">
          <img
            src={puntoReporteLogo}
            alt="PuntoReporte"
          />
        </div>


        <div className="ciudadano-nav-links">

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

      <section className="dashboard">

        <header className="dashboard-header">
          <div>
            <header className="dashboard-header">
              <div>
                <h1 className="saludo-ciudadano">
                  <span className="saludo-icono" aria-hidden="true">👋</span>
                  <span>Hola, {user.firstName || user.email}</span>
                </h1>
              </div>
            </header>
          </div>
        </header>


        {vistaCiudadano === 'crear' && (
          <CrearDenuncia />
        )}

        {vistaCiudadano === 'reportes' && (
          <section className="reports-panel">
            <div className="panel-heading">
              <div>
                <h2>Mis reportes</h2>
              </div>

              <div className="reports-actions">
                <strong>{reports.length}</strong>
                <button
                  type="button"
                  onClick={() => {
                    setActualizandoReportes(true);
                    void cargarDatos();
                  }}
                  disabled={actualizandoReportes}
                >
                  <span aria-hidden="true">⟳ </span>
                  {actualizandoReportes ? 'Actualizando...' : 'Actualizar'}
                </button>
              </div>
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
                    <small className="report-identifier">
                      Identificador: {formatReportIdentifier(item.id)}
                    </small>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>

                  <span>{item.status}</span>
                </article>
              ))
            )}
          </section>
        )}

        <EmergencyShortcuts />

      </section>
    </main>
  )
}
export default App;