import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  X
} from 'lucide-react';

import { PageHead, Status } from '../components/UI';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const emptyForm = {
  room: '',
  location: '',
  category: 'other',
  priority: 'normal',
  assignedTo: '',
  description: ''
};

const label = (value) => String(value || '').replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function Maintenance() {
  const [issues, setIssues] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const { user } = useAuth();
  const canManage = ['admin', 'manager'].includes(user?.role);
  const canWorkAssigned = user?.role === 'maintenance';

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [issueData, roomData, staffData] = await Promise.all([
        api('/maintenance'),
        api('/rooms'),
        api('/maintenance/staff')
      ]);
      setIssues(Array.isArray(issueData) ? issueData : []);
      setRooms(Array.isArray(roomData) ? roomData : []);
      setStaff(Array.isArray(staffData) ? staffData : []);
    } catch (err) {
      setError(err.message || 'Unable to load maintenance records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [issueData, roomData, staffData] = await Promise.all([
          api('/maintenance'),
          api('/rooms'),
          api('/maintenance/staff')
        ]);
        if (cancelled) return;
        setIssues(Array.isArray(issueData) ? issueData : []);
        setRooms(Array.isArray(roomData) ? roomData : []);
        setStaff(Array.isArray(staffData) ? staffData : []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load maintenance records.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const open = issues.filter((issue) => issue.status === 'reported').length;
    const inProgress = issues.filter((issue) => issue.status === 'in-progress').length;
    const resolved = issues.filter((issue) => issue.status === 'resolved').length;
    const urgent = issues.filter((issue) => issue.priority === 'urgent' && issue.status !== 'resolved').length;
    return { open, inProgress, resolved, urgent };
  }, [issues]);

  const visible = useMemo(() => issues.filter((issue) => {
    const statusMatch = statusFilter === 'all' || issue.status === statusFilter;
    const priorityMatch = priorityFilter === 'all' || issue.priority === priorityFilter;
    return statusMatch && priorityMatch;
  }), [issues, statusFilter, priorityFilter]);

  const openModal = () => {
    setForm(emptyForm);
    setError('');
    setNotice('');
    setModal(true);
  };

  const closeModal = () => {
    if (!saving) setModal(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.room && !form.location.trim()) return setError('Select a room or enter a location.');
    if (!form.description.trim()) return setError('Issue description is required.');

    try {
      setSaving(true);
      setError('');
      await api('/maintenance', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          location: form.location.trim(),
          description: form.description.trim(),
          assignedTo: form.assignedTo || null
        })
      });
      setModal(false);
      setForm(emptyForm);
      setNotice('Maintenance issue reported successfully.');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateIssue = async (issue, patch) => {
    try {
      setError('');
      setNotice('');
      await api(`/maintenance/${issue._id}`, {
        method: 'PUT',
        body: JSON.stringify(patch)
      });
      setNotice(`Issue ${issue._id.slice(-6).toUpperCase()} updated successfully.`);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHead
        eyebrow="FACILITIES"
        title="Maintenance"
        description="Report, assign, prioritize and resolve maintenance issues while keeping room status synchronized."
        action={canManage ? openModal : undefined}
        actionLabel={canManage ? 'Report issue' : undefined}
      />

      {error && <div className="notice error"><span>{error}</span></div>}
      {notice && <div className="notice success"><span>{notice}</span></div>}

      <div className="stats-grid compact">
        <div className="stat-card"><span>Open issues</span><strong>{stats.open}</strong><small>{stats.urgent} urgent</small></div>
        <div className="stat-card"><span>In progress</span><strong>{stats.inProgress}</strong><small>Being handled</small></div>
        <div className="stat-card"><span>Resolved</span><strong>{stats.resolved}</strong><small>All recorded resolutions</small></div>
        <div className="stat-card"><span>Rooms in maintenance</span><strong>{rooms.filter((room) => room.status === 'maintenance').length}</strong><small>Live room status</small></div>
      </div>

      <div className="toolbar">
        <div className="toolbar-actions">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="reported">Reported</option><option value="in-progress">In progress</option><option value="resolved">Resolved</option></select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select>
        </div>
      </div>

      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Issue</th><th>Room / location</th><th>Description</th><th>Reported by</th><th>Assigned</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="8" className="table-message">Loading maintenance records...</td></tr> : visible.length === 0 ? <tr><td colSpan="8" className="table-message">No maintenance issues match the selected filters.</td></tr> : visible.map((issue) => (
                <tr key={issue._id}>
                  <td><b>MT-{issue._id.slice(-6).toUpperCase()}</b></td>
                  <td><b>{issue.room ? `Room ${issue.room.number}` : issue.location || 'General'}</b><small className="table-subtext">{issue.room?.type || issue.location || 'Facilities'}</small></td>
                  <td>{issue.description}</td>
                  <td>{issue.reportedBy?.name || 'Guest / staff'}</td>
                  <td>{canManage ? <select className="mini-select" value={issue.assignedTo?._id || ''} onChange={(event) => updateIssue(issue, { assignedTo: event.target.value || null })}><option value="">Unassigned</option>{staff.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}</select> : <span>{issue.assignedTo?.name || 'Pending assignment'}</span>}</td>
                  <td><Status>{label(issue.priority)}</Status></td>
                  <td><Status>{label(issue.status)}</Status></td>
                  <td>{canManage ? <select className="mini-select" value={issue.status} onChange={(event) => updateIssue(issue, { status: event.target.value })}><option value="reported">Reported</option><option value="in-progress">In progress</option><option value="resolved">Resolved</option></select> : canWorkAssigned ? <select className="mini-select" value={issue.status} onChange={(event) => updateIssue(issue, { status: event.target.value })}><option value="reported">Reported</option><option value="in-progress">In progress</option><option value="resolved">Resolved</option></select> : <span className="muted">Tracking</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card maintenance-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><div className="eyebrow">FACILITIES REQUEST</div><h3>Report maintenance issue</h3></div><button type="button" className="close-btn" onClick={closeModal}><X size={18} /></button></div>
            {error && <div className="admin-error">{error}</div>}
            <form className="form-grid" onSubmit={submit}>
              <label>Room<select value={form.room} onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))}><option value="">Select room</option>{rooms.map((room) => <option key={room._id} value={room._id}>Room {room.number} · {room.type}</option>)}</select></label>
              <label>Location<input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="e.g. Kitchen or Lobby" /></label>
              <label>Category<select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}><option value="plumbing">Plumbing</option><option value="electrical">Electrical</option><option value="hvac">HVAC</option><option value="appliance">Appliance</option><option value="internet">Internet</option><option value="furniture">Furniture</option><option value="other">Other</option></select></label>
              <label>Priority<select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="low">Low</option></select></label>
              <label>Assign to<select value={form.assignedTo} onChange={(event) => setForm((current) => ({ ...current, assignedTo: event.target.value }))}><option value="">Unassigned</option>{staff.map((member) => <option key={member._id} value={member._id}>{member.name} · {member.role}</option>)}</select></label>
              <label className="wide">Description<textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the issue and any useful details..." /></label>
              <div className="form-actions"><button type="button" className="btn secondary" onClick={closeModal} disabled={saving}>Cancel</button><button type="submit" className="btn primary" disabled={saving}><Plus size={16} />{saving ? 'Reporting...' : 'Report issue'}</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
