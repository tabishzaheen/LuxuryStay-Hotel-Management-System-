import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Star,
  TrendingUp,
  Users
} from 'lucide-react';

import { PageHead, Progress, Status } from '../components/UI';
import { api } from '../services/api';

const dateKey = (date) => {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};

const defaultRange = () => {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: dateKey(from), to: dateKey(to) };
};

const money = (value) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function Reports() {
  const initial = defaultRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const query = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const [dashboard, feedbackData] = await Promise.all([
        api(`/reports/dashboard${query}`),
        api(`/reports/feedback${query}`)
      ]);
      setData(dashboard);
      setFeedback(Array.isArray(feedbackData) ? feedbackData : []);
    } catch (err) {
      setError(err.message || 'Unable to load reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const query = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
        const [dashboard, feedbackData] = await Promise.all([
          api(`/reports/dashboard${query}`),
          api(`/reports/feedback${query}`)
        ]);
        if (cancelled) return;
        setData(dashboard);
        setFeedback(Array.isArray(feedbackData) ? feedbackData : []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unable to load reports.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  // Initial report load only; the Apply button controls subsequent range changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyRange = async (event) => {
    event.preventDefault();
    if (!from || !to || from > to) {
      setError('Please select a valid report date range.');
      return;
    }
    await load();
  };

  const exportReport = () => {
    if (!data) return;
    const rows = [
      ['Metric', 'Value'],
      ['From', from],
      ['To', to],
      ['Occupancy rate', `${data.occupancy.occupancyRate}%`],
      ['Sold room nights', data.occupancy.soldRoomNights],
      ['Available room nights', data.occupancy.availableRoomNights],
      ['Revenue', data.revenue.totalRevenue],
      ['Room revenue', data.revenue.roomRevenue],
      ['ADR', data.revenue.adr],
      ['Feedback count', data.feedback.count],
      ['Average rating', data.feedback.averageRating],
      ['Forecast next month bookings', data.demandForecast.nextMonthBookings],
      ['Pricing recommendation', data.pricingRecommendation.action]
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `luxurystay-report-${from}-to-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const maxServiceRevenue = useMemo(
    () => Math.max(1, ...(data?.servicePerformance || []).map((item) => Number(item.revenue || 0))),
    [data]
  );

  const maxMonthlyBookings = useMemo(
    () => Math.max(1, ...(data?.demandForecast?.historical || []).map((item) => Number(item.bookings || 0))),
    [data]
  );

  return (
    <>
      <PageHead
        eyebrow="MANAGEMENT INSIGHTS"
        title="Reports & analytics"
        description="Use live occupancy, revenue, guest feedback and demand signals to make operational decisions."
        action={exportReport}
        actionLabel="Export CSV"
      />

      <section className="card report-filters">
        <form onSubmit={applyRange}>
          <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <button className="btn primary" type="submit" disabled={loading}>{loading ? 'Loading...' : 'Apply range'}</button>
        </form>
      </section>

      {error && <div className="notice error"><span>{error}</span></div>}

      {loading && !data ? (
        <div className="card report-empty"><BarChart3 size={24} /><h3>Loading live analytics</h3><p>Calculating operational metrics from the database...</p></div>
      ) : data && (
        <>
          <div className="stats-grid compact report-stats">
            <div className="stat-card"><span>Occupancy</span><strong>{data.occupancy.occupancyRate}%</strong><small>{data.occupancy.soldRoomNights} sold room nights</small></div>
            <div className="stat-card"><span>Revenue</span><strong>{money(data.revenue.totalRevenue)}</strong><small>{data.revenue.invoiceCount} invoices</small></div>
            <div className="stat-card"><span>ADR</span><strong>{money(data.revenue.adr)}</strong><small>Average daily room rate</small></div>
            <div className="stat-card"><span>Guest rating</span><strong>{data.feedback.averageRating || '—'}</strong><small>{data.feedback.count} feedback records</small></div>
          </div>

          <div className="report-grid">
            <section className="card report-main">
              <div className="card-head"><div><h3>Demand history & forecast</h3><span>{data.demandForecast.method}</span></div><TrendingUp size={18} /></div>
              <div className="report-bars">
                {(data.demandForecast.historical || []).map((item) => (
                  <div className="report-bar-col" key={item.month}>
                    <div className="report-bar-value">{item.bookings}</div>
                    <div className="report-bar" style={{ height: `${Math.max(4, (item.bookings / maxMonthlyBookings) * 150)}px` }} />
                    <small>{item.month}</small>
                  </div>
                ))}
              </div>
              <div className="report-forecast"><b>Next-month demand estimate: {data.demandForecast.nextMonthBookings} bookings</b><span>Use this as a planning signal, not a guaranteed demand prediction.</span></div>
            </section>

            <section className="card">
              <div className="card-head"><div><h3>Pricing recommendation</h3><span>Based on selected-period occupancy</span></div></div>
              <div className="pricing-callout"><b>{data.pricingRecommendation.action}</b><span>Suggested multiplier: ×{data.pricingRecommendation.multiplier}</span></div>
              <Progress value={Math.min(100, data.occupancy.occupancyRate)} />
              <div className="report-rows"><div><span>Occupancy</span><b>{data.occupancy.occupancyRate}%</b></div><div><span>Room revenue</span><b>{money(data.revenue.roomRevenue)}</b></div><div><span>ADR</span><b>{money(data.revenue.adr)}</b></div></div>
            </section>

            <section className="card">
              <div className="card-head"><div><h3>Service performance</h3><span>Additional services sold with reservations</span></div></div>
              {(data.servicePerformance || []).length === 0 ? <p className="muted">No service sales were recorded in this period.</p> : <div className="analytics-list">{data.servicePerformance.map((item) => <div key={item.name}><div><b>{item.name}</b><span>{money(item.revenue)}</span></div><Progress value={(item.revenue / maxServiceRevenue) * 100} /></div>)}</div>}
            </section>

            <section className="card">
              <div className="card-head"><div><h3>Guest satisfaction</h3><span>Feedback from the selected period</span></div><Star size={18} /></div>
              <div className="rating"><b>{data.feedback.averageRating || '—'}</b><span>★★★★★</span></div>
              <p className="muted">{data.feedback.fiveStarPercent}% of submitted feedback is 5-star.</p>
              <div className="rating-bars"><div><span>5-star</span><Progress value={data.feedback.fiveStarPercent} /><b>{data.feedback.fiveStarPercent}%</b></div></div>
            </section>
          </div>

          <section className="card feedback-report-card">
            <div className="card-head"><div><h3>Recent guest feedback</h3><span>Qualitative signals for management decisions</span></div><Users size={18} /></div>
            {feedback.length === 0 ? <p className="muted">No feedback has been submitted in this period yet.</p> : <div className="feedback-list">{feedback.slice(0, 8).map((item) => <div className="feedback-row" key={item._id}><div className="guest-avatar">{(item.guest?.name || 'G').slice(0, 1).toUpperCase()}</div><div><b>{item.guest?.name || 'Guest'}</b><span>{item.comment || 'No written comment'} · {item.category}</span></div><Status>{item.rating}/5</Status></div>)}</div>}
          </section>
        </>
      )}
    </>
  );
}
