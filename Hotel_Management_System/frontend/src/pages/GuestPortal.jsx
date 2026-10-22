import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CalendarDays,
  Clock3,
  CheckCircle2,
  FileText,
  KeyRound,
  Mail,
  MessageSquareText,
  Printer,
  Send,
  UserRound,
  Wrench,
  ConciergeBell
} from 'lucide-react';

import { PageHead, Status } from '../components/UI';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const emptyFeedback = {
  booking: '',
  rating: '5',
  category: 'overall',
  comment: ''
};

const emptyService = { service: '', booking: '', quantity: '1', requestedFor: '', notes: '' };

const emptyIssue = {
  room: '',
  location: '',
  category: 'other',
  priority: 'normal',
  description: ''
};

const emptyPassword = { currentPassword: '', newPassword: '' };

const money = (value) => `$${Number(value || 0).toLocaleString()}`;

const invoiceNumber = (invoice) => `INV-${String(invoice?._id || '').slice(-6).toUpperCase()}`;

const dateText = (value) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
};

const pad = (value) => String(value).padStart(2, '0');

const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const today = () => isoDate(new Date());

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return isoDate(date);
};

const emptyStay = () => ({ room: '', checkIn: today(), checkOut: tomorrow() });

const nightsBetween = (checkIn, checkOut) => Math.max(
  1,
  Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))
);

const serviceTypeFromName = (name = '') => {
  const value = String(name).toLowerCase();
  if (value.includes('wake')) return 'wake-up-call';
  if (value.includes('transport') || value.includes('airport')) return 'transportation';
  if (value.includes('laundry')) return 'laundry';
  if (value.includes('house')) return 'housekeeping';
  if (value.includes('room')) return 'room-service';
  return 'other';
};

const escapeHtml = (value) => String(value || '').replaceAll('<', '&lt;');

function printInvoice(invoice) {
  if (!invoice) return;

  const booking = invoice.booking || {};
  const guest = booking.guest || {};
  const room = booking.room || {};
  const popup = window.open('', '_blank', 'width=850,height=900');

  if (!popup) {
    window.alert('Please allow pop-ups to print the invoice.');
    return;
  }

  const rows = (invoice.items || [])
    .map((item) => `
      <tr>
        <td>${escapeHtml(item.description)}</td>
        <td style="text-align:right">${money(item.amount)}</td>
      </tr>`)
    .join('');

  popup.document.write(`<!doctype html>
<html>
<head>
  <title>${invoiceNumber(invoice)}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:40px;color:#17231f}
    .head{display:flex;justify-content:space-between;border-bottom:2px solid #173d32;padding-bottom:18px}
    h1{margin:0;font-size:28px}.muted{color:#6e7b76}.box{margin:24px 0;padding:16px;background:#f4f6f3;border-radius:8px}
    table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left}th{background:#f4f6f3}
    .total{font-size:20px;font-weight:700;text-align:right;margin-top:20px}.footer{margin-top:40px;font-size:12px;color:#75817c}
  </style>
</head>
<body>
  <div class="head"><div><h1>LuxuryStay</h1><div class="muted">Hospitality Group</div></div><div><b>${invoiceNumber(invoice)}</b><div class="muted">Issued ${dateText(invoice.issuedAt)}</div></div></div>
  <div class="box"><b>Guest</b><br>${escapeHtml(guest.name || 'Guest')}<br>${escapeHtml(guest.email || '')}<br>${escapeHtml(guest.phone || '')}<br><br><b>Stay</b><br>Room ${escapeHtml(room.number || '—')} · ${escapeHtml(room.type || '')}<br>${dateText(booking.checkIn)} → ${dateText(booking.checkOut)}</div>
  <table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="total">Subtotal: ${money(invoice.subtotal ?? invoice.total)}<br>Tax (${Number(invoice.taxRate || 0)}%): ${money(invoice.tax || 0)}<br><strong>Total: ${money(invoice.total)}</strong></div>
  <div class="footer">Thank you for staying with LuxuryStay.</div>
  <script>window.onload=function(){window.print();}</script>
</body>
</html>`);
  popup.document.close();
}

function emailInvoice(invoice) {
  const booking = invoice.booking || {};
  const guest = booking.guest || {};
  if (!guest.email) {
    window.alert('This guest profile does not have an email address.');
    return;
  }

  const lines = (invoice.items || [])
    .map((item) => `${item.description}: ${money(item.amount)}`)
    .join('\n');

  const subject = encodeURIComponent(`LuxuryStay invoice ${invoiceNumber(invoice)}`);
  const body = encodeURIComponent(
    `Dear ${guest.name || 'Guest'},\n\nPlease find your LuxuryStay invoice details below.\n\n${lines}\n\nSubtotal: ${money(invoice.subtotal ?? invoice.total)}\nTax (${Number(invoice.taxRate || 0)}%): ${money(invoice.tax || 0)}\nTotal: ${money(invoice.total)}\nInvoice: ${invoiceNumber(invoice)}\n\nThank you,\nLuxuryStay Hospitality Group`
  );

  window.location.href = `mailto:${guest.email}?subject=${subject}&body=${body}`;
}

export default function GuestPortal() {
  const { user, updateUser } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [issues, setIssues] = useState([]);
  const [services, setServices] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: '',
    nationality: '',
    idNumber: '',
    address: '',
    preferences: ''
  });
  const [passwordForm, setPasswordForm] = useState(emptyPassword);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [feedbackForm, setFeedbackForm] = useState(emptyFeedback);
  const [issueForm, setIssueForm] = useState(emptyIssue);
  const [serviceForm, setServiceForm] = useState(emptyService);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [savingIssue, setSavingIssue] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [stayForm, setStayForm] = useState(emptyStay);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [savingStay, setSavingStay] = useState(false);
  const [stayError, setStayError] = useState('');

  const { pathname } = useLocation();
  const guestView = pathname === '/guest/services'
    ? 'services'
    : pathname === '/guest/feedback'
      ? 'feedback'
      : pathname === '/guest/maintenance'
        ? 'maintenance'
        : pathname === '/guest/profile'
          ? 'profile'
          : 'reservations';

  const loadData = async () => {
    try {
      setLoading(true); setError('');
      const [bookingData, feedbackData, issueData, serviceData, requestData, invoiceData, profileData] = await Promise.all([
        api('/bookings/mine'),
        api('/feedback/mine'),
        api('/maintenance/mine'),
        api('/services'),
        api('/service-requests/mine'),
        api('/invoices/mine'),
        api('/users/me')
      ]);
      setBookings(Array.isArray(bookingData) ? bookingData : []);
      setFeedback(Array.isArray(feedbackData) ? feedbackData : []);
      setIssues(Array.isArray(issueData) ? issueData : []);
      setServices(Array.isArray(serviceData) ? serviceData : []);
      setServiceRequests(Array.isArray(requestData) ? requestData : []);
      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
      if (profileData) {
        setProfile({
          name: profileData.name || '',
          phone: profileData.phone || '',
          nationality: profileData.nationality || '',
          idNumber: profileData.idNumber || '',
          address: profileData.address || '',
          preferences: profileData.preferences || ''
        });
      }
    } catch (err) { setError(err.message || 'Unable to load your guest portal.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [bookingData, feedbackData, issueData, serviceData, requestData, invoiceData, profileData] = await Promise.all([
          api('/bookings/mine'),
          api('/feedback/mine'),
          api('/maintenance/mine'),
          api('/services'),
          api('/service-requests/mine'),
          api('/invoices/mine'),
          api('/users/me')
        ]);
        if (cancelled) return;
        setBookings(Array.isArray(bookingData) ? bookingData : []);
        setFeedback(Array.isArray(feedbackData) ? feedbackData : []);
        setIssues(Array.isArray(issueData) ? issueData : []);
        setServices(Array.isArray(serviceData) ? serviceData : []);
        setServiceRequests(Array.isArray(requestData) ? requestData : []);
        setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
        if (profileData) {
          setProfile({
            name: profileData.name || '',
            phone: profileData.phone || '',
            nationality: profileData.nationality || '',
            idNumber: profileData.idNumber || '',
            address: profileData.address || '',
            preferences: profileData.preferences || ''
          });
        }
      } catch (err) { if (!cancelled) setError(err.message || 'Unable to load your guest portal.'); }
      finally { if (!cancelled) setLoading(false); }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!bookingOpen) return undefined;

    let cancelled = false;
    const loadRooms = async () => {
      if (!stayForm.checkIn || !stayForm.checkOut || stayForm.checkIn >= stayForm.checkOut) {
        setAvailableRooms([]);
        return;
      }

      try {
        setLoadingRooms(true);
        setStayError('');
        const data = await api(
          `/bookings/availability?checkIn=${encodeURIComponent(stayForm.checkIn)}&checkOut=${encodeURIComponent(stayForm.checkOut)}`
        );
        if (cancelled) return;
        const rooms = (Array.isArray(data) ? data : []).filter((room) => room.availableForBooking);
        setAvailableRooms(rooms);
        setStayForm((current) => (
          current.room && !rooms.some((room) => room._id === current.room)
            ? { ...current, room: '' }
            : current
        ));
      } catch (err) {
        if (!cancelled) {
          setAvailableRooms([]);
          setStayError(err.message || 'Unable to check room availability.');
        }
      } finally {
        if (!cancelled) setLoadingRooms(false);
      }
    };

    loadRooms();
    return () => { cancelled = true; };
  }, [bookingOpen, stayForm.checkIn, stayForm.checkOut]);

  const reviewedBookingIds = useMemo(
    () => new Set(feedback.map((item) => item.booking?._id || item.booking).filter(Boolean)),
    [feedback]
  );

  const reviewableBookings = useMemo(
    () => bookings.filter((booking) => (
      ['checked-in', 'checked-out'].includes(booking.status) && !reviewedBookingIds.has(booking._id)
    )),
    [bookings, reviewedBookingIds]
  );

  const activeStays = useMemo(
    () => bookings.filter((booking) => ['reserved', 'checked-in'].includes(booking.status)),
    [bookings]
  );

  const selectedStayRoom = useMemo(
    () => availableRooms.find((room) => room._id === stayForm.room),
    [availableRooms, stayForm.room]
  );

  const stayNights = nightsBetween(stayForm.checkIn, stayForm.checkOut);
  const stayTotal = selectedStayRoom ? stayNights * Number(selectedStayRoom.price || 0) : 0;

  const invoiceForBooking = (booking) => {
    if (!booking) return null;
    if (booking.invoice && typeof booking.invoice === 'object' && booking.invoice.items) {
      return {
        ...booking.invoice,
        booking
      };
    }
    return invoices.find((invoice) => (
      invoice.booking?._id === booking._id || invoice.booking === booking._id
    )) || null;
  };

  const pageMeta = {
    reservations: {
      eyebrow: 'GUEST PORTAL',
      title: 'My reservations',
      description: 'Review your stays, room details, keys and invoices in one private portal.'
    },
    services: {
      eyebrow: 'GUEST SERVICES',
      title: 'Request a guest service',
      description: 'Request room service, wake-up calls, transportation and other hotel services.'
    },
    feedback: {
      eyebrow: 'GUEST EXPERIENCE',
      title: 'Share feedback',
      description: 'Tell LuxuryStay about your stay and help us improve the guest experience.'
    },
    maintenance: {
      eyebrow: 'GUEST SUPPORT',
      title: 'Report maintenance',
      description: 'Report a room or facilities issue securely to the hotel team.'
    },
    profile: {
      eyebrow: 'GUEST PROFILE',
      title: 'My profile',
      description: 'Keep your contact details, identification and stay preferences up to date.'
    }
  }[guestView];

  const submitService = async (event) => {
    event.preventDefault();
    if (!serviceForm.service) return setError('Select a service.');
    if (!Number.isInteger(Number(serviceForm.quantity)) || Number(serviceForm.quantity) < 1) {
      return setError('Quantity must be a positive whole number.');
    }
    const selectedService = services.find((item) => item._id === serviceForm.service);
    try {
      setSavingService(true);
      setError('');
      setNotice('');
      await api('/service-requests', {
        method: 'POST',
        body: JSON.stringify({
          service: serviceForm.service,
          booking: serviceForm.booking || null,
          quantity: Number(serviceForm.quantity),
          requestedFor: serviceForm.requestedFor || null,
          notes: serviceForm.notes.trim(),
          serviceType: serviceTypeFromName(selectedService?.name)
        })
      });
      setServiceForm(emptyService);
      setNotice('Service requested successfully. The hotel team will update the request status here.');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingService(false);
    }
  };

  const submitFeedback = async (event) => {
    event.preventDefault();
    if (!feedbackForm.comment.trim()) return setError('Please add a comment.');
    try {
      setSavingFeedback(true);
      setError('');
      setNotice('');
      await api('/feedback', {
        method: 'POST',
        body: JSON.stringify({
          booking: feedbackForm.booking || null,
          rating: Number(feedbackForm.rating),
          category: feedbackForm.category,
          comment: feedbackForm.comment.trim()
        })
      });
      setFeedbackForm(emptyFeedback);
      setNotice('Thank you. Your feedback has been submitted.');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingFeedback(false);
    }
  };

  const submitIssue = async (event) => {
    event.preventDefault();
    if (!issueForm.room && !issueForm.location.trim()) return setError('Select a room or enter a location.');
    if (!issueForm.description.trim()) return setError('Issue description is required.');
    try {
      setSavingIssue(true);
      setError('');
      setNotice('');
      await api('/maintenance', {
        method: 'POST',
        body: JSON.stringify({
          room: issueForm.room || null,
          location: issueForm.location.trim(),
          category: issueForm.category,
          priority: issueForm.priority,
          description: issueForm.description.trim()
        })
      });
      setIssueForm(emptyIssue);
      setNotice('Maintenance issue reported successfully. You can track resolution on this page.');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingIssue(false);
    }
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    if (!profile.name.trim()) return setError('Name is required.');
    if (!profile.idNumber.trim()) return setError('Passport / ID number is required.');
    try {
      setSavingProfile(true);
      setError('');
      setNotice('');
      const updated = await api('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: profile.name.trim(),
          phone: profile.phone.trim(),
          nationality: profile.nationality.trim(),
          idNumber: profile.idNumber.trim(),
          address: profile.address.trim(),
          preferences: profile.preferences.trim()
        })
      });
      updateUser({
        name: updated.name,
        email: updated.email
      });
      setNotice('Your guest profile was updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    if (!passwordForm.currentPassword) return setError('Enter your current password.');
    if (passwordForm.newPassword.length < 6) return setError('New password must be at least 6 characters.');
    try {
      setSavingPassword(true);
      setError('');
      setNotice('');
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(passwordForm)
      });
      setPasswordForm(emptyPassword);
      setNotice('Password changed successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const openBookStay = () => {
    setStayForm(emptyStay());
    setAvailableRooms([]);
    setStayError('');
    setBookingOpen(true);
  };

  const submitStay = async (event) => {
    event.preventDefault();
    if (!stayForm.checkIn || !stayForm.checkOut || stayForm.checkIn >= stayForm.checkOut) {
      return setStayError('Check-out date must be after check-in.');
    }
    if (!stayForm.room) {
      return setStayError('Choose a room that is available for these dates.');
    }
    if (!selectedStayRoom) {
      return setStayError('That room is not available for the selected stay. Choose another room or dates.');
    }

    try {
      setSavingStay(true);
      setStayError('');
      setError('');
      setNotice('');
      await api('/bookings/mine', {
        method: 'POST',
        body: JSON.stringify({
          room: stayForm.room,
          checkIn: stayForm.checkIn,
          checkOut: stayForm.checkOut
        })
      });
      setBookingOpen(false);
      setStayForm(emptyStay());
      setNotice('Reservation confirmed. It now appears in your stay list and on the hotel reservations board.');
      await loadData();
    } catch (err) {
      setStayError(err.message || 'Unable to complete this reservation.');
    } finally {
      setSavingStay(false);
    }
  };

  const openInvoice = async (booking) => {
    const existing = invoiceForBooking(booking);
    if (existing?.items) {
      setSelectedInvoice(existing);
      return;
    }

    const invoiceId = booking.invoice?._id || booking.invoice;
    if (!invoiceId) {
      setError('No invoice has been generated for this stay yet.');
      return;
    }

    try {
      setError('');
      const invoice = await api(`/invoices/${invoiceId}`);
      setSelectedInvoice(invoice);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHead
        eyebrow={pageMeta.eyebrow}
        title={pageMeta.title}
        description={pageMeta.description}
      />

      {error && <div className="notice error"><span>{error}</span></div>}
      {notice && <div className="notice success"><span>{notice}</span></div>}
      {loading && <p className="muted">Loading your guest portal...</p>}

      {guestView === 'reservations' && (
        <>
          <div className="stats-grid compact">
            <div className="stat-card"><span>My reservations</span><strong>{loading ? '—' : bookings.length}</strong><small>Reservation history</small></div>
            <div className="stat-card"><span>Active stays</span><strong>{loading ? '—' : activeStays.length}</strong><small>Reserved or checked in</small></div>
            <div className="stat-card"><span>Invoices</span><strong>{loading ? '—' : invoices.length}</strong><small>Bills you can print</small></div>
            <div className="stat-card"><span>Service requests</span><strong>{loading ? '—' : serviceRequests.length}</strong><small>Guest services</small></div>
          </div>

          <section className="card guest-portal-section">
            <div className="card-head">
              <div><h3>My reservations</h3><span>Stay details, keys, extra services and invoices</span></div>
              <button type="button" className="btn secondary" onClick={openBookStay}>Book a stay</button>
            </div>
            {bookings.length === 0 ? (
              <div className="guest-empty">
                <p className="muted">No reservations are linked to your account yet.</p>
                <button type="button" className="btn primary" onClick={openBookStay}>Book a stay</button>
              </div>
            ) : (
              <div className="guest-stay-list">
                {bookings.map((booking) => {
                  const invoice = invoiceForBooking(booking);
                  return (
                    <article className="guest-stay-card" key={booking._id}>
                      <div className="guest-stay-top">
                        <div>
                          <b>Room {booking.room?.number || '—'}</b>
                          <span>{booking.room?.type || 'Room'} · {nightsBetween(booking.checkIn, booking.checkOut)} night(s)</span>
                        </div>
                        <Status>{booking.status}</Status>
                      </div>
                      <div className="guest-stay-meta">
                        <div><span>Stay</span><b>{dateText(booking.checkIn)} → {dateText(booking.checkOut)}</b></div>
                        <div><span>Room total</span><b>{money(booking.totalPrice)}</b></div>
                        <div><span>Channel</span><b>{booking.source === 'online' ? 'Online reservation' : 'Front desk'}</b></div>
                        <div><span>Key</span><b>{booking.keyIssued ? booking.keyCode || 'Issued' : 'Not issued yet'}</b></div>
                      </div>
                      {(booking.services || []).length > 0 && (
                        <div className="guest-stay-services">
                          <span>Extra services on this stay</span>
                          {(booking.services || []).map((service, index) => (
                            <div key={service._id || `${service.name}-${index}`}>
                              <b>{service.name} × {service.quantity || 1}</b>
                              <small>{money(Number(service.price || 0) * Number(service.quantity || 1))}</small>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="guest-stay-actions">
                        {invoice || booking.invoice ? (
                          <>
                            <button type="button" className="btn tiny secondary" onClick={() => openInvoice(booking)}>
                              <FileText size={14} /> View invoice
                            </button>
                            {invoice?.items && (
                              <>
                                <button type="button" className="btn tiny secondary" onClick={() => printInvoice(invoice)}>
                                  <Printer size={14} /> Print
                                </button>
                                <button type="button" className="btn tiny secondary" onClick={() => emailInvoice(invoice)}>
                                  <Mail size={14} /> Email
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <span className="muted">Invoice will appear after checkout.</span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card guest-portal-section">
            <div className="card-head">
              <div><h3>My invoices</h3><span>Detailed charges for room rate, tax and extra services</span></div>
              <FileText size={18} />
            </div>
            {invoices.length === 0 ? <p className="muted">No invoices have been issued to your account yet.</p> : (
              <div className="guest-portal-list">
                {invoices.map((invoice) => (
                  <div className="guest-portal-row" key={invoice._id}>
                    <div>
                      <b>{invoiceNumber(invoice)}</b>
                      <span>Room {invoice.booking?.room?.number || '—'} · {dateText(invoice.issuedAt)}</span>
                    </div>
                    <div>
                      <b>{money(invoice.total)}</b>
                      <span>{invoice.paid ? 'Paid' : 'Unpaid'}</span>
                    </div>
                    <button type="button" className="btn tiny secondary" onClick={() => setSelectedInvoice(invoice)}>View</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {guestView === 'services' && (
        <>
          <section className="card guest-portal-section">
            <div className="card-head"><div><h3>Request a guest service</h3><span>Room service, wake-up calls, transportation, laundry and more</span></div><ConciergeBell size={18} /></div>
            {activeStays.length === 0 && <p className="muted">You can still send a request. Linking it to an active stay helps the team deliver it to the right room.</p>}
            <form className="form-grid" onSubmit={submitService}>
              <label>Service
                <select value={serviceForm.service} onChange={(e) => setServiceForm((c) => ({ ...c, service: e.target.value }))}>
                  <option value="">Select a service</option>
                  {services.map((service) => <option key={service._id} value={service._id}>{service.name} · {money(service.price)}</option>)}
                </select>
              </label>
              <label>Stay
                <select value={serviceForm.booking} onChange={(e) => setServiceForm((c) => ({ ...c, booking: e.target.value }))}>
                  <option value="">No specific reservation</option>
                  {activeStays.map((booking) => (
                    <option key={booking._id} value={booking._id}>
                      Room {booking.room?.number || '—'} · {dateText(booking.checkIn)}
                    </option>
                  ))}
                </select>
              </label>
              <label>Quantity<input type="number" min="1" value={serviceForm.quantity} onChange={(e) => setServiceForm((c) => ({ ...c, quantity: e.target.value }))} /></label>
              <label>Requested for<input type="datetime-local" value={serviceForm.requestedFor} onChange={(e) => setServiceForm((c) => ({ ...c, requestedFor: e.target.value }))} /></label>
              <label className="wide">Notes<textarea value={serviceForm.notes} onChange={(e) => setServiceForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Any special instructions..." /></label>
              <div className="form-actions"><button className="btn primary" disabled={savingService}><Send size={15}/>{savingService ? 'Requesting...' : 'Request service'}</button></div>
            </form>
          </section>

          <section className="card guest-portal-section">
            <div className="card-head"><div><h3>My service requests</h3><span>Track whether the hotel has confirmed, started or completed your request</span></div><Clock3 size={18}/></div>
            {serviceRequests.length === 0 ? <p className="muted">No service requests yet.</p> : (
              <div className="guest-portal-list">
                {serviceRequests.map((request) => (
                  <div className="guest-portal-row" key={request._id}>
                    <div>
                      <b>{request.serviceName}</b>
                      <span>{request.notes || 'No special instructions'}{request.requestedFor ? ` · For ${dateText(request.requestedFor)}` : ''}</span>
                    </div>
                    <div>
                      <b>{request.room ? `Room ${request.room.number}` : 'Guest service'}</b>
                      <span>{money(Number(request.price || 0) * Number(request.quantity || 1))} · qty {request.quantity || 1}</span>
                    </div>
                    <Status>{request.status}</Status>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {guestView === 'feedback' && (
        <>
          <section className="card guest-portal-section">
            <div className="card-head"><div><h3>Share feedback</h3><span>Rate your stay after check-in. Staff use this to improve service.</span></div><MessageSquareText size={18} /></div>
            <form className="form-grid" onSubmit={submitFeedback}>
              <label>Stay
                <select value={feedbackForm.booking} onChange={(event) => setFeedbackForm((current) => ({ ...current, booking: event.target.value }))}>
                  <option value="">General feedback</option>
                  {reviewableBookings.map((booking) => <option key={booking._id} value={booking._id}>Room {booking.room?.number || '—'} · {dateText(booking.checkIn)}</option>)}
                </select>
              </label>
              <label>Rating
                <select value={feedbackForm.rating} onChange={(event) => setFeedbackForm((current) => ({ ...current, rating: event.target.value }))}>
                  <option value="5">5 — Excellent</option>
                  <option value="4">4 — Very good</option>
                  <option value="3">3 — Good</option>
                  <option value="2">2 — Needs improvement</option>
                  <option value="1">1 — Poor</option>
                </select>
              </label>
              <label>Category
                <select value={feedbackForm.category} onChange={(event) => setFeedbackForm((current) => ({ ...current, category: event.target.value }))}>
                  <option value="overall">Overall</option>
                  <option value="room">Room</option>
                  <option value="service">Service</option>
                  <option value="food">Food</option>
                  <option value="cleanliness">Cleanliness</option>
                  <option value="staff">Staff</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="wide">Comment<textarea value={feedbackForm.comment} onChange={(event) => setFeedbackForm((current) => ({ ...current, comment: event.target.value }))} placeholder="Tell us about your experience..." maxLength={2000} /></label>
              <div className="form-actions"><button className="btn primary" disabled={savingFeedback}><Send size={15} />{savingFeedback ? 'Sending...' : 'Submit feedback'}</button></div>
            </form>
          </section>

          <section className="card guest-portal-section">
            <div className="card-head"><div><h3>My feedback</h3><span>Your submitted reviews and ratings</span></div><MessageSquareText size={18} /></div>
            {feedback.length === 0 ? <p className="muted">No feedback submitted yet.</p> : (
              <div className="guest-portal-list">
                {feedback.map((item) => (
                  <div className="guest-portal-row" key={item._id}>
                    <div>
                      <b>{item.category || 'Overall'}</b>
                      <span>{item.comment || 'No comment'}{item.booking?.room ? ` · Room ${item.booking.room.number}` : ''}</span>
                    </div>
                    <div>
                      <b>{item.rating}/5</b>
                      <span>{dateText(item.createdAt)}</span>
                    </div>
                    <Status>submitted</Status>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {guestView === 'maintenance' && (
        <>
          <section className="card guest-portal-section">
            <div className="card-head"><div><h3>Report maintenance</h3><span>Send a facilities issue directly to the hotel team and track its status</span></div><Wrench size={18} /></div>
            <form className="form-grid" onSubmit={submitIssue}>
              <label>Room
                <select value={issueForm.room} onChange={(event) => setIssueForm((current) => ({ ...current, room: event.target.value }))}>
                  <option value="">Select room (optional)</option>
                  {bookings.map((booking) => booking.room && <option key={`${booking._id}-${booking.room._id}`} value={booking.room._id}>Room {booking.room.number} · {booking.room.type}</option>)}
                </select>
              </label>
              <label>Location<input value={issueForm.location} onChange={(event) => setIssueForm((current) => ({ ...current, location: event.target.value }))} placeholder="e.g. Bathroom" /></label>
              <label>Category
                <select value={issueForm.category} onChange={(event) => setIssueForm((current) => ({ ...current, category: event.target.value }))}>
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical">Electrical</option>
                  <option value="hvac">HVAC</option>
                  <option value="appliance">Appliance</option>
                  <option value="internet">Internet</option>
                  <option value="furniture">Furniture</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>Priority
                <select value={issueForm.priority} onChange={(event) => setIssueForm((current) => ({ ...current, priority: event.target.value }))}>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className="wide">Description<textarea value={issueForm.description} onChange={(event) => setIssueForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the issue clearly..." /></label>
              <div className="form-actions"><button className="btn primary" disabled={savingIssue}><Wrench size={15} />{savingIssue ? 'Reporting...' : 'Report issue'}</button></div>
            </form>
          </section>

          <section className="card guest-portal-section">
            <div className="card-head"><div><h3>My maintenance reports</h3><span>Track whether the issue is reported, in progress or resolved</span></div><CheckCircle2 size={18} /></div>
            {issues.length === 0 ? <p className="muted">You have not reported any maintenance issues.</p> : (
              <div className="guest-portal-list">
                {issues.map((issue) => (
                  <div className="guest-portal-row" key={issue._id}>
                    <div>
                      <b>{issue.category}</b>
                      <span>{issue.description}</span>
                    </div>
                    <div>
                      <b>{issue.room ? `Room ${issue.room.number}` : issue.location || 'General'}</b>
                      <span>{dateText(issue.createdAt)}{issue.assignedTo?.name ? ` · Assigned to ${issue.assignedTo.name}` : ''}</span>
                    </div>
                    <Status>{issue.status}</Status>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {guestView === 'profile' && (
        <>
          <section className="card guest-portal-section">
            <div className="card-head"><div><h3>Contact and preferences</h3><span>This profile is used for reservations, invoices and guest services</span></div><UserRound size={18} /></div>
            <form className="form-grid" onSubmit={submitProfile}>
              <label>Full name<input value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} /></label>
              <label>Email<input value={user?.email || ''} disabled /></label>
              <label>Phone<input value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label>Nationality<input value={profile.nationality} onChange={(event) => setProfile((current) => ({ ...current, nationality: event.target.value }))} /></label>
              <label>Passport / ID number<input value={profile.idNumber} onChange={(event) => setProfile((current) => ({ ...current, idNumber: event.target.value }))} /></label>
              <label>Address<input value={profile.address} onChange={(event) => setProfile((current) => ({ ...current, address: event.target.value }))} /></label>
              <label className="wide">Stay preferences<textarea value={profile.preferences} onChange={(event) => setProfile((current) => ({ ...current, preferences: event.target.value }))} placeholder="High floor, extra pillows, quiet room..." /></label>
              <div className="form-actions"><button className="btn primary" disabled={savingProfile}><Send size={15} />{savingProfile ? 'Saving...' : 'Save profile'}</button></div>
            </form>
          </section>

          <section className="card guest-portal-section">
            <div className="card-head"><div><h3>Portal password</h3><span>Change the password you use with your email and passport / ID number</span></div><KeyRound size={18} /></div>
            <form className="form-grid" onSubmit={submitPassword}>
              <label>Current password<input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} /></label>
              <label>New password<input type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} /></label>
              <div className="form-actions"><button className="btn primary" disabled={savingPassword}>{savingPassword ? 'Updating...' : 'Change password'}</button></div>
            </form>
          </section>
        </>
      )}

      {bookingOpen && (
        <div className="modal-backdrop" onClick={() => !savingStay && setBookingOpen(false)}>
          <div className="modal-card guest-book-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="eyebrow">NEW RESERVATION</div>
                <h3>Book another stay</h3>
              </div>
              <button type="button" className="close-btn" onClick={() => setBookingOpen(false)} disabled={savingStay}>×</button>
            </div>
            <p className="muted">Only rooms free on the reservation schedule for your dates can be booked. Occupied or overlapping stays are not submitted.</p>
            {stayError && <div className="notice error"><span>{stayError}</span></div>}
            <form className="form-grid" onSubmit={submitStay}>
              <label>Check-in
                <input
                  type="date"
                  min={today()}
                  value={stayForm.checkIn}
                  onChange={(event) => setStayForm((current) => ({ ...current, checkIn: event.target.value, room: '' }))}
                />
              </label>
              <label>Check-out
                <input
                  type="date"
                  min={stayForm.checkIn || today()}
                  value={stayForm.checkOut}
                  onChange={(event) => setStayForm((current) => ({ ...current, checkOut: event.target.value, room: '' }))}
                />
              </label>
              <label className="wide">Available room
                <select
                  value={stayForm.room}
                  onChange={(event) => setStayForm((current) => ({ ...current, room: event.target.value }))}
                  disabled={loadingRooms || availableRooms.length === 0}
                >
                  <option value="">{loadingRooms ? 'Checking the reservation schedule...' : (availableRooms.length === 0 ? 'No rooms available for these dates' : 'Select an available room')}</option>
                  {availableRooms.map((room) => (
                    <option key={room._id} value={room._id}>
                      Room {room.number} · {room.type} · {money(room.price)} / night
                    </option>
                  ))}
                </select>
              </label>
              {selectedStayRoom && (
                <p className="muted wide">{stayNights} night(s) · Total {money(stayTotal)}</p>
              )}
              <div className="form-actions">
                <button type="button" className="btn secondary" onClick={() => setBookingOpen(false)} disabled={savingStay}>Cancel</button>
                <button className="btn primary" disabled={savingStay || loadingRooms || !stayForm.room || !selectedStayRoom}>
                  <CalendarDays size={15} />
                  {savingStay ? 'Booking...' : 'Confirm reservation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedInvoice && (
        <div className="modal-backdrop" onClick={() => setSelectedInvoice(null)}>
          <div className="modal-card guest-invoice-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="eyebrow">GUEST INVOICE</div>
                <h3>{invoiceNumber(selectedInvoice)}</h3>
              </div>
              <button type="button" className="close-btn" onClick={() => setSelectedInvoice(null)}>×</button>
            </div>
            <p className="muted">
              Room {selectedInvoice.booking?.room?.number || '—'} · {dateText(selectedInvoice.booking?.checkIn)} → {dateText(selectedInvoice.booking?.checkOut)}
            </p>
            <div className="guest-invoice-lines">
              {(selectedInvoice.items || []).map((item, index) => (
                <div key={`${item.description}-${index}`}>
                  <span>{item.description}</span>
                  <b>{money(item.amount)}</b>
                </div>
              ))}
            </div>
            <div className="guest-invoice-total">
              <span>Subtotal {money(selectedInvoice.subtotal ?? selectedInvoice.total)}</span>
              <span>Tax ({Number(selectedInvoice.taxRate || 0)}%) {money(selectedInvoice.tax || 0)}</span>
              <b>Total {money(selectedInvoice.total)}</b>
              <Status>{selectedInvoice.paid ? 'Paid' : 'Unpaid'}</Status>
            </div>
            <div className="form-actions">
              <button type="button" className="btn secondary" onClick={() => printInvoice(selectedInvoice)}><Printer size={15} />Print</button>
              <button type="button" className="btn secondary" onClick={() => emailInvoice(selectedInvoice)}><Mail size={15} />Email</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
