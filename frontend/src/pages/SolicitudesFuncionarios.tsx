import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { getApiErrorMessage } from '../lib/api-error'
import './GestionUsuarios.css'

type RequestStatus = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'

type StaffRequest = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  entityName: string
  jurisdiction: string | null
  status: RequestStatus
  reviewComment: string | null
  reviewedAt: string | null
  createdAt: string
  requestedBy: {
    firstName: string | null
    lastName: string | null
    email: string
  }
}

function SolicitudesFuncionarios({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [requests, setRequests] = useState<StaffRequest[]>([])
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadRequests() {
    try {
      const response = await api.get('/solicitudes-usuarios')
      setRequests(response.data.data.items)
      setError('')
    } catch (loadError: unknown) {
      setError(getApiErrorMessage(loadError, 'No se pudieron cargar las solicitudes.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function fetchRequests() {
      try {
        const response = await api.get('/solicitudes-usuarios')
        if (active) {
          setRequests(response.data.data.items)
          setError('')
        }
      } catch (loadError: unknown) {
        if (active) {
          setError(getApiErrorMessage(loadError, 'No se pudieron cargar las solicitudes.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void fetchRequests()
    return () => {
      active = false
    }
  }, [])

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.post('/solicitudes-usuarios', {
        ...form,
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      })
      setForm({ email: '', password: '', firstName: '', lastName: '' })
      setNotice('La solicitud fue enviada al superadministrador para su aprobación.')
      await loadRequests()
    } catch (saveError: unknown) {
      setError(getApiErrorMessage(saveError, 'No se pudo enviar la solicitud.'))
    } finally {
      setSaving(false)
    }
  }

  async function reviewRequest(id: string, status: 'APROBADA' | 'RECHAZADA') {
    setReviewingId(id)
    setError('')
    setNotice('')
    try {
      await api.patch(`/solicitudes-usuarios/${id}/revision`, { status })
      setNotice(status === 'APROBADA'
        ? 'Solicitud aprobada y cuenta de funcionario creada.'
        : 'Solicitud rechazada.')
      await loadRequests()
    } catch (reviewError: unknown) {
      setError(getApiErrorMessage(reviewError, 'No se pudo revisar la solicitud.'))
    } finally {
      setReviewingId(null)
    }
  }

  return (
    <section className="admin-users-page">
      <header className="admin-users-heading">
        <div>
          <h1>{isSuperAdmin ? 'Solicitudes de funcionarios' : 'Solicitar funcionario'}</h1>
          <p>
            {isSuperAdmin
              ? 'Revisa las solicitudes enviadas por los administradores de ente.'
              : 'Envía los datos del funcionario al superadministrador para su aprobación.'}
          </p>
        </div>
        {!isSuperAdmin && <span className="admin-users-count">{requests.length} solicitudes</span>}
      </header>

      <div className="admin-users-layout">
        {!isSuperAdmin && (
          <form className="admin-user-form" onSubmit={submitRequest}>
            <div className="admin-user-form-heading">
              <div>
                <h2>Nueva solicitud</h2>
                <p>La cuenta se creará cuando el superadministrador apruebe los datos.</p>
              </div>
            </div>
            <div className="admin-user-fields">
              <label>
                Nombre
                <input
                  required
                  maxLength={100}
                  value={form.firstName}
                  onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                  autoComplete="given-name"
                />
              </label>
              <label>
                Apellido
                <input
                  required
                  maxLength={100}
                  value={form.lastName}
                  onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                  autoComplete="family-name"
                />
              </label>
              <label className="admin-user-field-wide">
                Correo electrónico
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  autoComplete="email"
                />
              </label>
              <label className="admin-user-field-wide">
                Contraseña inicial
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={100}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                />
              </label>
            </div>
            {error && <p className="admin-users-message admin-users-error" role="alert">{error}</p>}
            {notice && <p className="admin-users-message admin-users-success" role="status">{notice}</p>}
            <button className="admin-user-submit" type="submit" disabled={saving}>
              {saving ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </form>
        )}

        <section className="admin-user-list" aria-labelledby="staff-requests-title">
          <header>
            <div>
              <h2 id="staff-requests-title">
                {isSuperAdmin ? 'Solicitudes recibidas' : 'Mis solicitudes'}
              </h2>
              <p>
                {isSuperAdmin
                  ? 'Al aprobar, se crea una cuenta activa para el funcionario.'
                  : 'Consulta aquí el estado de tus solicitudes.'}
              </p>
            </div>
          </header>

          {error && isSuperAdmin && (
            <p className="admin-users-message admin-users-error" role="alert">{error}</p>
          )}
          {notice && isSuperAdmin && (
            <p className="admin-users-message admin-users-success" role="status">{notice}</p>
          )}

          {loading ? (
            <p className="admin-user-empty">Cargando solicitudes…</p>
          ) : requests.length === 0 ? (
            <p className="admin-user-empty">No hay solicitudes para mostrar.</p>
          ) : (
            <div className="admin-user-table-wrap">
              <table className="admin-user-table">
                <thead>
                  <tr>
                    <th>Funcionario</th>
                    <th>Ente</th>
                    {isSuperAdmin && <th>Solicitante</th>}
                    <th>Estado</th>
                    {isSuperAdmin && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <strong>{[request.firstName, request.lastName].filter(Boolean).join(' ')}</strong>
                        <span>{request.email}</span>
                      </td>
                      <td>
                        <strong>{request.entityName}</strong>
                        <span>{request.jurisdiction || 'Sin jurisdicción'}</span>
                      </td>
                      {isSuperAdmin && (
                        <td>
                          <strong>
                            {[request.requestedBy.firstName, request.requestedBy.lastName]
                              .filter(Boolean).join(' ') || request.requestedBy.email}
                          </strong>
                          <span>{request.requestedBy.email}</span>
                        </td>
                      )}
                      <td>
                        <span className={`admin-user-status admin-user-status-${request.status.toLowerCase()}`}>
                          {request.status}
                        </span>
                        {request.reviewComment && <span>{request.reviewComment}</span>}
                      </td>
                      {isSuperAdmin && (
                        <td>
                          {request.status === 'PENDIENTE' ? (
                            <div className="admin-user-actions">
                              <button
                                type="button"
                                className="admin-user-enable"
                                disabled={reviewingId === request.id}
                                onClick={() => void reviewRequest(request.id, 'APROBADA')}
                              >
                                Aprobar
                              </button>
                              <button
                                type="button"
                                className="admin-user-disable"
                                disabled={reviewingId === request.id}
                                onClick={() => void reviewRequest(request.id, 'RECHAZADA')}
                              >
                                Rechazar
                              </button>
                            </div>
                          ) : (
                            <span>{request.reviewedAt
                              ? new Date(request.reviewedAt).toLocaleDateString('es-UY')
                              : ''}</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

export default SolicitudesFuncionarios
