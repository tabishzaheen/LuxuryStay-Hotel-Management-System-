import {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  CalendarDays,
  CheckCircle2,
  Hotel,
  LoaderCircle,
  Mail,
  Phone,
  UserRound
} from 'lucide-react';

import { api } from '../services/api';


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


const money = (value) =>
  `$${Number(
    value || 0
  ).toLocaleString()}`;


export default function OnlineBooking() {

  const [form, setForm] =
    useState({

      guestName: '',
      guestEmail: '',
      guestPhone: '',
      guestIdNumber: '',
      guestPassword: '',
      room: '',
      checkIn: today(),
      checkOut: tomorrow()

    });


  const [rooms, setRooms] =
    useState([]);

  const [loadingRooms, setLoadingRooms] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState('');

  const [confirmation, setConfirmation] =
    useState(null);


  const loadRooms = async () => {

    if (
      !form.checkIn ||
      !form.checkOut ||
      form.checkIn >= form.checkOut
    ) {

      setRooms([]);

      return;

    }


    try {

      setLoadingRooms(true);
      setError('');


      const data =
        await api(
          `/bookings/availability?checkIn=${encodeURIComponent(
            form.checkIn
          )}&checkOut=${encodeURIComponent(
            form.checkOut
          )}`
        );


      setRooms(
        (
          Array.isArray(data)
            ? data
            : []
        ).filter(
          (room) =>
            room.availableForBooking
        )
      );

    } catch (err) {

      setError(
        err.message
      );

    } finally {

      setLoadingRooms(false);

    }

  };


  useEffect(() => {

    loadRooms();

  // loadRooms is intentionally kept local because it also updates loading/error state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.checkIn,
    form.checkOut
  ]);


  const selectedRoom =
    useMemo(
      () =>
        rooms.find(
          (room) =>
            room._id ===
            form.room
        ),

      [
        rooms,
        form.room
      ]
    );


  const nights =
    Math.max(
      1,
      Math.ceil(
        (
          new Date(form.checkOut) -
          new Date(form.checkIn)
        ) /
        (1000 * 60 * 60 * 24)
      )
    );


  const total =
    selectedRoom
      ? nights *
        Number(
          selectedRoom.price ||
          0
        )
      : 0;


  const update =
    (
      key,
      value
    ) => {

      setForm(
        (current) => ({
          ...current,

          [key]:
            value,

          ...(
            key === 'checkIn' ||
            key === 'checkOut'
              ? {
                  room: ''
                }
              : {}
          )

        })
      );

    };


  const submit =
    async (event) => {

      event.preventDefault();

      setSubmitting(true);

      setError('');


      try {

        if (
          !form.guestName.trim()
        ) {
          throw new Error(
            'Full name is required.'
          );
        }


        if (
          !form.guestEmail.trim()
        ) {
          throw new Error(
            'Email is required.'
          );
        }

        if (!form.guestIdNumber.trim()) {
          throw new Error('Passport / ID number is required.');
        }

        if (form.guestPassword.length < 6) {
          throw new Error('Guest portal password must be at least 6 characters.');
        }


        if (!form.room) {
          throw new Error(
            'Please choose an available room.'
          );
        }


        const data =
          await api(
            '/bookings/public',
            {
              method: 'POST',

              body:
                JSON.stringify(form)
            }
          );


        setConfirmation(
          data.booking
        );

      } catch (err) {

        setError(
          err.message
        );

        await loadRooms();

      } finally {

        setSubmitting(false);

      }

    };


  if (confirmation) {

    return (

      <div className="public-booking-page">

        <div className="public-booking-card confirmation-card">

          <div className="confirmation-icon">
            <CheckCircle2 size={34} />
          </div>


          <div className="eyebrow">
            RESERVATION CONFIRMED
          </div>


          <h1>
            Your stay is booked.
          </h1>


          <p>
            We have reserved the room below and created your guest portal account automatically. Sign in with your email, password and passport / ID number.
          </p>


          <div className="confirmation-summary">

            <div>
              <span>
                Guest
              </span>

              <b>
                {
                  confirmation.guest?.name
                }
              </b>
            </div>


            <div>
              <span>
                Room
              </span>

              <b>
                {
                  confirmation.room?.number
                }
                {' · '}
                {
                  confirmation.room?.type
                }
              </b>
            </div>


            <div>
              <span>
                Check-in
              </span>

              <b>
                {
                  new Date(
                    confirmation.checkIn
                  ).toLocaleDateString()
                }
              </b>
            </div>


            <div>
              <span>
                Check-out
              </span>

              <b>
                {
                  new Date(
                    confirmation.checkOut
                  ).toLocaleDateString()
                }
              </b>
            </div>


            <div>
              <span>
                Total
              </span>

              <b>
                {
                  money(
                    confirmation.totalPrice
                  )
                }
              </b>
            </div>


            <div>
              <span>
                Reservation number
              </span>

              <b>
                {
                  confirmation.bookingNumber ||
                  confirmation._id
                    .slice(-8)
                    .toUpperCase()
                }
              </b>
            </div>


            <div>
              <span>
                Channel
              </span>

              <b>
                Online reservation
              </b>
            </div>

          </div>


          <button
            type="button"
            className="btn primary"
            onClick={() =>
              window.location.reload()
            }
          >
            Make another reservation
          </button>

        </div>

      </div>

    );

  }


  return (

    <div className="public-booking-page">

      <div className="public-booking-shell">

        <div className="public-booking-brand">

          <div className="brand-mark">
            LS
          </div>

          <div>

            <strong>
              LuxuryStay
            </strong>

            <span>
              Hospitality Group
            </span>

          </div>

        </div>


        <div className="public-booking-layout">

          <section className="public-booking-intro">

            <div className="eyebrow">
              ONLINE RESERVATIONS
            </div>


            <h1>
              Reserve your stay with LuxuryStay.
            </h1>


            <p>
              Choose your dates, select an available room and confirm your reservation in a few simple steps.
            </p>


            <div className="booking-benefits">

              <span>
                <CheckCircle2 size={15} />
                Live room availability
              </span>

              <span>
                <CheckCircle2 size={15} />
                Instant reservation confirmation
              </span>

              <span>
                <CheckCircle2 size={15} />
                Guest profile created automatically
              </span>

            </div>

          </section>


          <section className="public-booking-card">

            <div className="modal-header">

              <div>

                <div className="eyebrow">
                  BOOK A ROOM
                </div>

                <h2>
                  Reservation details
                </h2>

              </div>

            </div>


            {error && (
              <div className="notice error">
                <span>
                  {error}
                </span>
              </div>
            )}


            <form
              onSubmit={submit}
              className="public-booking-form"
            >

              <label>

                <span>
                  <UserRound size={14} />
                  Full name
                </span>

                <input
                  value={
                    form.guestName
                  }
                  onChange={(event) =>
                    update(
                      'guestName',
                      event.target.value
                    )
                  }
                  placeholder="Your full name"
                />

              </label>


              <label>

                <span>
                  <Mail size={14} />
                  Email
                </span>

                <input
                  type="email"
                  value={
                    form.guestEmail
                  }
                  onChange={(event) =>
                    update(
                      'guestEmail',
                      event.target.value
                    )
                  }
                  placeholder="you@example.com"
                />

              </label>


              <label>

                <span>
                  <Phone size={14} />
                  Phone
                </span>

                <input
                  value={
                    form.guestPhone
                  }
                  onChange={(event) =>
                    update(
                      'guestPhone',
                      event.target.value
                    )
                  }
                  placeholder="Optional contact number"
                />

              </label>


              <label>

                <span>
                  Passport / ID number
                </span>

                <input
                  value={form.guestIdNumber}
                  onChange={(event) => update('guestIdNumber', event.target.value)}
                  placeholder="e.g. 123456789"
                  autoComplete="off"
                />

              </label>


              <label>

                <span>
                  Guest portal password
                </span>

                <input
                  type="password"
                  value={form.guestPassword}
                  onChange={(event) => update('guestPassword', event.target.value)}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                />

              </label>


              <label>

                <span>
                  <CalendarDays size={14} />
                  Check-in
                </span>

                <input
                  type="date"
                  min={today()}
                  value={
                    form.checkIn
                  }
                  onChange={(event) =>
                    update(
                      'checkIn',
                      event.target.value
                    )
                  }
                />

              </label>


              <label>

                <span>
                  <CalendarDays size={14} />
                  Check-out
                </span>

                <input
                  type="date"
                  min={
                    form.checkIn ||
                    today()
                  }
                  value={
                    form.checkOut
                  }
                  onChange={(event) =>
                    update(
                      'checkOut',
                      event.target.value
                    )
                  }
                />

              </label>


              <label className="wide">

                <span>
                  <Hotel size={14} />
                  Available room
                </span>


                <select
                  value={
                    form.room
                  }
                  onChange={(event) =>
                    update(
                      'room',
                      event.target.value
                    )
                  }
                  disabled={
                    loadingRooms
                  }
                >

                  <option value="">

                    {
                      loadingRooms
                        ? 'Checking availability...'
                        : rooms.length
                        ? 'Select a room'
                        : 'No rooms available for these dates'
                    }

                  </option>


                  {rooms.map(
                    (room) => (

                      <option
                        key={
                          room._id
                        }
                        value={
                          room._id
                        }
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


              {selectedRoom && (

                <div className="booking-total wide">

                  <span>
                    {nights} night
                    {
                      nights !== 1
                        ? 's'
                        : ''
                    }
                    {' · '}
                    Room {
                      selectedRoom.number
                    }
                  </span>


                  <b>
                    {
                      money(total)
                    }
                  </b>

                </div>

              )}


              <button
                type="submit"
                className="btn primary wide"
                disabled={
                  submitting ||
                  loadingRooms ||
                  !form.room
                }
              >

                {submitting ? (

                  <>
                    <LoaderCircle
                      size={15}
                      className="spin"
                    />

                    Confirming...
                  </>

                ) : (
                  'Confirm reservation'
                )}

              </button>

            </form>

          </section>

        </div>

      </div>

    </div>

  );

}