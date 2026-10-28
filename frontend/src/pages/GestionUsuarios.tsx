import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { getApiErrorMessage } from '../lib/api-error'
import './GestionUsuarios.css'

type AdministrativeRole = 'FUNCIONARIO' | 'FUNCIONARIO_ADMINISTRADOR' | 'SUPERADMINISTRADOR'
type UserStatus = 'ACTIVO' | 'INACTIVO' | 'BANEADO'

type AdministrativeUser = {
  id: string
  email: string
  role: AdministrativeRole
  status: UserStatus
  firstName: string | null
  lastName: string | null
  entityName: string | null
  jurisdiction: string | null
}

type UserForm = {
  email: string
  password: string
  role: AdministrativeRole
  firstName: string
  lastName: string
  entityName: string
  jurisdiction: string
}

const emptyForm: UserForm = {
  email: '',
  password: '',
  role: 'FUNCIONARIO',
  firstName: '',
  lastName: '',
  entityName: '',
  jurisdiction: '',
}

function GestionUsuarios({
  currentUserId,
  view,
  onViewChange,
}: {
  currentUserId: string
  view: 'users' | 'create-user'
  onViewChange: (view: 'users' | 'create-user') => void
}) {
  const [users, setUsers] = useState<AdministrativeUser[]>([])
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadUsers() {
    try {
      const response = await api.get('/usuarios/administrativos')
      setUsers(response.data.data.items)
      setError('')
    } catch (loadError: unknown) {
      setError(getApiErrorMessage(loadError, 'No se pudieron cargar los usuarios.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function fetchInitialUsers() {
      try {
        const response = await api.get('/usuarios/administrativos')
        if (active) {
          setUsers(response.data.data.items)
          setError('')
        }
      } catch (loadError: unknown) {
        if (active) {
          setError(getApiErrorMessage(loadError, 'No se pudieron cargar los usuarios.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void fetchInitialUsers()
    return () => {
      active = false
    }
  }, [])

  function startEditing(user: AdministrativeUser) {
    setEditingId(user.id)
    setNotice('')
    setError('')
    setForm({
      email: user.email,
      password: '',
      role: user.role,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      entityName: user.entityName ?? '',
      jurisdiction: user.jurisdiction ?? '',
    })
    onViewChange('create-user')
  }

  function cancelEditing() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setNotice('')
    onViewChange('users')
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const payload = {
      ...form,
      ...(form.password ? {} : { password: undefined }),
      firstName: form.firstName || undefined,
      lastName: form.lastName || undefined,
      entityName: form.entityName || undefined,
      jurisdiction: form.jurisdiction || undefined,
    }

    try {
      if (editingId) {
        await api.patch(`/usuarios/${editingId}`, payload)
        setNotice('Los cambios del usuario se guardaron.')
      } else {
        await api.post('/usuarios/administrativos', payload)
        setNotice('El usuario administrativo fue creado.')
      }
      setEditingId(null)
      setForm(emptyForm)
      await loadUsers()
    } catch (saveError: unknown) {
      setError(getApiErrorMessage(saveError, 'No se pudo guardar el usuario.'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleUserStatus(user: AdministrativeUser) {
    const status = user.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
    setError('')
    setNotice('')
    try {
      await api.patch(`/usuarios/${user.id}/estado`, { status })
      setNotice(status === 'ACTIVO' ? 'Usuario habilitado.' : 'Usuario deshabilitado.')
      await loadUsers()
    } catch (statusError: unknown) {
      setError(getApiErrorMessage(statusError, 'No se pudo cambiar el estado del usuario.'))
    }
  }

  return (
    <section className="admin-users-page">
      <header className="admin-users-heading">
        <div>
          <h1>Bienvenido, Superadministrador</h1>
          <p>Desde acá, podras administrar los funcionarios, organismos y la configuración del sistema.</p>
        </div>
        <span className="admin-users-count">{users.length} cuentas</span>
      </header>

      <div className="admin-users-layout">
        {view === 'create-user' && (
        <form id="administrative-user-form" className="admin-user-form" onSubmit={saveUser}>
          <div className="admin-user-form-heading">
            <div>
              <h2>{editingId ? 'Editar usuario' : 'Crear usuario funcionario'}</h2>
              <p>{editingId ? 'Actualiza sus datos administrativos.' : 'Crea una cuenta para gestionar reportes.'}</p>
            </div>
            {editingId && (
              <button type="button" className="admin-user-cancel" onClick={cancelEditing}>
                Cancelar
              </button>
            )}
          </div>

          <div className="admin-user-fields">
            <label>
              Nombre
              <input
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                autoComplete="given-name"
              />
            </label>
            <label>
              Apellido
              <input
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
              {editingId ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}
              <input
                type="password"
                required={!editingId}
                minLength={8}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                autoComplete="new-password"
                placeholder={editingId ? 'Dejar vacío para conservarla' : 'Mínimo 8 caracteres'}
              />
            </label>
            <label>
              Rol
              <select
                value={form.role}
                disabled={editingId === currentUserId}
                onChange={(event) => setForm({ ...form, role: event.target.value as AdministrativeRole })}
              >
                <option value="FUNCIONARIO">Ente público</option>
                <option value="SUPERADMINISTRADOR">SUPERADMINISTRADOR</option>
              </select>
            </label>
            <label>
              Organismo
              <input
                required={form.role === 'FUNCIONARIO'}
                value={form.entityName}
                onChange={(event) => setForm({ ...form, entityName: event.target.value })}
                placeholder="Ej. Dirección de Tránsito"
              />
            </label>
            <label className="admin-user-field-wide">
              Jurisdicción
              <input
                value={form.jurisdiction}
                onChange={(event) => setForm({ ...form, jurisdiction: event.target.value })}
                placeholder="Ej. Departamento de Cerro Largo"
              />
            </label>
          </div>

          {error && <p className="admin-users-message admin-users-error" role="alert">{error}</p>}
          {notice && <p className="admin-users-message admin-users-success" role="status">{notice}</p>}

          <button className="admin-user-submit" type="submit" disabled={saving}>
            {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </form>
        )}

        {view === 'users' && (
        <section className="admin-user-list" aria-labelledby="admin-user-list-title">
          <header>
            <div>
              <h2 id="admin-user-list-title">Cuentas registradas</h2>
              <p>Los usuarios deshabilitados no pueden iniciar sesión.</p>
            </div>
          </header>

          {loading ? (
            <p className="admin-user-empty">Cargando usuarios…</p>
          ) : users.length === 0 ? (
            <p className="admin-user-empty">Todavía no hay usuarios administrativos.</p>
          ) : (
            <div className="admin-user-table-wrap">
              <table className="admin-user-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol y organismo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}</strong>
                        <span>{user.email}</span>
                      </td>
                      <td>
                        <strong>{user.role === 'SUPERADMINISTRADOR' ? 'SUPERADMINISTRADOR' : 'Ente público'}</strong>
                        <span>{user.entityName || user.jurisdiction || 'Sin organismo asignado'}</span>
                      </td>
                      <td>
                        <span className={`admin-user-status admin-user-status-${user.status.toLowerCase()}`}>
                          {user.status === 'ACTIVO' ? 'Habilitado' : 'Deshabilitado'}
                        </span>
                      </td>
                      <td>
                        <div className="admin-user-actions">
                          <button type="button" onClick={() => startEditing(user)}>Editar</button>
                          <button
                            type="button"
                            className={user.status === 'ACTIVO' ? 'admin-user-disable' : 'admin-user-enable'}
                            disabled={user.id === currentUserId}
                            onClick={() => void toggleUserStatus(user)}
                          >
                            {user.status === 'ACTIVO' ? 'Deshabilitar' : 'Habilitar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        )}
      </div>
    </section>
  )
}

export default GestionUsuarios