import { useEffect, useMemo, useState } from 'react';
import { Car, PhoneCall, Plus, Sparkles, Utensils, X } from 'lucide-react';
import { PageHead, Status } from '../components/UI';
import { api } from '../services/api';

const emptyForm = { name: '', description: '', price: '0' };
const serviceType = (name = '') => {
  const value = name.toLowerCase();
  if (value.includes('wake')) return 'wake-up-call';
  if (value.includes('transport') || value.includes('airport')) return 'transportation';
  if (value.includes('laundry')) return 'laundry';
  if (value.includes('house')) return 'housekeeping';
  if (value.includes('room')) return 'room-service';
  return 'other';
};
const iconFor = (name = '') => {
  const type = serviceType(name);
  if (type === 'transportation') return Car;
  if (type === 'wake-up-call') return PhoneCall;
  if (type === 'housekeeping' || type === 'laundry') return Sparkles;
  return Utensils;
};

export default function Services() {
  const [services, setServices] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      const [serviceData, requestData] = await Promise.all([api('/services'), api('/service-requests')]);
      setServices(Array.isArray(serviceData) ? serviceData : []);
      setRequests(Array.isArray(requestData) ? requestData : []);
    } catch (err) { setError(err.message || 'Unable to load guest services.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { let cancelled = false; (async () => {
    try {
      const [serviceData, requestData] = await Promise.all([api('/services'), api('/service-requests')]);
      if (cancelled) return;
      setServices(Array.isArray(serviceData) ? serviceData : []);
      setRequests(Array.isArray(requestData) ? requestData : []);
    } catch (err) { if (!cancelled) setError(err.message || 'Unable to load guest services.'); }
    finally { if (!cancelled) setLoading(false); }
  })(); return () => { cancelled = true; }; }, []);

  const openRequests = useMemo(() => requests.filter((r) => !['completed', 'cancelled'].includes(r.status)), [requests]);
  const openModal = () => { setForm(emptyForm); setError(''); setNotice(''); setModal(true); };
  const closeModal = () => { if (!saving) setModal(false); };

  const createService = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Service name is required.');
    if (Number(form.price) < 0 || !Number.isFinite(Number(form.price))) return setError('Enter a valid non-negative price.');
    try {
      setSaving(true); setError('');
      await api('/services', { method: 'POST', body: JSON.stringify({ name: form.name.trim(), description: form.description.trim(), price: Number(form.price) }) });
      setModal(false); setNotice('Service added successfully.'); await loadData();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const updateRequest = async (request, status) => {
    try { setError(''); await api(`/service-requests/${request._id}`, { method: 'PUT', body: JSON.stringify({ status }) }); setNotice('Service request updated.'); await loadData(); }
    catch (err) { setError(err.message); }
  };

  return <>
    <PageHead eyebrow="GUEST EXPERIENCE" title="Guest services" description="Manage the service catalogue and live guest requests from one place." action={openModal} actionLabel="Add service" />
    {error && <div className="notice error"><span>{error}</span></div>}
    {notice && <div className="notice success"><span>{notice}</span></div>}

    <div className="stats-grid compact">
      <div className="stat-card"><span>Services</span><strong>{loading ? '—' : services.length}</strong><small>Available catalogue</small></div>
      <div className="stat-card"><span>Open requests</span><strong>{loading ? '—' : openRequests.length}</strong><small>Need attention</small></div>
      <div className="stat-card"><span>Completed</span><strong>{loading ? '—' : requests.filter((r) => r.status === 'completed').length}</strong><small>Guest requests</small></div>
    </div>

    <div className="service-grid">
      {services.map((service) => { const Icon = iconFor(service.name); return <div className="service-card" key={service._id}>
        <div className="service-icon"><Icon size={22} /></div><div><h3>{service.name}</h3><p>{service.description || 'LuxuryStay guest service'}</p></div>
        <div className="service-meta"><span>Available</span><b>${Number(service.price || 0).toLocaleString()}</b></div>
        <div className="service-meta"><span>Request type</span><b>{serviceType(service.name).replaceAll('-', ' ')}</b></div>
      </div>; })}
      {!loading && services.length === 0 && <div className="card"><p className="muted">No services in the catalogue yet. Add your first service.</p></div>}
    </div>

    <div className="card requests">
      <div className="card-head"><div><h3>Live service requests</h3><span>Guest requests requiring attention</span></div><Status>{openRequests.length} open</Status></div>
      {loading ? <p className="muted">Loading service requests...</p> : requests.length === 0 ? <p className="muted">No guest service requests yet.</p> : requests.map((request) => <div className="request" key={request._id}>
        <b>SR-{request._id.slice(-6).toUpperCase()}</b><span><b>{request.room ? `Room ${request.room.number}` : request.guest?.name || 'Guest'}</b> · {request.serviceName} × {request.quantity}</span>
        <Status>{request.status}</Status><small>{request.guest?.name || 'Guest'}</small>
        {request.status === 'requested' && <button className="btn tiny" onClick={() => updateRequest(request, 'confirmed')}>Confirm</button>}
        {request.status === 'confirmed' && <button className="btn tiny" onClick={() => updateRequest(request, 'in-progress')}>Start</button>}
        {request.status === 'in-progress' && <button className="btn tiny" onClick={() => updateRequest(request, 'completed')}>Complete</button>}
      </div>)}
    </div>

    {modal && <div className="modal-backdrop" onClick={closeModal}><div className="modal-card" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header"><div><div className="eyebrow">GUEST EXPERIENCE</div><h3>Add guest service</h3></div><button className="close-btn" onClick={closeModal}><X size={18} /></button></div>
      {error && <div className="admin-error">{error}</div>}
      <form className="form-grid" onSubmit={createService}>
        <label>Service name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Airport Transfer" /></label>
        <label>Price<input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
        <label className="wide">Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the service..." /></label>
        <div className="form-actions"><button type="button" className="btn secondary" onClick={closeModal} disabled={saving}>Cancel</button><button className="btn primary" disabled={saving}><Plus size={16} />{saving ? 'Saving...' : 'Add service'}</button></div>
      </form>
    </div></div>}
  </>;
}
