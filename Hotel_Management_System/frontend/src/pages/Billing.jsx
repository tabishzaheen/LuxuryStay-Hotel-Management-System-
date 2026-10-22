import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Mail,
  Plus,
  Printer,
  ReceiptText,
  Search,
  X
} from 'lucide-react';

import { PageHead, Status } from '../components/UI';
import { api } from '../services/api';

const money = (value) =>
  `$${Number(value || 0).toLocaleString()}`;

const invoiceNumber = (invoice) =>
  `INV-${String(invoice?._id || '').slice(-6).toUpperCase()}`;

const formatDate = (value) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
};

const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

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
    .map(
      (item) => `
        <tr>
          <td>${String(item.description || '').replaceAll('<', '&lt;')}</td>
          <td style="text-align:right">${money(item.amount)}</td>
        </tr>`
    )
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
  <div class="head"><div><h1>LuxuryStay</h1><div class="muted">Hospitality Group</div></div><div><b>${invoiceNumber(invoice)}</b><div class="muted">Issued ${formatDate(invoice.issuedAt)}</div></div></div>
  <div class="box"><b>Guest</b><br>${guest.name || 'Guest'}<br>${guest.email || ''}<br>${guest.phone || ''}<br><br><b>Stay</b><br>Room ${room.number || '—'} · ${room.type || ''}<br>${formatDate(booking.checkIn)} → ${formatDate(booking.checkOut)}</div>
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
    window.alert('This guest does not have an email address.');
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

export default function Billing() {
  const [invoices, setInvoices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [extraItems, setExtraItems] = useState([]);
  const [serviceId, setServiceId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [customDescription, setCustomDescription] = useState('');
  const [customAmount, setCustomAmount] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [invoiceData, bookingData, serviceData] = await Promise.all([
        api('/invoices'),
        api('/bookings'),
        api('/services')
      ]);
      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
      setBookings(Array.isArray(bookingData) ? bookingData : []);
      setServices(Array.isArray(serviceData) ? serviceData : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const availableBookings = useMemo(
    () => bookings.filter((booking) => !booking.invoice && booking.status !== 'cancelled'),
    [bookings]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const paidMatch =
        filter === 'all' ||
        (filter === 'paid' && invoice.paid) ||
        (filter === 'pending' && !invoice.paid);
      const haystack = [
        invoiceNumber(invoice),
        invoice.booking?.guest?.name,
        invoice.booking?.guest?.email,
        invoice.booking?.room?.number
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return paidMatch && (!term || haystack.includes(term));
    });
  }, [invoices, search, filter]);

  const stats = useMemo(() => {
    const now = new Date();
    const key = todayKey();
    const month = now.getMonth();
    const year = now.getFullYear();

    const todayRevenue = invoices
      .filter((invoice) => invoice.paid && String(invoice.issuedAt || '').slice(0, 10) === key)
      .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

    const outstanding = invoices
      .filter((invoice) => !invoice.paid)
      .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

    const paidMonth = invoices
      .filter((invoice) => {
        const date = new Date(invoice.issuedAt);
        return invoice.paid && date.getMonth() === month && date.getFullYear() === year;
      })
      .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

    const average = invoices.length
      ? invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0) / invoices.length
      : 0;

    return { todayRevenue, outstanding, paidMonth, average };
  }, [invoices]);

  const resetCreate = () => {
    setCreateOpen(false);
    setBookingId('');
    setExtraItems([]);
    setServiceId('');
    setQuantity('1');
    setCustomDescription('');
    setCustomAmount('');
  };

  const addServiceLine = () => {
    const service = services.find((item) => item._id === serviceId);
    const qty = Number(quantity);
    if (!service) {
      setError('Please select a service.');
      return;
    }
    if (!Number.isInteger(qty) || qty < 1) {
      setError('Service quantity must be at least 1.');
      return;
    }
    setExtraItems((current) => [
      ...current,
      {
        description: `${service.name} · ${qty} × ${money(service.price)}`,
        amount: Number(service.price) * qty
      }
    ]);
    setServiceId('');
    setQuantity('1');
    setError('');
  };

  const addCustomLine = () => {
    const amount = Number(customAmount);
    if (!customDescription.trim()) {
      setError('Enter a description for the extra charge.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Enter a valid extra charge amount.');
      return;
    }
    setExtraItems((current) => [
      ...current,
      { description: customDescription.trim(), amount }
    ]);
    setCustomDescription('');
    setCustomAmount('');
    setError('');
  };

  const createInvoice = async (event) => {
    event.preventDefault();
    if (!bookingId) {
      setError('Please select a booking.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setNotice('');
      const invoice = await api('/invoices', {
        method: 'POST',
        body: JSON.stringify({ bookingId, items: extraItems })
      });
      setNotice(`${invoiceNumber(invoice)} created successfully.`);
      resetCreate();
      await loadData();
      setSelected(invoice);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (invoice) => {
    try {
      setError('');
      const updated = await api(`/invoices/${invoice._id}/pay`, { method: 'PUT' });
      setInvoices((current) =>
        current.map((item) => (item._id === updated._id ? { ...item, ...updated, booking: invoice.booking } : item))
      );
      setSelected((current) =>
        current && current._id === updated._id ? { ...current, ...updated, booking: invoice.booking } : current
      );
      setNotice(`${invoiceNumber(invoice)} marked as paid.`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHead
        eyebrow="FINANCE"
        title="Billing & invoices"
        description="Generate accurate room and service bills, print invoices and prepare them for email."
        action={() => {
          setError('');
          setNotice('');
          setCreateOpen(true);
        }}
        actionLabel="Create invoice"
      />

      {error && <div className="notice error"><span>{error}</span></div>}
      {notice && <div className="notice success"><span>{notice}</span></div>}

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-top"><span>Today's paid revenue</span><div className="stat-icon"><ReceiptText size={18} /></div></div><strong>{money(stats.todayRevenue)}</strong><small>Paid invoices issued today</small></div>
        <div className="stat-card"><div className="stat-top"><span>Outstanding</span><div className="stat-icon"><ReceiptText size={18} /></div></div><strong>{money(stats.outstanding)}</strong><small>Unpaid invoice balance</small></div>
        <div className="stat-card"><div className="stat-top"><span>Paid this month</span><div className="stat-icon"><CheckCircle2 size={18} /></div></div><strong>{money(stats.paidMonth)}</strong><small>Collected this month</small></div>
        <div className="stat-card"><div className="stat-top"><span>Average invoice</span><div className="stat-icon"><FileText size={18} /></div></div><strong>{money(Math.round(stats.average))}</strong><small>Across {invoices.length} invoice(s)</small></div>
      </div>

      <section className="card billing-panel">
        <div className="billing-toolbar">
          <div className="billing-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice, guest or room..." /></div>
          <div className="billing-filters">
            {['all', 'paid', 'pending'].map((item) => (
              <button key={item} type="button" className={`btn secondary ${filter === item ? 'active' : ''}`} onClick={() => setFilter(item)}>{item === 'all' ? 'All invoices' : item === 'paid' ? 'Paid' : 'Pending'}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="muted">Loading invoices...</p>
        ) : filtered.length === 0 ? (
          <div className="empty"><div className="empty-icon">◈</div><h3>No invoices found</h3><p>Create an invoice from a booking to start billing.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Invoice</th><th>Guest</th><th>Stay</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((invoice) => (
                  <tr key={invoice._id}>
                    <td><b>{invoiceNumber(invoice)}</b><small className="table-subtext">{formatDate(invoice.issuedAt)}</small></td>
                    <td><b>{invoice.booking?.guest?.name || 'Guest'}</b><small className="table-subtext">{invoice.booking?.guest?.email || 'No email'}</small></td>
                    <td>Room {invoice.booking?.room?.number || '—'}<small className="table-subtext">{formatDate(invoice.booking?.checkIn)} → {formatDate(invoice.booking?.checkOut)}</small></td>
                    <td><b>{money(invoice.total)}</b><small className="table-subtext">{invoice.items?.length || 0} line(s)</small></td>
                    <td><Status>{invoice.paid ? 'Paid' : 'Pending'}</Status></td>
                    <td>
                      <div className="inline-actions">
                        <button type="button" className="btn tiny secondary" onClick={() => setSelected(invoice)}>View</button>
                        <button type="button" className="icon-btn subtle" title="Print invoice" onClick={() => printInvoice(invoice)}><Printer size={16} /></button>
                        <button type="button" className="icon-btn subtle" title="Email invoice" onClick={() => emailInvoice(invoice)}><Mail size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {createOpen && (
        <div className="modal-backdrop" onClick={resetCreate}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><div className="eyebrow">NEW INVOICE</div><h3>Create billing invoice</h3></div>
              <button type="button" className="close-btn" onClick={resetCreate}><X size={18} /></button>
            </div>
            <form className="form-grid" onSubmit={createInvoice}>
              <label className="wide">Booking<select value={bookingId} onChange={(event) => setBookingId(event.target.value)}><option value="">Select booking</option>{availableBookings.map((booking) => <option key={booking._id} value={booking._id}>{booking.guest?.name || 'Guest'} · Room {booking.room?.number || '—'} · {money(booking.totalPrice)}</option>)}</select></label>

              <div className="billing-add-line wide">
                <label>Service<select value={serviceId} onChange={(event) => setServiceId(event.target.value)}><option value="">Select service</option>{services.map((service) => <option key={service._id} value={service._id}>{service.name} · {money(service.price)}</option>)}</select></label>
                <label>Qty<input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
                <button type="button" className="btn secondary" onClick={addServiceLine}><Plus size={15} />Add service</button>
              </div>

              <div className="billing-add-line wide">
                <label>Description<input value={customDescription} onChange={(event) => setCustomDescription(event.target.value)} placeholder="Food, laundry, minibar..." /></label>
                <label>Amount<input type="number" min="0" step="0.01" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} placeholder="0" /></label>
                <button type="button" className="btn secondary" onClick={addCustomLine}><Plus size={15} />Add charge</button>
              </div>

              {extraItems.length > 0 && <div className="invoice-lines wide">{extraItems.map((item, index) => <div className="invoice-line" key={`${item.description}-${index}`}><span>{item.description}</span><b>{money(item.amount)}</b><button type="button" className="icon-btn subtle" onClick={() => setExtraItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button></div>)}</div>}

              <div className="form-actions wide"><button type="button" className="btn secondary" onClick={resetCreate}>Cancel</button><button type="submit" className="btn primary" disabled={saving || !bookingId}>{saving ? 'Creating...' : 'Create invoice'}</button></div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-card invoice-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><div className="eyebrow">INVOICE</div><h3>{invoiceNumber(selected)}</h3></div><button type="button" className="close-btn" onClick={() => setSelected(null)}><X size={18} /></button></div>
            <div className="invoice-detail-head"><div><span>Guest</span><b>{selected.booking?.guest?.name || 'Guest'}</b><small>{selected.booking?.guest?.email || 'No email'}</small></div><div><span>Stay</span><b>Room {selected.booking?.room?.number || '—'}</b><small>{formatDate(selected.booking?.checkIn)} → {formatDate(selected.booking?.checkOut)}</small></div><div><span>Status</span><Status>{selected.paid ? 'Paid' : 'Pending'}</Status></div></div>
            <div className="invoice-lines">{(selected.items || []).map((item, index) => <div className="invoice-line" key={`${item.description}-${index}`}><span>{item.description}</span><b>{money(item.amount)}</b></div>)}</div>
            <div className="invoice-breakdown"><div><span>Subtotal</span><b>{money(selected.subtotal ?? selected.total)}</b></div><div><span>Tax ({Number(selected.taxRate || 0)}%)</span><b>{money(selected.tax || 0)}</b></div></div><div className="invoice-total"><span>Total</span><b>{money(selected.total)}</b></div>
            <div className="form-actions">
              {!selected.paid && <button type="button" className="btn primary" onClick={() => markPaid(selected)}><CheckCircle2 size={15} />Mark paid</button>}
              <button type="button" className="btn secondary" onClick={() => printInvoice(selected)}><Printer size={15} />Print</button>
              <button type="button" className="btn secondary" onClick={() => emailInvoice(selected)}><Mail size={15} />Email</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
