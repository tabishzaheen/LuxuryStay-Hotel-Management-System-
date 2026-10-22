import {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ConciergeBell,
  DoorOpen,
  ExternalLink,
  FileText,
  LogIn,
  LogOut,
  Minus,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react';

import {
  PageHead,
  Status
} from '../components/UI';

import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';


const pad = (value) =>
  String(value).padStart(2, '0');


const today = () => {

  const date = new Date();

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;

};


const tomorrow = () => {

  const date = new Date();

  date.setDate(
    date.getDate() + 1
  );

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;

};


const emptyForm = () => ({
  guest: '',
  room: '',
  checkIn: today(),
  checkOut: tomorrow()
});


const formatDate = (value) => {

  if (!value) return '—';

  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }
  ).format(
    new Date(value)
  );

};


const money = (value) =>
  `$${Number(
    value || 0
  ).toLocaleString()}`;


export default function Reservations() {
  const { user } = useAuth();
  const canUseGuestServices = ['admin', 'manager', 'receptionist'].includes(user?.role);

  const [bookings, setBookings] =
    useState([]);

  const [guests, setGuests] =
    useState([]);

  const [rooms, setRooms] =
    useState([]);

  const [serviceCatalog, setServiceCatalog] =
    useState([]);

  const [serviceId, setServiceId] =
    useState('');

  const [serviceQty, setServiceQty] =
    useState('1');

  const [serviceBusy, setServiceBusy] =
    useState(false);

  const [search, setSearch] =
    useState('');

  const [filter, setFilter] =
    useState('all');

  const [modal, setModal] =
    useState(false);

  const [details, setDetails] =
    useState(null);

  const [form, setForm] =
    useState(emptyForm());

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [actionId, setActionId] =
    useState('');

  const [error, setError] =
    useState('');

  const [notice, setNotice] =
    useState('');


  const loadData = async () => {

    try {

      setLoading(true);
      setError('');

      const [
        bookingData,
        guestData,
        roomData,
        serviceData
      ] = await Promise.all([

        api('/bookings'),

        api(
          '/users/guest-lookup?active=true'
        ),

        api('/rooms'),

        api('/services')

      ]);


      setBookings(
        Array.isArray(bookingData)
          ? bookingData
          : []
      );

      setGuests(
        Array.isArray(guestData)
          ? guestData
          : []
      );

      setRooms(
        Array.isArray(roomData)
          ? roomData
          : []
      );

      setServiceCatalog(
        Array.isArray(serviceData)
          ? serviceData
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

    loadData();

  }, []);


  const loadAvailableRooms =
    async (
      checkIn,
      checkOut
    ) => {

      if (
        !checkIn ||
        !checkOut ||
        checkIn >= checkOut
      ) {

        setRooms([]);

        return;
      }


      try {

        const data =
          await api(
            `/bookings/availability?checkIn=${encodeURIComponent(
              checkIn
            )}&checkOut=${encodeURIComponent(
              checkOut
            )}`
          );


        setRooms(
          Array.isArray(data)
            ? data
            : []
        );

      } catch (err) {

        setError(
          err.message
        );

      }

    };


  const openCreate =
    async () => {

      const next =
        emptyForm();

      setForm(next);

      setModal(true);

      setError('');
      setNotice('');

      await loadAvailableRooms(
        next.checkIn,
        next.checkOut
      );

    };


  const closeCreate = () => {

    if (!saving) {
      setModal(false);
    }

  };


  const updateForm =
    async (
      key,
      value
    ) => {

      const next = {
        ...form,
        [key]: value
      };

      setForm(next);


      if (
        key === 'checkIn' ||
        key === 'checkOut'
      ) {

        setForm(
          (current) => ({
            ...current,
            room: ''
          })
        );

        await loadAvailableRooms(
          next.checkIn,
          next.checkOut
        );

      }

    };


  const createBooking =
    async (event) => {

      event.preventDefault();

      setSaving(true);

      setError('');
      setNotice('');


      try {

        if (!form.guest) {
          throw new Error(
            'Please select a guest profile.'
          );
        }


        if (!form.room) {
          throw new Error(
            'Please select an available room.'
          );
        }


        if (
          form.checkIn >=
          form.checkOut
        ) {
          throw new Error(
            'Check-out must be after check-in.'
          );
        }


        const booking =
          await api(
            '/bookings',
            {
              method: 'POST',

              body:
                JSON.stringify(form)
            }
          );


        setNotice(
          `Reservation created successfully for ${
            booking.guest?.name ||
            'the guest'
          }.`
        );


        setModal(false);

        await loadData();

      } catch (err) {

        setError(
          err.message
        );

      } finally {

        setSaving(false);

      }

    };


  const openDetails = (booking) => {
    setDetails(booking);
    setServiceId('');
    setServiceQty('1');
  };


  const addService =
    async () => {
      if (!details?.status || details.status === 'checked-out' || details.status === 'cancelled') {
        return;
      }

      const service =
        serviceCatalog.find(
          (item) => item._id === serviceId
        );

      const quantity =
        Number(serviceQty);

      if (!service) {
        setError('Please select a service.');
        return;
      }

      if (!Number.isInteger(quantity) || quantity < 1) {
        setError('Service quantity must be at least 1.');
        return;
      }

      try {
        setError('');
        setNotice('');
        setServiceBusy(true);

        const data =
          await api(
            `/bookings/${details._id}/services`,
            {
              method: 'POST',
              body: JSON.stringify({
                serviceId: service._id,
                name: service.name,
                price: service.price,
                quantity
              })
            }
          );

        setDetails(data.booking);
        setServiceId('');
        setServiceQty('1');
        setNotice(`${service.name} added to the reservation.`);
        await loadData();
      } catch (err) {
        setError(err.message);
      } finally {
        setServiceBusy(false);
      }
    };


  const updateServiceQty =
    async (service, quantity) => {
      if (!details?._id || !service?._id) return;

      const qty = Number(quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        setError('Service quantity must be at least 1.');
        return;
      }

      if (qty === Number(service.quantity || 1)) return;

      try {
        setError('');
        setNotice('');
        setServiceBusy(true);

        const data = await api(
          `/bookings/${details._id}/services/${service._id}`,
          {
            method: 'PUT',
            body: JSON.stringify({ quantity: qty })
          }
        );

        setDetails(data.booking);
        setNotice(`${service.name} quantity updated.`);
        await loadData();
      } catch (err) {
        setError(err.message);
      } finally {
        setServiceBusy(false);
      }
    };


  const removeService =
    async (service) => {
      if (!details?._id || !service?._id) return;

      try {
        setError('');
        setNotice('');
        setServiceBusy(true);

        const data = await api(
          `/bookings/${details._id}/services/${service._id}`,
          { method: 'DELETE' }
        );

        setDetails(data.booking);
        setNotice(`${service.name} removed from the reservation.`);
        await loadData();
      } catch (err) {
        setError(err.message);
      } finally {
        setServiceBusy(false);
      }
    };


  const runAction =
    async (
      booking,
      action
    ) => {

      setActionId(
        `${booking._id}:${action}`
      );

      setError('');
      setNotice('');


      try {

        const path =
          action === 'check-in'
            ? `/bookings/${booking._id}/check-in`
            : action === 'check-out'
            ? `/bookings/${booking._id}/check-out`
            : `/bookings/${booking._id}/cancel`;


        const data =
          await api(
            path,
            {
              method: 'PATCH'
            }
          );


        setNotice(
          data.message ||
          'Reservation updated successfully.'
        );


        setDetails(
          data.booking ||
          null
        );


        await loadData();

      } catch (err) {

        setError(
          err.message
        );

      } finally {

        setActionId('');

      }

    };


  const filtered =
    useMemo(() => {

      const term =
        search
          .trim()
          .toLowerCase();


      return bookings.filter(
        (booking) => {

          const matchesFilter =
            filter === 'all' ||
            (filter === 'online'
              ? booking.source === 'online'
              : booking.status === filter);


          const haystack = [

            booking.guest?.name,

            booking.guest?.email,

            booking.room?.number,

            booking.room?.type,

            booking.source === 'online'
              ? 'online reservation'
              : 'front desk'

          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();


          return (
            matchesFilter &&
            (
              !term ||
              haystack.includes(
                term
              )
            )
          );

        }
      );

    }, [
      bookings,
      filter,
      search
    ]);


  const counts =
    useMemo(
      () => ({

        total:
          bookings.length,

        reserved:
          bookings.filter(
            (item) =>
              item.status ===
              'reserved'
          ).length,

        checkedIn:
          bookings.filter(
            (item) =>
              item.status ===
              'checked-in'
          ).length,

        checkedOut:
          bookings.filter(
            (item) =>
              item.status ===
              'checked-out'
          ).length

      }),
      [bookings]
    );


  return (
    <>

      <PageHead
        eyebrow="RESERVATION & FRONT DESK"
        title="Reservations"
        description="Create bookings, allocate rooms, check guests in and out, issue keys and generate billing automatically."
        action={openCreate}
        actionLabel="New reservation"
      />


      {error && (
        <div className="notice error">
          <span>{error}</span>
        </div>
      )}


      {notice && (
        <div className="notice success">
          <span>{notice}</span>
        </div>
      )}


      <div className="reservation-stats">

        <div className="stat-card">

          <div className="stat-top">
            <span>
              Total bookings
            </span>

            <div className="stat-icon">
              <CalendarDays size={18} />
            </div>
          </div>

          <strong>
            {loading
              ? '—'
              : counts.total}
          </strong>

          <small>
            All reservations
          </small>

        </div>


        <div className="stat-card">

          <div className="stat-top">
            <span>
              Upcoming
            </span>

            <div className="stat-icon">
              <Clock3 size={18} />
            </div>
          </div>

          <strong>
            {loading
              ? '—'
              : counts.reserved}
          </strong>

          <small>
            Awaiting check-in
          </small>

        </div>


        <div className="stat-card">

          <div className="stat-top">
            <span>
              In house
            </span>

            <div className="stat-icon">
              <DoorOpen size={18} />
            </div>
          </div>

          <strong>
            {loading
              ? '—'
              : counts.checkedIn}
          </strong>

          <small>
            Currently checked in
          </small>

        </div>


        <div className="stat-card">

          <div className="stat-top">
            <span>
              Completed
            </span>

            <div className="stat-icon">
              <CheckCircle2 size={18} />
            </div>
          </div>

          <strong>
            {loading
              ? '—'
              : counts.checkedOut}
          </strong>

          <small>
            Checked out stays
          </small>

        </div>

      </div>


      <section className="card reservation-panel">

        <div className="reservation-toolbar">

          <div className="staff-search reservation-search">

            <Search size={16} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search guest, room or booking..."
            />

          </div>


          <div className="reservation-filters">

            {[
              ['all', 'All'],
              ['online', 'Online'],
              ['reserved', 'Reserved'],
              ['checked-in', 'Checked in'],
              ['checked-out', 'Checked out'],
              ['cancelled', 'Cancelled']
            ].map(
              ([key, label]) => (

                <button
                  key={key}
                  type="button"
                  className={`btn secondary ${
                    filter === key
                      ? 'active'
                      : ''
                  }`}
                  onClick={() =>
                    setFilter(key)
                  }
                >
                  {label}
                </button>

              )
            )}

          </div>

        </div>


        <div className="reservation-table-wrap">

          <table className="reservation-table">

            <thead>

              <tr>

                <th>
                  Guest
                </th>

                <th>
                  Room
                </th>

                <th>
                  Stay
                </th>

                <th>
                  Channel
                </th>

                <th>
                  Status
                </th>

                <th>
                  Billing
                </th>

                <th>
                  Front desk
                </th>

                <th>
                  Actions
                </th>

              </tr>

            </thead>


            <tbody>

              {filtered.map(
                (booking) => (

                  <tr
                    key={
                      booking._id
                    }
                  >

                    <td>

                      <div className="table-person">

                        <div className="guest-avatar">

                          {(booking.guest?.name || 'G')
                            .split(' ')
                            .map(
                              (part) =>
                                part[0]
                            )
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}

                        </div>


                        <span>

                          <b>
                            {
                              booking.guest?.name ||
                              'Guest'
                            }
                          </b>

                          <small>
                            {
                              booking.guest?.email ||
                              'No email'
                            }
                          </small>

                        </span>

                      </div>

                    </td>


                    <td>

                      <b>
                        Room {
                          booking.room?.number ||
                          '—'
                        }
                      </b>

                      <small className="table-subtext">
                        {
                          booking.room?.type ||
                          'Room'
                        }
                      </small>

                    </td>


                    <td>

                      <b>
                        {
                          formatDate(
                            booking.checkIn
                          )
                        }
                      </b>

                      <small className="table-subtext">
                        to {
                          formatDate(
                            booking.checkOut
                          )
                        }
                      </small>

                    </td>


                    <td>
                      <Status>
                        {
                          booking.source === 'online'
                            ? 'Online reservation'
                            : 'Front desk'
                        }
                      </Status>
                    </td>


                    <td>
                      <Status>
                        {
                          booking.status
                        }
                      </Status>
                    </td>


                    <td>

                      <b>
                        {
                          money(
                            booking.totalPrice
                          )
                        }
                      </b>

                      <small className="table-subtext">

                        {
                          booking.invoice
                            ? booking.invoice.paid
                              ? 'Paid'
                              : 'Invoice issued'
                            : 'Not invoiced'
                        }

                      </small>

                    </td>


                    <td>

                      {
                        booking.keyIssued
                          ? (
                            <span className="key-issued">

                              <span>
                                KEY
                              </span>

                              {
                                booking.keyCode
                              }

                            </span>
                          )
                          : (
                            <span className="table-subtext">
                              Not issued
                            </span>
                          )
                      }

                    </td>


                    <td>

                      <div className="reservation-actions">

                        <button
                          className="btn tiny secondary"
                          type="button"
                          onClick={() =>
                            openDetails(
                              booking
                            )
                          }
                        >
                          View
                        </button>


                        {(booking.status === 'reserved' ||
                          booking.status === 'checked-in') &&
                          canUseGuestServices && (

                          <button
                            className="btn tiny secondary"
                            type="button"
                            onClick={() =>
                              openDetails(
                                booking
                              )
                            }
                          >
                            <ConciergeBell size={13} />
                            Services
                          </button>

                        )}


                        {booking.status ===
                          'reserved' && (

                          <button
                            className="btn tiny primary"
                            type="button"
                            disabled={
                              actionId ===
                              `${booking._id}:check-in`
                            }
                            onClick={() =>
                              runAction(
                                booking,
                                'check-in'
                              )
                            }
                          >
                            <LogIn size={13} />
                            Check in
                          </button>

                        )}


                        {booking.status ===
                          'checked-in' && (

                          <button
                            className="btn tiny primary"
                            type="button"
                            disabled={
                              actionId ===
                              `${booking._id}:check-out`
                            }
                            onClick={() =>
                              runAction(
                                booking,
                                'check-out'
                              )
                            }
                          >
                            <LogOut size={13} />
                            Check out
                          </button>

                        )}

                      </div>

                    </td>

                  </tr>

                )
              )}


              {!loading &&
                filtered.length === 0 && (

                  <tr>

                    <td
                      colSpan="8"
                      className="table-message"
                    >
                      No reservations match your current filters.
                    </td>

                  </tr>

                )}

            </tbody>

          </table>

        </div>

      </section>


      <div className="reservation-footer-card">

        <div>

          <CircleDollarSign size={18} />

          <div>

            <b>
              Guest online booking
            </b>

            <span>
              Guests can submit a reservation without an admin login.
            </span>

          </div>

        </div>


        <button
          type="button"
          className="btn secondary"
          onClick={() =>
            window.open(
              '/book',
              '_blank'
            )
          }
        >
          Open booking page
          <ExternalLink size={14} />
        </button>

      </div>


      {modal && (

        <div
          className="modal-backdrop"
          onClick={closeCreate}
        >

          <div
            className="modal-card reservation-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <div className="eyebrow">
                  NEW RESERVATION
                </div>

                <h3>
                  Book a room
                </h3>

              </div>


              <button
                type="button"
                className="close-btn"
                onClick={closeCreate}
              >
                <X size={18} />
              </button>

            </div>


            <form
              onSubmit={createBooking}
              className="form-grid"
            >

              <label>

                Guest profile

                <select
                  value={form.guest}
                  onChange={(event) =>
                    updateForm(
                      'guest',
                      event.target.value
                    )
                  }
                >

                  <option value="">
                    Select guest
                  </option>

                  {guests.map(
                    (guest) => (

                      <option
                        key={guest._id}
                        value={guest._id}
                      >
                        {
                          guest.name
                        }
                        {' · '}
                        {
                          guest.email ||
                          'No email'
                        }
                      </option>

                    )
                  )}

                </select>

              </label>


              <label>

                Room

                <select
                  value={form.room}
                  onChange={(event) =>
                    updateForm(
                      'room',
                      event.target.value
                    )
                  }
                >

                  <option value="">
                    Select available room
                  </option>

                  {rooms
                    .filter(
                      (room) =>
                        room.availableForBooking !== false &&
                        room.status !== 'maintenance' &&
                        room.status !== 'cleaning'
                    )
                    .map(
                      (room) => (

                        <option
                          key={room._id}
                          value={room._id}
                        >
                          Room {
                            room.number
                          }
                          {' · '}
                          {
                            room.type
                          }
                          {' · '}
                          {
                            money(
                              room.price
                            )
                          }
                          /night
                        </option>

                      )
                    )}

                </select>

              </label>


              <label>

                Check-in

                <input
                  type="date"
                  min={today()}
                  value={form.checkIn}
                  onChange={(event) =>
                    updateForm(
                      'checkIn',
                      event.target.value
                    )
                  }
                />

              </label>


              <label>

                Check-out

                <input
                  type="date"
                  min={
                    form.checkIn ||
                    today()
                  }
                  value={form.checkOut}
                  onChange={(event) =>
                    updateForm(
                      'checkOut',
                      event.target.value
                    )
                  }
                />

              </label>


              <div className="reservation-helper wide">

                <CalendarDays size={15} />

                <span>
                  Only rooms free for the selected dates are offered. Maintenance and cleaning rooms are excluded automatically.
                </span>

              </div>


              <div className="form-actions wide">

                <button
                  type="button"
                  className="btn secondary"
                  onClick={closeCreate}
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="btn primary"
                  disabled={saving}
                >

                  <Plus size={15} />

                  {
                    saving
                      ? 'Creating...'
                      : 'Create reservation'
                  }

                </button>

              </div>

            </form>

          </div>

        </div>

      )}


      {details && (

        <div
          className="modal-backdrop"
          onClick={() =>
            setDetails(null)
          }
        >

          <div
            className="modal-card reservation-detail-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <div className="eyebrow">
                  RESERVATION DETAILS
                </div>

                <h3>
                  {
                    details.guest?.name ||
                    'Guest'
                  }
                  {' · '}
                  Room {
                    details.room?.number ||
                    '—'
                  }
                </h3>

              </div>


              <button
                type="button"
                className="close-btn"
                onClick={() =>
                  setDetails(null)
                }
              >
                <X size={18} />
              </button>

            </div>


            <div className="reservation-detail-grid">

              <div>
                <span>
                  Stay
                </span>

                <b>
                  {
                    formatDate(
                      details.checkIn
                    )
                  }
                  {' → '}
                  {
                    formatDate(
                      details.checkOut
                    )
                  }
                </b>
              </div>


              <div>

                <span>
                  Channel
                </span>

                <Status>
                  {
                    details.source === 'online'
                      ? 'Online reservation'
                      : 'Front desk'
                  }
                </Status>

              </div>


              <div>

                <span>
                  Status
                </span>

                <Status>
                  {
                    details.status
                  }
                </Status>

              </div>


              <div>

                <span>
                  Room rate
                </span>

                <b>
                  {
                    money(
                      details.room?.price
                    )
                  }
                  /night
                </b>

              </div>


              <div>

                <span>
                  Total
                </span>

                <b>
                  {
                    money(
                      details.totalPrice
                    )
                  }
                </b>

              </div>


              <div>

                <span>
                  Key
                </span>

                <b>
                  {
                    details.keyIssued
                      ? `Issued · ${details.keyCode}`
                      : 'Not issued yet'
                  }
                </b>

              </div>


              <div>

                <span>
                  Invoice
                </span>

                <b>
                  {
                    details.invoice
                      ? details.invoice.paid
                        ? 'Paid'
                        : 'Issued · unpaid'
                      : 'Not generated'
                  }
                </b>

              </div>

            </div>


            {canUseGuestServices && (
              <div className="reservation-service-box">
                <div>
                  <b>Guest services</b>
                  <span>
                    {details.status === 'checked-out' || details.status === 'cancelled'
                      ? 'Services on closed reservations are shown for billing history only.'
                      : 'Add breakfast, laundry and other catalogue services. They are billed on the final invoice.'}
                  </span>
                </div>

                {details.status !== 'checked-out' && details.status !== 'cancelled' && (
                  <div className="reservation-service-controls">
                    <select
                      value={serviceId}
                      onChange={(event) => setServiceId(event.target.value)}
                      disabled={serviceBusy || serviceCatalog.length === 0}
                    >
                      <option value="">
                        {serviceCatalog.length === 0 ? 'No services in the catalogue' : 'Select service'}
                      </option>
                      {serviceCatalog.map((service) => (
                        <option key={service._id} value={service._id}>
                          {service.name} · {money(service.price)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={serviceQty}
                      onChange={(event) => setServiceQty(event.target.value)}
                      aria-label="Service quantity"
                      disabled={serviceBusy}
                    />
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={addService}
                      disabled={serviceBusy || !serviceId}
                    >
                      <Plus size={15} />
                      Add
                    </button>
                  </div>
                )}

                {details.services?.length > 0 ? (
                  <div className="reservation-service-list">
                    <b>Services on this stay</b>
                    {details.services.map((service, index) => (
                      <div className="reservation-service-row" key={service._id || `${service.name}-${index}`}>
                        <span>{service.name}</span>
                        {details.status !== 'checked-out' && details.status !== 'cancelled' ? (
                          <div className="reservation-service-qty">
                            <button
                              type="button"
                              className="btn tiny secondary"
                              disabled={serviceBusy || Number(service.quantity || 1) <= 1}
                              onClick={() => updateServiceQty(service, Number(service.quantity || 1) - 1)}
                              aria-label={`Decrease ${service.name}`}
                            >
                              <Minus size={12} />
                            </button>
                            <b>{service.quantity || 1}</b>
                            <button
                              type="button"
                              className="btn tiny secondary"
                              disabled={serviceBusy}
                              onClick={() => updateServiceQty(service, Number(service.quantity || 1) + 1)}
                              aria-label={`Increase ${service.name}`}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        ) : (
                          <span>× {service.quantity || 1}</span>
                        )}
                        <b>{money(Number(service.price || 0) * Number(service.quantity || 1))}</b>
                        {details.status !== 'checked-out' && details.status !== 'cancelled' && (
                          <button
                            type="button"
                            className="btn tiny secondary"
                            disabled={serviceBusy}
                            onClick={() => removeService(service)}
                            aria-label={`Remove ${service.name}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No extra services on this reservation yet.</p>
                )}
              </div>
            )}


            <div className="reservation-detail-actions">

              {details.status ===
                'reserved' && (

                <button
                  className="btn primary"
                  type="button"
                  onClick={() =>
                    runAction(
                      details,
                      'check-in'
                    )
                  }
                  disabled={
                    !!actionId
                  }
                >
                  <LogIn size={15} />
                  Check in & issue key
                </button>

              )}


              {details.status ===
                'checked-in' && (

                <button
                  className="btn primary"
                  type="button"
                  onClick={() =>
                    runAction(
                      details,
                      'check-out'
                    )
                  }
                  disabled={
                    !!actionId
                  }
                >
                  <LogOut size={15} />
                  Check out & create invoice
                </button>

              )}


              {details.status ===
                'reserved' && (

                <button
                  className="btn secondary"
                  type="button"
                  onClick={() =>
                    runAction(
                      details,
                      'cancel'
                    )
                  }
                  disabled={
                    !!actionId
                  }
                >
                  Cancel reservation
                </button>

              )}


              {details.invoice && (

                <span className="invoice-note">

                  <FileText size={14} />

                  Invoice linked to billing

                </span>

              )}

            </div>

          </div>

        </div>

      )}

    </>
  );
}