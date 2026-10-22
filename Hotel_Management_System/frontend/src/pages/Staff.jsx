import {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  KeyRound,
  Pencil,
  ShieldCheck,
  UserCog,
  X
} from 'lucide-react';

import {
  PageHead,
  Status
} from '../components/UI';

import { api } from '../services/api';


const roles = [
  {
    value: 'admin',
    label: 'Administrator',
    detail: 'Full access'
  },
  {
    value: 'manager',
    label: 'Manager',
    detail: 'Operations & reports'
  },
  {
    value: 'receptionist',
    label: 'Receptionist',
    detail: 'Rooms (view) & reservations'
  },
  {
    value: 'housekeeping',
    label: 'Housekeeping',
    detail: 'Rooms & service tasks'
  },
  {
    value: 'maintenance',
    label: 'Maintenance',
    detail: 'Facility upkeep'
  }
];


const permissionOptions = [
  ['dashboard', 'Dashboard'],
  ['guests', 'Guest profiles'],
  ['reservations', 'Reservations'],
  ['rooms', 'Rooms'],
  ['housekeeping', 'Housekeeping'],
  ['maintenance', 'Maintenance'],
  ['billing', 'Billing'],
  ['reports', 'Reports'],
  ['services', 'Services'],
  ['settings', 'Settings']
];


const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'receptionist',
  department: 'Front Desk',
  phone: '',
  address: '',
  permissions: [
    'rooms',
    'reservations'
  ],
  isActive: true
};


const roleDefaults = {
  admin:
    permissionOptions.map(
      ([value]) => value
    ),

  manager: [
    'rooms',
    'reservations',
    'housekeeping',
    'maintenance',
    'billing',
    'reports',
    'services'
  ],

  receptionist: [
    'rooms',
    'reservations'
  ],

  housekeeping: [
    'rooms',
    'housekeeping',
    'maintenance'
  ],

  maintenance: [
    'rooms',
    'maintenance'
  ]
};


export default function Staff() {

  const [staff, setStaff] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [notice, setNotice] =
    useState('');

  const [filter, setFilter] =
    useState('all');

  const [search, setSearch] =
    useState('');

  const [modal, setModal] =
    useState(null);

  const [form, setForm] =
    useState(emptyForm);


  const loadStaff =
    async () => {

      try {
        setError('');

        const data =
          await api(
            '/users?type=staff'
          );

        setStaff(
          Array.isArray(data)
            ? data
            : []
        );

      } catch (err) {
        setError(
          err.message
        );
      } finally {
        setLoading(false);
      }
    };


  useEffect(() => {
    loadStaff();
  }, []);


  const counts =
    useMemo(
      () => ({
        all: staff.length,

        active:
          staff.filter(
            (person) =>
              person.isActive
          ).length,

        inactive:
          staff.filter(
            (person) =>
              !person.isActive
          ).length,

        admin:
          staff.filter(
            (person) =>
              person.role === 'admin'
          ).length,

        manager:
          staff.filter(
            (person) =>
              person.role === 'manager'
          ).length,

        receptionist:
          staff.filter(
            (person) =>
              person.role ===
              'receptionist'
          ).length,

        housekeeping:
          staff.filter(
            (person) =>
              person.role ===
              'housekeeping'
          ).length,

        maintenance:
          staff.filter(
            (person) =>
              person.role ===
              'maintenance'
          ).length
      }),
      [staff]
    );


  const visibleStaff =
    useMemo(() => {

      const term =
        search
          .trim()
          .toLowerCase();

      return staff.filter(
        (person) => {

          const matchesFilter =
            filter === 'all' ||
            (
              filter === 'active' &&
              person.isActive
            ) ||
            (
              filter === 'inactive' &&
              !person.isActive
            ) ||
            person.role === filter;

          const matchesSearch =
            !term ||
            [
              person.name,
              person.email,
              person.department,
              person.role
            ]
              .filter(Boolean)
              .some(
                (value) =>
                  value
                    .toLowerCase()
                    .includes(term)
              );

          return (
            matchesFilter &&
            matchesSearch
          );
        }
      );

    }, [
      staff,
      filter,
      search
    ]);


  const openCreate =
    () => {

      setForm(emptyForm);

      setModal('create');

      setError('');
      setNotice('');
    };


  const openEdit =
    (person) => {

      setForm({
        name:
          person.name || '',

        email:
          person.email || '',

        password: '',

        role:
          person.role,

        department:
          person.department || '',

        phone:
          person.phone || '',

        address:
          person.address || '',

        permissions:
          person.permissions ||
          roleDefaults[
            person.role
          ] ||
          [],

        isActive:
          person.isActive
      });

      setModal(person);

      setError('');
      setNotice('');
    };


  const closeModal =
    () => {

      if (!saving) {
        setModal(null);
      }
    };


  const updateForm =
    (key, value) => {

      setForm(
        (current) => ({
          ...current,
          [key]: value
        })
      );
    };


  const changeRole =
    (role) => {

      updateForm(
        'role',
        role
      );

      setForm(
        (current) => ({
          ...current,
          role,
          permissions:
            roleDefaults[role] ||
            []
        })
      );
    };


  const togglePermission =
    (permission) => {

      setForm(
        (current) => ({

          ...current,

          permissions:
            current.permissions.includes(
              permission
            )
              ? current.permissions.filter(
                  (item) =>
                    item !== permission
                )
              : [
                  ...current.permissions,
                  permission
                ]
        })
      );
    };


  const handleSubmit =
    async (event) => {

      event.preventDefault();

      setSaving(true);

      setError('');
      setNotice('');

      try {

        if (!form.name.trim()) {
          throw new Error(
            'Full name is required.'
          );
        }

        if (!form.email.trim()) {
          throw new Error(
            'Work email is required.'
          );
        }

        if (
          modal === 'create' &&
          !form.password
        ) {
          throw new Error(
            'A temporary password is required for a staff account.'
          );
        }

        if (
          modal !== 'create' &&
          form.password &&
          form.password.length < 6
        ) {
          throw new Error(
            'New password must be at least 6 characters.'
          );
        }


        const payload = {

          name:
            form.name.trim(),

          email:
            form.email.trim(),

          role:
            form.role,

          department:
            form.department.trim(),

          phone:
            form.phone.trim(),

          address:
            form.address.trim(),

          permissions:
            form.role === 'admin'
              ? roleDefaults.admin
              : form.permissions,

          isActive:
            form.isActive
        };


        if (modal === 'create') {

          payload.password =
            form.password;

          await api(
            '/users',
            {
              method: 'POST',
              body: JSON.stringify(
                payload
              )
            }
          );

          setNotice(
            'Staff account created successfully.'
          );

        } else {

          await api(
            `/users/${modal._id}`,
            {
              method: 'PUT',
              body: JSON.stringify(
                payload
              )
            }
          );

          if (form.password) {
            await api(
              `/users/${modal._id}/password`,
              {
                method: 'PATCH',
                body: JSON.stringify({
                  password: form.password
                })
              }
            );

            setNotice(
              'Staff profile and password updated successfully.'
            );
          } else {
            setNotice(
              'Staff profile updated successfully.'
            );
          }
        }


        await loadStaff();

        setModal(null);

      } catch (err) {

        setError(
          err.message
        );

      } finally {

        setSaving(false);
      }
    };


  const toggleStatus =
    async (person) => {

      try {

        setError('');
        setNotice('');

        const data =
          await api(
            `/users/${person._id}/status`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                isActive:
                  !person.isActive
              })
            }
          );

        setStaff(
          (current) =>
            current.map(
              (item) =>
                item._id ===
                person._id
                  ? data.user
                  : item
            )
        );

        setNotice(
          data.message
        );

      } catch (err) {

        setError(
          err.message
        );
      }
    };


  const saveRole =
    async (
      person,
      role
    ) => {

      try {

        setError('');

        const data =
          await api(
            `/users/${person._id}/role`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                role
              })
            }
          );

        setStaff(
          (current) =>
            current.map(
              (item) =>
                item._id ===
                person._id
                  ? data.user
                  : item
            )
        );

        setNotice(
          'Role updated successfully.'
        );

      } catch (err) {

        setError(
          err.message
        );
      }
    };


  return (
    <>

      <PageHead
        eyebrow="USER MANAGEMENT"
        title="Staff & roles"
        description="Create staff accounts, control access levels, update permissions, and deactivate accounts when needed."
        action={openCreate}
        actionLabel="Add staff"
      />


      {error && (
        <div className="notice error">
          <span>
            {error}
          </span>
        </div>
      )}


      {notice && (
        <div className="notice success">
          <span>
            {notice}
          </span>
        </div>
      )}


      <div className="role-cards staff-role-cards">

        {[
          [
            'all',
            'All staff',
            'Every staff account',
            counts.all
          ],

          [
            'active',
            'Active',
            'Can sign in',
            counts.active
          ],

          [
            'manager',
            'Managers',
            'Operations',
            counts.manager
          ],

          [
            'receptionist',
            'Receptionists',
            'Front desk',
            counts.receptionist
          ],

          [
            'housekeeping',
            'Housekeeping',
            'Room services',
            counts.housekeeping
          ],

          [
            'maintenance',
            'Maintenance',
            'Facilities',
            counts.maintenance
          ]
        ].map(
          ([
            key,
            title,
            detail,
            count
          ]) => (

            <button
              type="button"
              key={key}
              className={`role-card ${
                filter === key
                  ? 'selected'
                  : ''
              }`}
              onClick={() =>
                setFilter(key)
              }
            >

              <div className="role-card-icon">
                <UserCog size={18} />
              </div>

              <b>
                {title}
              </b>

              <span>
                {detail}
              </span>

              <small>
                {count} account
                {count === 1
                  ? ''
                  : 's'}
              </small>

            </button>
          )
        )}

      </div>


      <section className="card staff-panel">

        <div className="staff-toolbar">

          <div className="staff-search">

            <UserCog size={16} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search staff by name, email or department..."
            />

          </div>


          <button
            type="button"
            className={`btn secondary ${
              filter === 'inactive'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              setFilter(
                filter === 'inactive'
                  ? 'all'
                  : 'inactive'
              )
            }
          >
            {counts.inactive} inactive
          </button>

        </div>


        <div className="staff-table-wrap">

          <table className="staff-table">

            <thead>

              <tr>
                <th>
                  Staff member
                </th>

                <th>
                  Role
                </th>

                <th>
                  Department
                </th>

                <th>
                  Permissions
                </th>

                <th>
                  Status
                </th>

                <th>
                  Actions
                </th>
              </tr>

            </thead>


            <tbody>

              {visibleStaff.map(
                (person) => (

                  <tr
                    key={
                      person._id
                    }
                  >

                    <td>

                      <div className="table-person">

                        <div className="guest-avatar">
                          {person.name
                            .split(' ')
                            .map(
                              (part) =>
                                part[0]
                            )
                            .join('')
                            .slice(
                              0,
                              2
                            )}
                        </div>

                        <span>

                          <b>
                            {person.name}
                          </b>

                          <small>
                            {person.email ||
                              'No email'}
                          </small>

                        </span>

                      </div>

                    </td>


                    <td>

                      <select
                        className="mini-select"
                        value={
                          person.role
                        }
                        onChange={(
                          event
                        ) =>
                          saveRole(
                            person,
                            event.target
                              .value
                          )
                        }
                      >

                        {roles.map(
                          (role) => (

                            <option
                              key={
                                role.value
                              }
                              value={
                                role.value
                              }
                            >
                              {role.label}
                            </option>

                          )
                        )}

                      </select>

                    </td>


                    <td>
                      {person.department ||
                        '—'}
                    </td>


                    <td>

                      <span className="permission-count">

                        {person.role ===
                        'admin'
                          ? 'All permissions'
                          : `${
                              (
                                person.permissions ||
                                []
                              ).length
                            } enabled`}

                      </span>

                    </td>


                    <td>

                      <Status>
                        {person.isActive
                          ? 'Active'
                          : 'Inactive'}
                      </Status>

                    </td>


                    <td>

                      <div className="inline-actions staff-actions">

                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() =>
                            openEdit(
                              person
                            )
                          }
                        >

                          <Pencil
                            size={13}
                          />

                          Edit

                        </button>


                        <button
                          type="button"
                          className="btn-link"
                          onClick={() =>
                            toggleStatus(
                              person
                            )
                          }
                        >
                          {person.isActive
                            ? 'Deactivate'
                            : 'Activate'}
                        </button>

                      </div>

                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>


          {!loading &&
            visibleStaff.length ===
              0 && (

              <div className="empty">

                <div className="empty-icon">
                  <UserCog />
                </div>

                <h3>
                  No staff accounts found
                </h3>

                <p>
                  Try another filter or create
                  a new staff account.
                </p>

              </div>

            )}


          {loading && (

            <div className="empty">

              <p>
                Loading staff accounts...
              </p>

            </div>

          )}

        </div>

      </section>


      {modal && (

        <div
          className="modal-backdrop"
          onMouseDown={
            closeModal
          }
        >

          <div
            className="modal-card staff-modal"
            onMouseDown={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <div className="eyebrow">

                  {modal === 'create'
                    ? 'NEW STAFF ACCOUNT'
                    : 'EDIT STAFF ACCOUNT'}

                </div>

                <h3>

                  {modal === 'create'
                    ? 'Create access profile'
                    : form.name}

                </h3>

                <p>
                  Set the staff member's role and
                  exactly what they can access.
                </p>

              </div>


              <button
                type="button"
                className="close-btn"
                onClick={
                  closeModal
                }
              >
                <X size={18} />
              </button>

            </div>


            <form
              onSubmit={
                handleSubmit
              }
              className="form-grid"
            >

              <label>

                Full name

                <input
                  value={
                    form.name
                  }
                  onChange={(
                    event
                  ) =>
                    updateForm(
                      'name',
                      event.target
                        .value
                    )
                  }
                  placeholder="e.g. Samira Ali"
                />

              </label>


              <label>

                Work email

                <input
                  type="email"
                  value={
                    form.email
                  }
                  onChange={(
                    event
                  ) =>
                    updateForm(
                      'email',
                      event.target
                        .value
                    )
                  }
                  placeholder="name@luxurystay.com"
                />

              </label>


              <label>

                {modal === 'create'
                  ? 'Temporary password'
                  : 'New password'}

                <input
                  type="password"
                  value={
                    form.password
                  }
                  onChange={(
                    event
                  ) =>
                    updateForm(
                      'password',
                      event.target
                        .value
                    )
                  }
                  placeholder={
                    modal === 'create'
                      ? 'Minimum 6 characters'
                      : 'Leave blank to keep the current password'
                  }
                  minLength={
                    modal === 'create'
                      ? 6
                      : undefined
                  }
                  autoComplete={
                    modal === 'create'
                      ? 'new-password'
                      : 'new-password'
                  }
                />

              </label>


              <label>

                Department

                <input
                  value={
                    form.department
                  }
                  onChange={(
                    event
                  ) =>
                    updateForm(
                      'department',
                      event.target
                        .value
                    )
                  }
                  placeholder="Front Desk"
                />

              </label>


              <label>

                Phone

                <input
                  value={
                    form.phone
                  }
                  onChange={(
                    event
                  ) =>
                    updateForm(
                      'phone',
                      event.target
                        .value
                    )
                  }
                  placeholder="+92 300 0000000"
                />

              </label>


              <label>

                Role

                <select
                  value={
                    form.role
                  }
                  onChange={(
                    event
                  ) =>
                    changeRole(
                      event.target
                        .value
                    )
                  }
                >

                  {roles.map(
                    (role) => (

                      <option
                        key={
                          role.value
                        }
                        value={
                          role.value
                        }
                      >
                        {role.label}
                      </option>

                    )
                  )}

                </select>

              </label>


              <label className="wide">

                Address

                <input
                  value={
                    form.address
                  }
                  onChange={(
                    event
                  ) =>
                    updateForm(
                      'address',
                      event.target
                        .value
                    )
                  }
                  placeholder="Staff address (optional)"
                />

              </label>


              <div className="permission-box wide">

                <div className="permission-heading">

                  <div>

                    <b>
                      <KeyRound size={16} />
                      Permissions
                    </b>

                    <span>
                      Choose the modules this role
                      can access.
                    </span>

                  </div>

                  <ShieldCheck size={20} />

                </div>


                <div className="permission-grid">

                  {permissionOptions.map(
                    ([
                      value,
                      label
                    ]) => (

                      <label
                        className="permission-item"
                        key={value}
                      >

                        <input
                          type="checkbox"
                          checked={
                            form.role ===
                              'admin' ||
                            form.permissions.includes(
                              value
                            )
                          }
                          disabled={
                            form.role ===
                            'admin'
                          }
                          onChange={() =>
                            togglePermission(
                              value
                            )
                          }
                        />

                        <span>
                          {label}
                        </span>

                      </label>

                    )
                  )}

                </div>


                {form.role ===
                  'admin' && (

                  <small className="permission-note">
                    Administrators automatically
                    receive all available permissions.
                  </small>

                )}

              </div>


              <label className="status-toggle wide">

                <input
                  type="checkbox"
                  checked={
                    form.isActive
                  }
                  onChange={(
                    event
                  ) =>
                    updateForm(
                      'isActive',
                      event.target
                        .checked
                    )
                  }
                />

                <span>

                  <b>
                    Account active
                  </b>

                  <small>
                    Active staff can sign in;
                    inactive staff are blocked from login.
                  </small>

                </span>

              </label>


              <div className="form-actions wide">

                <button
                  type="button"
                  className="btn secondary"
                  onClick={
                    closeModal
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="btn primary"
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? 'Saving...'
                    : modal ===
                      'create'
                    ? 'Create account'
                    : 'Save changes'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </>
  );
}