import {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  Link,
  useNavigate
} from 'react-router-dom';

import {
  UserCog,
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';

import {
  PageHead,
  Status
} from '../components/UI';

import { api } from '../services/api';


const staffRoles = [
  'admin',
  'manager',
  'receptionist',
  'housekeeping',
  'maintenance'
];


export default function Dashboard() {

  const [users, setUsers] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const navigate =
    useNavigate();


  const loadUsers =
    async () => {

      try {
        setError('');

        const data =
          await api('/users');

        setUsers(
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
    loadUsers();
  }, []);


  const staff =
    useMemo(
      () =>
        users.filter(
          (user) =>
            staffRoles.includes(
              user.role
            )
        ),
      [users]
    );


  const guests =
    useMemo(
      () =>
        users.filter(
          (user) =>
            user.role === 'guest'
        ),
      [users]
    );


  const activeStaff =
    staff.filter(
      (user) =>
        user.isActive
    ).length;


  const inactiveStaff =
    staff.filter(
      (user) =>
        !user.isActive
    ).length;


  const roleCounts =
    staffRoles.reduce(
      (result, role) => {

        result[role] =
          staff.filter(
            (user) =>
              user.role === role
          ).length;

        return result;

      },
      {}
    );


  return (
    <>

      <PageHead
        eyebrow="USER MANAGEMENT"
        title="Admin dashboard"
        description="A focused overview of staff access, roles, permissions and guest profiles."
        action={() =>
          navigate('/staff')
        }
        actionLabel="Add staff"
      />


      {error && (
        <div className="notice error">
          <span>
            {error}
          </span>
        </div>
      )}


      <div className="stats-grid admin-stats">

        <div className="stat-card">

          <div className="stat-top">
            <span>
              Total staff
            </span>

            <div className="stat-icon">
              <UserCog size={18} />
            </div>
          </div>

          <strong>
            {loading
              ? '—'
              : staff.length}
          </strong>

          <small>
            All staff accounts
          </small>

        </div>


        <div className="stat-card">

          <div className="stat-top">
            <span>
              Active staff
            </span>

            <div className="stat-icon">
              <UserCheck size={18} />
            </div>
          </div>

          <strong>
            {loading
              ? '—'
              : activeStaff}
          </strong>

          <small>
            Currently allowed to sign in
          </small>

        </div>


        <div className="stat-card">

          <div className="stat-top">
            <span>
              Inactive staff
            </span>

            <div className="stat-icon">
              <UserX size={18} />
            </div>
          </div>

          <strong>
            {loading
              ? '—'
              : inactiveStaff}
          </strong>

          <small>
            Deactivated accounts
          </small>

        </div>


        <div className="stat-card">

          <div className="stat-top">
            <span>
              Guest profiles
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
            Profiles in the system
          </small>

        </div>

      </div>


      <div className="admin-dashboard-grid">

        <section className="card">

          <div className="card-head">

            <div>
              <h3>
                Roles & access levels
              </h3>

              <span>
                Quick view of staff distribution
              </span>
            </div>

            <Link
              className="text-link"
              to="/staff"
            >
              Manage roles
              <ArrowRight size={14} />
            </Link>

          </div>


          <div className="access-list">

            {[
              [
                'admin',
                'Administrators',
                'Full system access'
              ],
              [
                'manager',
                'Managers',
                'Operations & reports'
              ],
              [
                'receptionist',
                'Receptionists',
                'Guests & reservations'
              ],
              [
                'housekeeping',
                'Housekeeping',
                'Rooms & service tasks'
              ],
              [
                'maintenance',
                'Maintenance',
                'Facility upkeep'
              ]
            ].map(
              ([
                role,
                label,
                detail
              ]) => (

                <div
                  className="access-row"
                  key={role}
                >

                  <div className="access-icon">
                    <ShieldCheck size={16} />
                  </div>

                  <div>
                    <b>
                      {label}
                    </b>

                    <span>
                      {detail}
                    </span>
                  </div>

                  <strong>
                    {roleCounts[role] ||
                      0}
                  </strong>

                </div>

              )
            )}

          </div>

        </section>


        <section className="card">

          <div className="card-head">

            <div>
              <h3>
                Recent profiles
              </h3>

              <span>
                Latest staff and guest records
              </span>
            </div>

          </div>


          <div className="recent-users">

            {loading ? (

              <p className="muted">
                Loading profiles...
              </p>

            ) : (

              users
                .slice(0, 5)
                .map(
                  (person) => (

                    <div
                      className="recent-user"
                      key={person._id}
                    >

                      <div className="guest-avatar">
                        {person.name
                          .split(' ')
                          .map(
                            (part) =>
                              part[0]
                          )
                          .join('')
                          .slice(0, 2)}
                      </div>

                      <div>

                        <b>
                          {person.name}
                        </b>

                        <span>
                          {person.role ===
                          'guest'
                            ? 'Guest profile'
                            : `${person.role} · ${
                                person.department ||
                                'Staff'
                              }`}
                        </span>

                      </div>

                      <Status>
                        {person.isActive
                          ? 'Active'
                          : 'Inactive'}
                      </Status>

                    </div>

                  )
                )
            )}


            {!loading &&
              users.length === 0 && (
                <p className="muted">
                  No profiles found.
                </p>
              )}

          </div>

        </section>

      </div>


      <section className="card admin-quick-actions">

        <div>

          <b>
            Need to update access?
          </b>

          <span>
            Create a staff account, change a role,
            update permissions, or deactivate access.
          </span>

        </div>


        <div className="quick-action-links">

          <Link
            className="btn secondary"
            to="/staff"
          >
            <UserCog size={16} />
            Staff & roles
          </Link>


          <Link
            className="btn secondary"
            to="/guests"
          >
            <Users size={16} />
            Guest profiles
          </Link>

        </div>

      </section>

    </>
  );
}