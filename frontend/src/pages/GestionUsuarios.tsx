import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { getApiErrorMessage } from '../lib/api-error'
import './GestionUsuarios.css'

type AdministrativeRole =
  | 'FUNCIONARIO'
  | 'FUNCIONARIO_ADMINISTRADOR'
  | 'SUPERADMINISTRADOR'
type UserStatus = 'ACTIVO' | 'INACTIVO' | 'BANEADO'
const organizationOptions = ['Intendencia', 'OSE', 'Policía Municipal'] as const

type AdministrativeUserGroup = {
  role: AdministrativeRole
  status: UserStatus
  entityName: string | null
  count: number
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

function roleLabel(role: AdministrativeRole) {
  if (role === 'FUNCIONARIO') return 'Funcionario'
  if (role === 'FUNCIONARIO_ADMINISTRADOR') return 'Funcionario Administrador'
  return 'Superadministrador'
}

function GestionUsuarios({
  view,
  onViewChange,
}: {
  view: 'users' | 'create-user'
  onViewChange: (view: 'users' | 'create-user') => void
}) {
  const [users, setUsers] = useState<AdministrativeUserGroup[]>([])
  const [form, setForm] = useState<UserForm>(emptyForm)
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
      setError(getApiErrorMessage(loadError, 'No se pudieron cargar las cuentas.'))
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
          setError(getApiErrorMessage(loadError, 'No se pudieron cargar las cuentas.'))
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

  function cancelCreation() {
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
      firstName: form.firstName || undefined,
      lastName: form.lastName || undefined,
      entityName: form.entityName || undefined,
      jurisdiction: form.jurisdiction || undefined,
    }

    try {
      await api.post('/usuarios/administrativos', payload)
      setNotice('La cuenta fue creada correctamente.')
      setForm(emptyForm)
      await loadUsers()
    } catch (saveError: unknown) {
      setError(getApiErrorMessage(saveError, 'No se pudo crear la cuenta.'))
    } finally {
      setSaving(false)
    }
  }

  const isStaffRole = form.role !== 'SUPERADMINISTRADOR'

  return (
    <section className="admin-users-page">
      <header className="admin-users-heading">
        <div>
          <h1>Bienvenido, Superadministrador</h1>
          <p>Creá cuentas administrativas y consultá cantidades por rol y organismo.</p>
        </div>
        <span className="admin-users-count">{users.reduce((total, item) => total + item.count, 0)} cuentas</span>
      </header>

      <div className="admin-users-layout">
        {view === 'create-user' ? (
          <form id="administrative-user-form" className="admin-user-form" onSubmit={saveUser}>
            <div className="admin-user-form-heading">
              <div>
                <h2>Crear cuenta administrativa</h2>
                <p>Las cuentas se crean con una contraseña inicial segura.</p>
              </div>
              <button type="button" className="admin-user-cancel" onClick={cancelCreation}>
                Cancelar
              </button>
            </div>

            <div className="admin-user-fields">
              <label>
                Rol
                <select
                  value={form.role}
                  onChange={(event) => {
                    const role = event.target.value as AdministrativeRole
                    setForm({
                      ...form,
                      role,
                      ...(role === 'SUPERADMINISTRADOR'
                        ? { entityName: '', jurisdiction: '' }
                        : {}),
                    })
                  }}
                >
                  <option value="FUNCIONARIO">Funcionario</option>
                  <option value="FUNCIONARIO_ADMINISTRADOR">Funcionario Administrador</option>
                  <option value="SUPERADMINISTRADOR">Superadministrador</option>
                </select>
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
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                />
              </label>
              {isStaffRole && (
                <>
                  <label>
                    Organismo
                    <select
                      required
                      value={form.entityName}
                      onChange={(event) => setForm({ ...form, entityName: event.target.value })}
                    >
                      <option value="" disabled>Seleccioná un organismo</option>
                      {organizationOptions.map((organization) => (
                        <option key={organization} value={organization}>
                          {organization}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Jurisdicción
                    <input
                      value={form.jurisdiction}
                      onChange={(event) => setForm({ ...form, jurisdiction: event.target.value })}
                      placeholder="Ej. Departamento de Cerro Largo"
                    />
                  </label>
                </>
              )}
            </div>

            {error && <p className="admin-users-message admin-users-error" role="alert">{error}</p>}
            {notice && <p className="admin-users-message admin-users-success" role="status">{notice}</p>}

            <button className="admin-user-submit" type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Crear cuenta'}
            </button>
          </form>
        ) : (
          <section className="admin-user-list" aria-labelledby="admin-user-list-title">
            <header>
              <div>
                <h2 id="admin-user-list-title">Resumen de cuentas registradas</h2>
                <p>Los datos personales y credenciales de otras cuentas están protegidos.</p>
              </div>
              <button type="button" onClick={() => {
                setNotice('')
                setError('')
                onViewChange('create-user')
              }}>
                Crear cuenta
              </button>
            </header>

            {error && <p className="admin-users-message admin-users-error" role="alert">{error}</p>}
            {loading ? (
              <p className="admin-user-empty">Cargando resumen…</p>
            ) : users.length === 0 ? (
              <p className="admin-user-empty">Todavía no hay cuentas administrativas.</p>
            ) : (
              <div className="admin-user-table-wrap">
                <table className="admin-user-table">
                  <thead>
                    <tr>
                      <th>Rol y organismo</th>
                      <th>Estado</th>
                      <th>Cuentas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user, index) => (
                      <tr key={`${user.role}-${user.entityName}-${user.status}-${index}`}>
                        <td>
                          <strong>{roleLabel(user.role)}</strong>
                          <span>{user.entityName || 'Sin organismo asignado'}</span>
                        </td>
                        <td>
                          <span className={`admin-user-status admin-user-status-${user.status.toLowerCase()}`}>
                            {user.status === 'ACTIVO' ? 'Habilitado' : 'Deshabilitado'}
                          </span>
                        </td>
                        <td>{user.count}</td>
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
