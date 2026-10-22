import { useEffect, useState } from 'react';
import { Bell, Building2, Plus, ReceiptText, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHead } from '../components/UI';
import { api } from '../services/api';

const empty = {
  propertyName: '', propertyCode: '', contactEmail: '', phone: '', address: '', currency: 'USD', taxRate: 12,
  defaultCheckIn: '14:00', defaultCheckOut: '12:00', roomRates: [],
  policies: { cancellation: '', checkIn: '', children: '', smoking: '', pets: '' },
  notifications: { newReservation: true, maintenanceIssue: true, serviceRequest: true, feedbackReceived: true, dailySummary: true },
  security: { requireAdmin2FA: false, sessionTimeoutMinutes: 720 }
};

export default function Settings() {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [applying, setApplying] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');


  useEffect(() => { let cancelled=false; (async()=>{ try { const data=await api('/settings'); if(cancelled)return; setForm({ ...empty, ...data, policies:{...empty.policies,...(data.policies||{})}, notifications:{...empty.notifications,...(data.notifications||{})}, security:{...empty.security,...(data.security||{})}, roomRates:Array.isArray(data.roomRates)?data.roomRates:[] }); } catch(err){ if(!cancelled)setError(err.message); } finally{ if(!cancelled)setLoading(false); } })(); return()=>{cancelled=true;}; },[]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateNested = (section, key, value) => setForm((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
  const updateRate = (index, key, value) => setForm((current) => ({ ...current, roomRates: current.roomRates.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const addRate = () => setForm((current) => ({ ...current, roomRates: [...current.roomRates, { type: '', rate: 0 }] }));
  const removeRate = (index) => setForm((current) => ({ ...current, roomRates: current.roomRates.filter((_, i) => i !== index) }));

  const save = async (e) => { e.preventDefault(); try { setSaving(true); setError(''); setNotice(''); const data=await api('/settings',{method:'PUT',body:JSON.stringify(form)}); setForm(data); setNotice('System settings saved successfully.'); } catch(err){setError(err.message);} finally{setSaving(false);} };
  const applyRates = async () => { try { setApplying(true); setError(''); const result=await api('/settings/apply-room-rates',{method:'POST'}); setNotice(result.message); } catch(err){setError(err.message);} finally{setApplying(false);} };

  if (loading) return <><PageHead eyebrow="ADMINISTRATION" title="System settings" description="Configure property details, rates, policies, taxes and notifications." /><div className="card"><p className="muted">Loading system settings...</p></div></>;

  return <form onSubmit={save}>
    <PageHead eyebrow="ADMINISTRATION" title="System settings" description="Configure property details, rates, policies, taxes and notifications." action={() => document.getElementById('settings-save')?.click()} actionLabel={saving ? 'Saving...' : 'Save changes'} />
    {error && <div className="notice error"><span>{error}</span></div>}{notice && <div className="notice success"><span>{notice}</span></div>}

    <div className="settings-grid">
      <section className="card settings-card"><div className="setting-title"><Building2/><div><h3>Property profile</h3><p>Core information used across the hotel system.</p></div></div><div className="form-grid">
        <label>Property name<input value={form.propertyName} onChange={(e)=>update('propertyName',e.target.value)} /></label><label>Property code<input value={form.propertyCode} onChange={(e)=>update('propertyCode',e.target.value)} /></label><label>Contact email<input type="email" value={form.contactEmail} onChange={(e)=>update('contactEmail',e.target.value)} /></label><label>Phone<input value={form.phone} onChange={(e)=>update('phone',e.target.value)} /></label><label className="wide">Address<input value={form.address} onChange={(e)=>update('address',e.target.value)} /></label>
      </div></section>

      <section className="card settings-card"><div className="setting-title"><ReceiptText/><div><h3>Rates & taxes</h3><p>Control billing defaults and room-type pricing.</p></div></div><div className="form-grid">
        <label>Currency<select value={form.currency} onChange={(e)=>update('currency',e.target.value)}><option value="USD">USD — US Dollar</option><option value="PKR">PKR — Pakistani Rupee</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — Pound Sterling</option></select></label>
        <label>Tax rate (%)<input type="number" min="0" max="100" step="0.01" value={form.taxRate} onChange={(e)=>update('taxRate',e.target.value)} /></label>
        <label>Default check-in<input type="time" value={form.defaultCheckIn} onChange={(e)=>update('defaultCheckIn',e.target.value)} /></label><label>Default check-out<input type="time" value={form.defaultCheckOut} onChange={(e)=>update('defaultCheckOut',e.target.value)} /></label>
      </div><div className="settings-rate-list"><div className="settings-inline-head"><b>Room type rates</b><button type="button" className="btn secondary" onClick={addRate}><Plus size={14}/>Add rate</button></div>{form.roomRates.map((rate,index)=><div className="settings-rate-row" key={`${index}-${rate.type}`}><input placeholder="Room type e.g. Deluxe" value={rate.type} onChange={(e)=>updateRate(index,'type',e.target.value)} /><input type="number" min="0" step="0.01" value={rate.rate} onChange={(e)=>updateRate(index,'rate',e.target.value)} /><button type="button" className="icon-btn subtle" onClick={()=>removeRate(index)} aria-label="Remove rate"><Trash2 size={15}/></button></div>)}<button type="button" className="btn secondary" onClick={applyRates} disabled={applying}>{applying ? 'Applying...' : 'Apply saved rates to matching rooms'}</button></div></section>

      <section className="card settings-card"><div className="setting-title"><Building2/><div><h3>Hotel policies</h3><p>Policies displayed and used by hotel operations.</p></div></div><div className="form-grid"><label className="wide">Cancellation policy<textarea value={form.policies.cancellation} onChange={(e)=>updateNested('policies','cancellation',e.target.value)} /></label><label>Check-in policy<textarea value={form.policies.checkIn} onChange={(e)=>updateNested('policies','checkIn',e.target.value)} /></label><label>Children policy<textarea value={form.policies.children} onChange={(e)=>updateNested('policies','children',e.target.value)} /></label><label>Smoking policy<textarea value={form.policies.smoking} onChange={(e)=>updateNested('policies','smoking',e.target.value)} /></label><label>Pet policy<textarea value={form.policies.pets} onChange={(e)=>updateNested('policies','pets',e.target.value)} /></label></div></section>

      <section className="card settings-card"><div className="setting-title"><Bell/><div><h3>System notifications</h3><p>Choose which operational events create staff alerts.</p></div></div>{[['newReservation','New reservation alerts'],['maintenanceIssue','Maintenance issue alerts'],['serviceRequest','Guest service request alerts'],['feedbackReceived','New feedback alerts'],['dailySummary','Daily operations summary']].map(([key,title])=><label className="toggle-row" key={key}><div><b>{title}</b><span>Enable this notification category</span></div><input type="checkbox" checked={!!form.notifications[key]} onChange={(e)=>updateNested('notifications',key,e.target.checked)} /></label>)}</section>

      <section className="card settings-card"><div className="setting-title"><ShieldCheck/><div><h3>Security</h3><p>Administrator security preferences.</p></div></div><label className="toggle-row"><div><b>Administrator 2FA policy</b><span>Enable the policy flag for administrator accounts</span></div><input type="checkbox" checked={!!form.security.requireAdmin2FA} onChange={(e)=>updateNested('security','requireAdmin2FA',e.target.checked)} /></label><div className="form-grid"><label>Session timeout (minutes)<input type="number" min="15" max="1440" value={form.security.sessionTimeoutMinutes} onChange={(e)=>updateNested('security','sessionTimeoutMinutes',e.target.value)} /></label></div></section>
    </div>
    <button id="settings-save" type="submit" className="settings-hidden-submit" aria-hidden="true"><Save size={15}/>Save</button>
  </form>;
}
