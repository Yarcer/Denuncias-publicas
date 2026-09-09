import { useEffect, useState, type FormEvent } from 'react';
import './App.css';
import { api } from './lib/api';
import { useAuthStore } from './stores/auth-store';

type Category = { id: string; name: string; type: string };
type Report = { id: string; title: string; description: string; status: string };
type ManagedReport = Report & { address?: string | null; reporter?: { email: string; firstName?: string | null; lastName?: string | null }; assignee?: { email: string } | null };
const emptyReport = { title: '', description: '', type: 'URBANO', latitude: '', longitude: '', address: '', categoryId: '' };

function ManagementDashboard({ isAdmin, onLogout }: { isAdmin: boolean; onLogout: () => void }) {
  const [reports, setReports] = useState<ManagedReport[]>([]);
  const [filter, setFilter] = useState('active');
  const [error, setError] = useState('');

  async function loadReports(selectedStatus = filter) {
    try {
      const response = await api.get('/denuncias/gestion/bandeja', selectedStatus === 'active' ? {} : { params: { status: selectedStatus } });
      setReports(response.data.data.items);
      setError('');
    } catch (loadError: any) {
      setError(loadError.response?.data?.message ?? 'No se pudo cargar la bandeja.');
    }
  }

  useEffect(() => { void loadReports(); }, [filter]);

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

  return <main className="app-shell"><section className="dashboard management-dashboard"><header className="dashboard-header"><div><span className="eyebrow">{isAdmin ? 'Administración' : 'Ente público'}</span><h1>Bandeja de denuncias</h1></div><button className="secondary" onClick={onLogout}>Cerrar sesión</button></header><div className="management-toolbar"><div><strong>{reports.length}</strong><span> casos en esta vista</span></div><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="active">Activas</option><option value="PENDIENTE">Pendientes</option><option value="ASIGNADO">Asignadas</option><option value="EN_REVISION">En espera</option><option value="RESUELTO">Hechas</option><option value="RECHAZADO">Denegadas</option></select></div>{error && <p className="error management-error">{error}</p>}<section className="management-list">{reports.length === 0 ? <p className="empty-state">No hay denuncias en esta vista.</p> : reports.map((item) => <article className="management-item" key={item.id}><div className="management-item-copy"><span className="status-label">{item.status}</span><h2>{item.title}</h2><p>{item.description}</p><small>{item.address || 'Ubicación sin dirección'} · Reportado por {item.reporter?.firstName || item.reporter?.email || 'ciudadano'}</small></div><div className="management-actions">{!item.assignee && <button onClick={() => takeReport(item.id)}>Tomar denuncia</button>}{item.assignee && <><button className="secondary" onClick={() => changeStatus(item.id, 'EN_REVISION')}>En espera</button><button onClick={() => changeStatus(item.id, 'RESUELTO')}>Hecha</button><button className="danger" onClick={() => changeStatus(item.id, 'RECHAZADO')}>Denegar</button></>}</div></article>)}</section></section></main>;
}

function App() {
  const { user, setSession, clearSession } = useAuthStore();
  const [registering, setRegistering] = useState(false);
  const [credentials, setCredentials] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [reports, setReports] = useState<Report[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [report, setReport] = useState(emptyReport);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!user) return;
    void Promise.all([api.get('/denuncias'), api.get('/categorias')]).then(([reportsResponse, categoriesResponse]) => {
      setReports(reportsResponse.data.data.items);
      setCategories(categoriesResponse.data.data.items);
    }).catch(() => setError('No se pudieron cargar tus datos.'));
  }, [user]);

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const response = await api.post(registering ? '/auth/register' : '/auth/login', credentials);
      setSession(response.data.data.user, response.data.data.accessToken);
    } catch (authError: any) {
      setError(authError.response?.data?.message ?? 'No se pudo iniciar sesión.');
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

  async function handleReport(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const response = await api.post('/denuncias', { ...report, latitude: Number(report.latitude), longitude: Number(report.longitude) });
      setReports((current) => [response.data.data, ...current]);
      setReport(emptyReport);
      setNotice('Denuncia registrada correctamente.');
    } catch (reportError: any) {
      setError(reportError.response?.data?.message ?? 'No se pudo registrar la denuncia.');
    }
  }

  if (!user) {
    return <main className="app-shell"><section className="auth-card"><div className="hero-copy"><span className="eyebrow">Denuncias públicas</span><h1>Tu ciudad también se cuida reportando.</h1><p>Registra incidentes y consulta el avance de cada denuncia desde un solo lugar.</p></div><form className="auth-form" onSubmit={handleAuth}><h2>{registering ? 'Crear cuenta' : 'Iniciar sesión'}</h2>{registering && <div className="form-row"><input placeholder="Nombre" value={credentials.firstName} onChange={(event) => setCredentials({ ...credentials, firstName: event.target.value })} /><input placeholder="Apellido" value={credentials.lastName} onChange={(event) => setCredentials({ ...credentials, lastName: event.target.value })} /></div>}<input required type="email" placeholder="Correo electrónico" value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} /><input required minLength={6} type="password" placeholder="Contraseña" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} />{error && <p className="error">{error}</p>}<button type="submit">{registering ? 'Registrarme' : 'Entrar'}</button><button type="button" className="link-button" onClick={() => setRegistering(!registering)}>{registering ? 'Ya tengo una cuenta' : 'Crear una cuenta'}</button><span className="divider">o</span><button type="button" className="secondary" onClick={handleAnonymousLogin}>Entrar como visitante</button><small className="helper-text">La sesión de visitante es temporal y no requiere registro.</small></form></section></main>;
  }

  if (user.role === 'ENTE_PUBLICO' || user.role === 'ADMINISTRADOR') {
    return <ManagementDashboard isAdmin={user.role === 'ADMINISTRADOR'} onLogout={clearSession} />;
  }

  return <main className="app-shell"><section className="dashboard"><header className="dashboard-header"><div><span className="eyebrow">Panel ciudadano</span><h1>Hola, {user.firstName || user.email}</h1></div><button className="secondary" onClick={clearSession}>Cerrar sesión</button></header><div className="dashboard-grid"><form className="report-form" onSubmit={handleReport}><h2>Nueva denuncia</h2><input required placeholder="Título del incidente" value={report.title} onChange={(event) => setReport({ ...report, title: event.target.value })} /><textarea required placeholder="¿Qué ocurrió?" value={report.description} onChange={(event) => setReport({ ...report, description: event.target.value })} /><div className="form-row"><select value={report.type} onChange={(event) => setReport({ ...report, type: event.target.value })}><option value="URBANO">Urbano</option><option value="BOMBEROS">Bomberos</option><option value="POLICIAL">Policial</option></select><select required value={report.categoryId} onChange={(event) => setReport({ ...report, categoryId: event.target.value })}><option value="">Categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div className="form-row"><input required type="number" step="any" placeholder="Latitud" value={report.latitude} onChange={(event) => setReport({ ...report, latitude: event.target.value })} /><input required type="number" step="any" placeholder="Longitud" value={report.longitude} onChange={(event) => setReport({ ...report, longitude: event.target.value })} /></div><input placeholder="Dirección o referencia" value={report.address} onChange={(event) => setReport({ ...report, address: event.target.value })} />{error && <p className="error">{error}</p>}{notice && <p className="notice">{notice}</p>}<button type="submit">Registrar denuncia</button></form><section className="reports-panel"><div className="panel-heading"><div><span className="eyebrow">Historial</span><h2>Mis denuncias</h2></div><strong>{reports.length}</strong></div>{reports.length === 0 ? <p className="empty-state">Todavía no tienes denuncias registradas.</p> : reports.map((item) => <article className="report-item" key={item.id}><div><strong>{item.title}</strong><p>{item.description}</p></div><span>{item.status}</span></article>)}</section></div></section></main>;
}

export default App;
