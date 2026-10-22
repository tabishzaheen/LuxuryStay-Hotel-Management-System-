import { useEffect, useMemo, useState } from 'react';
import {
  BedDouble,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  CheckCircle2,
  LoaderCircle
} from 'lucide-react';

import { PageHead, Status } from '../components/UI';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

import deluxeKingImage from '../assets/rooms/deluxe-king.jpg';
import deluxeTwinImage from '../assets/rooms/deluxe-twin.jpg';
import executiveSuiteImage from '../assets/rooms/executive-suite.jpg';
import presidentialSuiteImage from '../assets/rooms/presidential-suite.jpg';
import premiumKingImage from '../assets/rooms/premium-king.jpg';
import royalSuiteImage from '../assets/rooms/royal-suite.jpg';

const EMPTY_FORM = {
  number: '',
  type: 'Deluxe King',
  floor: '1',
  price: '220',
  status: 'Available',
  amenities: ''
};

const normalizeStatus = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'available') return 'Available';
  if (value === 'occupied') return 'Occupied';
  if (value === 'cleaning') return 'Cleaning';
  if (value === 'maintenance') return 'Maintenance';
  return 'Available';
};

const apiStatus = (status) => normalizeStatus(status).toLowerCase();

const ROOM_IMAGES = {
  'Deluxe King': deluxeKingImage,
  'Deluxe Twin': deluxeTwinImage,
  'Executive Suite': executiveSuiteImage,
  'Presidential Suite': presidentialSuiteImage,
  'Premium King': premiumKingImage,
  'Royal Suite': royalSuiteImage,
  'Deluxe': deluxeKingImage,
  'Suite': royalSuiteImage
};

const getRoomImage = (type) => ROOM_IMAGES[type] || deluxeKingImage;

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [modal, setModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyRoomId, setBusyRoomId] = useState('');
  const { user } = useAuth();
  const canManageInventory = ['admin', 'manager'].includes(user?.role);
  const canUpdateStatus = ['admin', 'manager', 'housekeeping'].includes(user?.role);

  const refreshRooms = async () => {
    const data = await api('/rooms');
    const next = Array.isArray(data) ? data : [];
    setRooms(next);
    return next;
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await api('/rooms');
        if (cancelled) return;
        setRooms(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  // Initial inventory load only; refreshes are explicit after mutations.
  }, []);

  const stats = useMemo(() => ({
    total: rooms.length,
    available: rooms.filter((room) => normalizeStatus(room.status) === 'Available').length,
    occupied: rooms.filter((room) => normalizeStatus(room.status) === 'Occupied').length,
    cleaning: rooms.filter((room) => normalizeStatus(room.status) === 'Cleaning').length,
    maintenance: rooms.filter((room) => normalizeStatus(room.status) === 'Maintenance').length
  }), [rooms]);

  const shownRooms = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rooms.filter((room) => {
      const status = normalizeStatus(room.status);
      const matchesFilter = filter === 'All' || status === filter;
      const amenities = Array.isArray(room.amenities) ? room.amenities.join(' ') : '';
      const matchesSearch = !query ||
        String(room.number || '').toLowerCase().includes(query) ||
        String(room.type || '').toLowerCase().includes(query) ||
        String(room.floor || '').toLowerCase().includes(query) ||
        amenities.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [rooms, search, filter]);

  const openAddModal = () => {
    setEditingRoom(null);
    setForm(EMPTY_FORM);
    setError('');
    setModal(true);
  };

  const openEditModal = (room) => {
    setEditingRoom(room);
    setForm({
      number: room.number || '',
      type: room.type || 'Deluxe King',
      floor: room.floor || '1',
      price: String(room.price ?? ''),
      status: normalizeStatus(room.status),
      amenities: Array.isArray(room.amenities) ? room.amenities.join(', ') : ''
    });
    setError('');
    setModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModal(false);
    setEditingRoom(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const number = form.number.trim();
    const price = Number(form.price);
    const amenities = form.amenities.split(',').map((item) => item.trim()).filter(Boolean);

    if (!number) return setError('Please enter a room number.');
    if (!form.floor.trim()) return setError('Please enter the floor number.');
    if (form.price === '' || Number.isNaN(price) || price < 0) return setError('Please enter a valid nightly rate.');

    const duplicate = rooms.some((room) =>
      String(room.number).trim().toLowerCase() === number.toLowerCase() &&
      room._id !== editingRoom?._id
    );

    if (duplicate) return setError('A room with this number already exists.');

    const payload = {
      number,
      type: form.type.trim(),
      floor: form.floor.trim(),
      price,
      status: apiStatus(form.status),
      amenities: amenities.length ? amenities : ['Wi-Fi', 'City view']
    };

    try {
      setSaving(true);
      setError('');

      if (editingRoom) {
        await api(`/rooms/${editingRoom._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await api('/rooms', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      await refreshRooms();
      closeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (room) => {
    const confirmed = window.confirm(`Are you sure you want to delete Room ${room.number}?`);
    if (!confirmed) return;

    try {
      setBusyRoomId(room._id);
      setError('');
      await api(`/rooms/${room._id}`, { method: 'DELETE' });
      await refreshRooms();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyRoomId('');
    }
  };

  const handleStatusChange = async (room, status) => {
    try {
      setBusyRoomId(room._id);
      setError('');
      await api(`/rooms/${room._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: apiStatus(status) })
      });
      await refreshRooms();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyRoomId('');
    }
  };

  return (
    <>
      <PageHead
        eyebrow="ROOM MANAGEMENT"
        title="Rooms & inventory"
        description="Manage room inventory, pricing, availability and live room status."
        action={canManageInventory ? openAddModal : undefined}
        actionLabel={canManageInventory ? 'Add room' : undefined}
      />

      {error && <div className="notice error"><span>{error}</span></div>}

      <div className="room-summary">
        <div><BedDouble /><span>{stats.total} total rooms</span></div>
        <div><i className="room-dot available" />{stats.available} available</div>
        <div><i className="room-dot occupied" />{stats.occupied} occupied</div>
        <div><i className="room-dot cleaning" />{stats.cleaning} cleaning</div>
        <div><i className="room-dot maintenance" />{stats.maintenance} maintenance</div>
      </div>

      <div className="room-toolbar">
        <div className="room-search">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search room number, type or amenity..."
          />
        </div>

        <div className="room-filter">
          <label htmlFor="room-status-filter">Status</label>
          <select id="room-status-filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option>All</option>
            <option>Available</option>
            <option>Occupied</option>
            <option>Cleaning</option>
            <option>Maintenance</option>
          </select>
        </div>
      </div>

      <div className="room-results">
        Showing <strong>{shownRooms.length}</strong> room{shownRooms.length !== 1 ? 's' : ''}
        {(search || filter !== 'All') && (
          <button type="button" onClick={() => { setSearch(''); setFilter('All'); }}>
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="room-empty">
          <LoaderCircle className="spin" size={25} />
          <h3>Loading room inventory</h3>
          <p>Reading the shared database inventory...</p>
        </div>
      ) : shownRooms.length === 0 ? (
        <div className="room-empty">
          <div className="room-empty-icon"><BedDouble size={25} /></div>
          <h3>No rooms found</h3>
          <p>Try changing your search or status filter.</p>
        </div>
      ) : (
        <div className="room-grid">
          {shownRooms.map((room) => {
            const status = normalizeStatus(room.status);
            const busy = busyRoomId === room._id;

            return (
              <div className="room-card" key={room._id}>
                <div className="room-top">
                  <span className="room-number">ROOM {room.number}</span>
                  <Status>{status}</Status>
                </div>

                <div className="room-art">
                  <img
                    src={getRoomImage(room.type)}
                    alt={`${room.type || 'Luxury'} room`}
                    loading="lazy"
                  />
                  <div className="room-image-shade" />
                  <span className="room-image-label">LUXURYSTAY COLLECTION</span>
                </div>

                <div className="room-info">
                  <div>
                    <h3>{room.type}</h3>
                    <p>Floor {room.floor || '—'} · {(room.amenities || []).slice(0, 2).join(' · ') || 'Standard amenities'}</p>
                  </div>
                  <b>${Number(room.price || 0).toLocaleString()}<small>/night</small></b>
                </div>

                <div className="room-status-row">
                  <label>Room status</label>
                  <select
                    value={status}
                    disabled={busy || !canUpdateStatus}
                    onChange={(event) => handleStatusChange(room, event.target.value)}
                  >
                    <option>Available</option>
                    <option>Occupied</option>
                    <option>Cleaning</option>
                    <option>Maintenance</option>
                  </select>
                </div>

                <div className="room-foot">
                  <span>{status === 'Available' ? 'Ready for arrival' : `Room is ${status.toLowerCase()}`}</span>
                  {canManageInventory && (
                    <div className="room-actions">
                      <button type="button" className="room-action edit" onClick={() => openEditModal(room)} disabled={busy} title={`Edit room ${room.number}`}>
                        <Pencil size={15} />
                      </button>
                      <button type="button" className="room-action delete" onClick={() => handleDelete(room)} disabled={busy} title={`Delete room ${room.number}`}>
                        {busy ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="room-modal-backdrop" onClick={closeModal}>
          <div className="room-modal" onClick={(event) => event.stopPropagation()}>
            <div className="room-modal-head">
              <div>
                <span className="eyebrow">ROOM INVENTORY</span>
                <h3>{editingRoom ? `Edit Room ${editingRoom.number}` : 'Add room'}</h3>
                <p>{editingRoom ? 'Update room details, pricing and current status.' : 'Add a new room to your hotel inventory.'}</p>
              </div>
              <button type="button" onClick={closeModal} aria-label="Close" className="room-modal-close"><X size={19} /></button>
            </div>

            {error && <div className="room-form-error">{error}</div>}

            <form onSubmit={handleSubmit} className="room-form">
              <label>Room number<input name="number" value={form.number} onChange={handleChange} placeholder="e.g. 405" autoFocus /></label>
              <label>Floor<input name="floor" value={form.floor} onChange={handleChange} placeholder="e.g. 4" /></label>
              <label>Room type
                <select name="type" value={form.type} onChange={handleChange}>
                  <option>Deluxe King</option><option>Deluxe Twin</option><option>Executive Suite</option><option>Presidential Suite</option><option>Premium King</option><option>Royal Suite</option>
                </select>
              </label>
              <label>Current status
                <select name="status" value={form.status} onChange={handleChange}>
                  <option>Available</option><option>Occupied</option><option>Cleaning</option><option>Maintenance</option>
                </select>
              </label>
              <label>Nightly rate<input name="price" type="number" min="0" value={form.price} onChange={handleChange} placeholder="250" /></label>
              <label>Amenities<input name="amenities" value={form.amenities} onChange={handleChange} placeholder="Wi-Fi, City view, King bed" /></label>

              <div className="room-form-hint"><CheckCircle2 size={15} /><span>Separate amenities with commas.</span></div>

              <div className="room-form-actions">
                <button type="button" className="btn secondary" onClick={closeModal} disabled={saving}>Cancel</button>
                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? <><LoaderCircle className="spin" size={15} /> Saving...</> : editingRoom ? <><Pencil size={15} /> Update room</> : <><Plus size={16} /> Save room</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
