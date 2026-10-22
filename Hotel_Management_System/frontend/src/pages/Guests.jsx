import {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  Mail,
  MapPin,
  Pencil,
  Phone,
  UserRound,
  Users,
  X
} from 'lucide-react';

import {
  PageHead,
  Status
} from '../components/UI';

import { api } from '../services/api';


const emptyForm = {
  name: '',
  email: '',
  phone: '',
  nationality: '',
  idNumber: '',
  password: '',
  address: '',
  preferences: '',
  notes: '',
  isActive: true
};


export default function Guests() {

  const [guests, setGuests] =
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


  const loadGuests =
    async () => {

      try {

        setError('');

        const data =
          await api(
            '/users?type=guest'
          );

        setGuests(
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
    loadGuests();
  }, []);


  const visibleGuests =
    useMemo(() => {

      const term =
        search
          .trim()
          .toLowerCase();

      return guests.filter(
        (guest) => {

          const matchesFilter =
            filter === 'all' ||
            (
              filter === 'active' &&
              guest.isActive
            ) ||
            (
              filter === 'inactive' &&
              !guest.isActive
            );

          const matchesSearch =
            !term ||
            [
              guest.name,
              guest.email,
              guest.phone,
              guest.nationality,
              guest.idNumber
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
      guests,
      filter,
      search
    ]);


  const activeCount =
    guests.filter(
      (guest) =>
        guest.isActive
    ).length;


  const inactiveCount =
    guests.length -
    activeCount;


  const openCreate =
    () => {

      setForm(emptyForm);

      setModal('create');

      setError('');
      setNotice('');
    };


  const openEdit =
    (guest) => {

      setForm({

        name:
          guest.name || '',

        email:
          guest.email || '',

        phone:
          guest.phone || '',

        nationality:
          guest.nationality || '',

        idNumber:
          guest.idNumber || '',

        password: '',

        address:
          guest.address || '',

        preferences:
          guest.preferences || '',

        notes:
          guest.notes || '',

        isActive:
          guest.isActive

      });

      setModal(guest);

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


  const handleSubmit =
    async (event) => {

      event.preventDefault();

      setSaving(true);

      setError('');
      setNotice('');

      try {

        if (!form.name.trim()) {
          throw new Error(
            'Guest full name is required.'
          );
        }

        if (modal === 'create' && !form.password.trim()) {
          throw new Error('A guest password is required.');
        }

        if (form.password && form.password.length < 6) {
          throw new Error('Guest password must be at least 6 characters.');
        }


        const payload = {

          name:
            form.name.trim(),

          email:
            form.email.trim(),

          phone:
            form.phone.trim(),

          nationality:
            form.nationality.trim(),

          idNumber:
            form.idNumber.trim(),

          address:
            form.address.trim(),

          preferences:
            form.preferences.trim(),

          notes:
            form.notes.trim(),

          password:
            form.password.trim(),

          isActive:
            form.isActive,

          role: 'guest'
        };


        if (modal === 'create') {

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
            'Guest profile created successfully.'
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

          if (form.password.trim()) {
            await api(
              `/users/${modal._id}/password`,
              {
                method: 'PATCH',
                body: JSON.stringify({ password: form.password.trim() })
              }
            );
          }

          setNotice(
            form.password.trim()
              ? 'Guest profile and login password updated successfully.'
              : 'Guest profile updated successfully.'
          );
        }


        await loadGuests();

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
    async (guest) => {

      try {

        setError('');

        const data =
          await api(
            `/users/${guest._id}/status`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                isActive:
                  !guest.isActive
              })
            }
          );

        setGuests(
          (current) =>
            current.map(
              (item) =>
                item._id ===
                guest._id
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


  return (
    <>

      <PageHead
        eyebrow="USER MANAGEMENT"
        title="Guest profiles"
        description="Create and maintain complete guest profiles with contact details, identification, preferences and notes."
        action={openCreate}
        actionLabel="Add guest"
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


      <div className="stats-grid guest-stats">

        <div className="stat-card">

          <div className="stat-top">

            <span>
              Total profiles
            </span>

            <div className="stat-icon">
              <Users size={18} />
            </div>

          </div>

          <strong>
            {loading
              ? '—'
              : guests.length}
          </strong>

          <small>
            Guest records
          </small>

        </div>


        <div className="stat-card">

          <div className="stat-top">

            <span>
              Active
            </span>

            <div className="stat-icon">
              <UserRound size={18} />
            </div>

          </div>

          <strong>
            {loading
              ? '—'
              : activeCount}
          </strong>

          <small>
            Available for hotel operations
          </small>

        </div>


        <div className="stat-card">

          <div className="stat-top">

            <span>
              Inactive
            </span>

            <div className="stat-icon">
              <UserRound size={18} />
            </div>

          </div>

          <strong>
            {loading
              ? '—'
              : inactiveCount}
          </strong>

          <small>
            Archived profiles
          </small>

        </div>

      </div>


      <section className="card staff-panel">

        <div className="staff-toolbar">

          <div className="staff-search">

            <UserRound size={16} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search by name, email, phone or ID..."
            />

          </div>


          <div className="guest-filters">

            {[
              'all',
              'active',
              'inactive'
            ].map(
              (key) => (

                <button
                  type="button"
                  key={key}
                  className={`btn secondary ${
                    filter === key
                      ? 'active'
                      : ''
                  }`}
                  onClick={() =>
                    setFilter(key)
                  }
                >

                  {key === 'all'
                    ? 'All'
                    : key === 'active'
                    ? 'Active'
                    : 'Inactive'}

                </button>

              )
            )}

          </div>

        </div>


        <div className="staff-table-wrap">

          <table className="staff-table guest-table">

            <thead>

              <tr>

                <th>
                  Guest
                </th>

                <th>
                  Contact
                </th>

                <th>
                  Identification
                </th>

                <th>
                  Preferences
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

              {visibleGuests.map(
                (guest) => (

                  <tr
                    key={
                      guest._id
                    }
                  >

                    <td>

                      <div className="table-person">

                        <div className="guest-avatar">

                          {guest.name
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
                            {guest.name}
                          </b>

                          <small>
                            {guest.nationality ||
                              'Nationality not added'}
                          </small>

                        </span>

                      </div>

                    </td>


                    <td>

                      <div className="contact">

                        <span>
                          <Mail size={13} />
                          {guest.email ||
                            'No email'}
                        </span>

                        <span>
                          <Phone size={13} />
                          {guest.phone ||
                            'No phone'}
                        </span>

                      </div>

                    </td>


                    <td>
                      {guest.idNumber ||
                        '—'}
                    </td>


                    <td>

                      <span className="table-note">

                        {guest.preferences ||
                          'No preferences recorded'}

                      </span>

                    </td>


                    <td>

                      <Status>
                        {guest.isActive
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
                              guest
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
                              guest
                            )
                          }
                        >

                          {guest.isActive
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
            visibleGuests.length ===
              0 && (

              <div className="empty">

                <div className="empty-icon">
                  <UserRound />
                </div>

                <h3>
                  No guest profiles found
                </h3>

                <p>
                  Try another search or create
                  a new guest profile.
                </p>

              </div>

            )}


          {loading && (

            <div className="empty">

              <p>
                Loading guest profiles...
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
            className="modal-card guest-modal"
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
                    ? 'NEW GUEST PROFILE'
                    : 'EDIT GUEST PROFILE'}

                </div>

                <h3>

                  {modal === 'create'
                    ? 'Create guest profile'
                    : form.name}

                </h3>

                <p>
                  Keep the guest's personal and service
                  preferences together in one profile. Login passwords are stored securely and are never displayed in plain text.
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
                  placeholder="e.g. Amina Tariq"
                />

              </label>


              <label>

                Email

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
                  placeholder="guest@example.com"
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

                Nationality

                <input
                  value={
                    form.nationality
                  }
                  onChange={(
                    event
                  ) =>
                    updateForm(
                      'nationality',
                      event.target
                        .value
                    )
                  }
                  placeholder="e.g. Pakistani"
                />

              </label>


              <label>

                Passport / ID number

                <input
                  value={
                    form.idNumber
                  }
                  onChange={(
                    event
                  ) =>
                    updateForm(
                      'idNumber',
                      event.target
                        .value
                    )
                  }
                  placeholder="e.g. 123456789"
                />

              </label>


              <label>

                {modal === 'create' ? 'Login password' : 'New password (optional)'}

                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => updateForm('password', event.target.value)}
                  placeholder={modal === 'create' ? 'Minimum 6 characters' : 'Leave blank to keep current password'}
                  autoComplete="new-password"
                />

              </label>


              <label className="wide">

                <span>
                  <MapPin size={14} />
                  Address
                </span>

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
                  placeholder="Guest address"
                />

              </label>


              <label className="wide">

                Preferences

                <textarea
                  value={
                    form.preferences
                  }
                  onChange={(
                    event
                  ) =>
                    updateForm(
                      'preferences',
                      event.target
                        .value
                    )
                  }
                  placeholder="Room preference, dietary needs, arrival requirements, etc."
                />

              </label>


              <label className="wide">

                Internal notes

                <textarea
                  value={
                    form.notes
                  }
                  onChange={(
                    event
                  ) =>
                    updateForm(
                      'notes',
                      event.target
                        .value
                    )
                  }
                  placeholder="Optional notes for authorized staff"
                />

              </label>


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
                    Profile active
                  </b>

                  <small>
                    Inactive profiles remain in the
                    system but are no longer active records.
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
                    ? 'Create profile'
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