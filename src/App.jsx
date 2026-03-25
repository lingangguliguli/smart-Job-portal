import React, { useState, useEffect, useCallback, useContext, createContext, useMemo, useRef } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { FiHome, FiBriefcase, FiPlusCircle, FiBarChart2, FiSearch, FiEdit2, FiTrash2, FiBookmark, FiChevronLeft, FiChevronRight, FiX, FiCheck, FiFilter, FiArrowUp, FiArrowDown, FiMapPin, FiDollarSign, FiCalendar, FiStar, FiTrendingUp } from 'react-icons/fi';
import { format, parseISO, differenceInDays, startOfMonth, subMonths } from 'date-fns';

const THEME = {
  bg: { base: '#0D0D0F', surface: '#151518', elevated: '#1C1C21', overlay: 'rgba(13,13,15,0.85)' },
  accent: { primary: '#E8553A', primaryMuted: 'rgba(232,85,58,0.15)', primaryText: '#F4A393' },
  text: { primary: '#E8E6E3', secondary: '#9A9898', muted: '#5C5B5B', inverse: '#0D0D0F' },
  border: { subtle: '#1F1F24', default: '#2A2A30', strong: '#3A3A42' },
  status: {
    applied: { bg: 'rgba(96,165,250,0.12)', text: '#60A5FA', dot: '#60A5FA' },
    interviewing: { bg: 'rgba(251,191,36,0.12)', text: '#FBBF24', dot: '#FBBF24' },
    offer: { bg: 'rgba(52,211,153,0.12)', text: '#34D399', dot: '#34D399' },
    rejected: { bg: 'rgba(248,113,113,0.12)', text: '#F87171', dot: '#F87171' },
  },
  font: { display: "'Space Grotesk', sans-serif", body: "'DM Sans', sans-serif", mono: "'JetBrains Mono', monospace" },
  radius: { sm: '4px', md: '6px', lg: '10px' },
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', xxl: '48px' },
};

const GOOGLE_FONTS_CSS = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap');`;

const GLOBAL_STYLES = `
${GOOGLE_FONTS_CSS}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; background: ${THEME.bg.base}; color: ${THEME.text.primary}; font-family: ${THEME.font.body}; font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: ${THEME.border.default}; border-radius: 3px; }
input, select, textarea, button { font-family: inherit; font-size: inherit; }
@keyframes toastIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes toastOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(120%); opacity: 0; } }
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
`;

const PLATFORMS = ['LinkedIn', 'Company Career Page', 'Referral', 'Indeed', 'Glassdoor', 'AngelList'];
const STATUSES = ['Applied', 'Interviewing', 'Offer', 'Rejected'];
const PIPELINE_TABS = ['All', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Bookmarked'];
const ROWS_PER_PAGE = 8;

const generateId = () => Math.random().toString(36).substr(2, 9);

const INITIAL_DATA = [];

// ─── Hooks ───────────────────────────────────────────────

function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch { return initialValue; }
  });
  const setValue = useCallback((value) => {
    setStored((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      window.localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);
  return [stored, setValue];
}

function useDebounce(value, delay = 500) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function useApplications(initialData) {
  const [apps, setApps] = useLocalStorage('sjt_applications', initialData);
  const addApplication = useCallback((app) => {
    setApps((prev) => [{ ...app, id: generateId() }, ...prev]);
  }, [setApps]);
  const updateApplication = useCallback((id, updates) => {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  }, [setApps]);
  const deleteApplication = useCallback((id) => {
    setApps((prev) => prev.filter((a) => a.id !== id));
  }, [setApps]);
  const toggleBookmark = useCallback((id) => {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, bookmarked: !a.bookmarked } : a)));
  }, [setApps]);
  return { applications: apps, addApplication, updateApplication, deleteApplication, toggleBookmark };
}

// ─── Context ─────────────────────────────────────────────

const AppContext = createContext(null);

function ApplicationProvider({ children }) {
  const { applications, addApplication, updateApplication, deleteApplication, toggleBookmark } = useApplications(INITIAL_DATA);
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = 'success') => {
    const id = generateId();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const value = useMemo(() => ({ applications, addApplication, updateApplication, deleteApplication, toggleBookmark, toasts, showToast }), [applications, toasts, addApplication, updateApplication, deleteApplication, toggleBookmark, showToast]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within ApplicationProvider');
  return ctx;
}

// ─── Utility Components ──────────────────────────────────

function Toast({ toasts }) {
  return (
    <div style={{ position: 'fixed', bottom: THEME.spacing.lg, right: THEME.spacing.lg, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: THEME.spacing.sm }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ background: t.type === 'error' ? '#7F1D1D' : '#14532D', color: THEME.text.primary, padding: `${THEME.spacing.sm} ${THEME.spacing.md}`, borderRadius: THEME.radius.md, fontFamily: THEME.font.body, fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: THEME.spacing.sm, animation: 'toastIn 0.3s ease forwards', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: '260px' }}>
          {t.type === 'error' ? <FiX size={14} /> : <FiCheck size={14} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = THEME.status[status.toLowerCase()] || THEME.status.applied;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: s.text, fontFamily: THEME.font.body }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div style={{ background: THEME.bg.surface, border: `1px solid ${THEME.border.subtle}`, borderRadius: THEME.radius.md, padding: THEME.spacing.lg, flex: 1, minWidth: '180px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: THEME.spacing.sm }}>
        <span style={{ color: THEME.text.muted, fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: THEME.font.body }}>{label}</span>
        <span style={{ color: THEME.accent.primary, opacity: 0.7 }}>{icon}</span>
      </div>
      <div style={{ fontFamily: THEME.font.display, fontSize: '28px', fontWeight: 700, color: THEME.text.primary, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: THEME.text.muted, fontSize: '12px', marginTop: THEME.spacing.xs }}>{sub}</div>}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: 'center', padding: THEME.spacing.xxl, color: THEME.text.muted, fontFamily: THEME.font.body, fontSize: '14px' }}>
      <div style={{ fontSize: '32px', marginBottom: THEME.spacing.md, opacity: 0.3 }}>¯\_(ツ)_/¯</div>
      {message || 'Nothing here yet. Go apply to some jobs.'}
    </div>
  );
}

function Sidebar({ currentPage, onNavigate }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <FiHome size={18} /> },
    { id: 'applications', label: 'Applications', icon: <FiBriefcase size={18} /> },
    { id: 'add', label: 'Add New', icon: <FiPlusCircle size={18} /> },
    { id: 'analytics', label: 'Analytics', icon: <FiBarChart2 size={18} /> },
  ];
  return (
    <div style={{ width: '220px', height: '100vh', background: THEME.bg.surface, borderRight: `1px solid ${THEME.border.subtle}`, display: 'flex', flexDirection: 'column', position: 'fixed', left: 0, top: 0, zIndex: 100 }}>
      <div style={{ padding: `${THEME.spacing.lg} ${THEME.spacing.lg}`, borderBottom: `1px solid ${THEME.border.subtle}` }}>
        <div style={{ fontFamily: THEME.font.display, fontSize: '18px', fontWeight: 700, color: THEME.text.primary, display: 'flex', alignItems: 'center', gap: THEME.spacing.sm }}>
          <span style={{ color: THEME.accent.primary }}>◆</span> JobTracker
        </div>
        <div style={{ fontFamily: THEME.font.body, fontSize: '11px', color: THEME.text.muted, marginTop: '2px' }}>Track what matters</div>
      </div>
      <nav style={{ padding: `${THEME.spacing.md} 0`, flex: 1 }}>
        {navItems.map((item) => {
          const active = currentPage === item.id;
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)} style={{ display: 'flex', alignItems: 'center', gap: THEME.spacing.sm, width: '100%', padding: `10px ${THEME.spacing.lg}`, background: active ? THEME.accent.primaryMuted : 'transparent', color: active ? THEME.accent.primary : THEME.text.secondary, border: 'none', borderLeft: active ? `2px solid ${THEME.accent.primary}` : '2px solid transparent', cursor: 'pointer', fontSize: '13px', fontWeight: active ? 600 : 400, fontFamily: THEME.font.body, transition: 'all 0.15s ease', textAlign: 'left' }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = THEME.bg.elevated; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              {item.icon} {item.label}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: THEME.spacing.lg, borderTop: `1px solid ${THEME.border.subtle}`, fontSize: '11px', color: THEME.text.muted, fontFamily: THEME.font.mono }}>v1.0.0</div>
    </div>
  );
}

// ─── Chart Components ────────────────────────────────────

function ChartCard({ title, children }) {
  return (
    <div style={{ background: THEME.bg.surface, border: `1px solid ${THEME.border.subtle}`, borderRadius: THEME.radius.md, padding: THEME.spacing.lg, animation: 'fadeIn 0.3s ease' }}>
      <h3 style={{ fontFamily: THEME.font.display, fontSize: '14px', fontWeight: 600, color: THEME.text.primary, marginBottom: THEME.spacing.md }}>{title}</h3>
      {children}
    </div>
  );
}

const CHART_COLORS = [THEME.status.applied.dot, THEME.status.interviewing.dot, THEME.status.offer.dot, THEME.status.rejected.dot];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: THEME.bg.elevated, border: `1px solid ${THEME.border.default}`, borderRadius: THEME.radius.sm, padding: `${THEME.spacing.xs} ${THEME.spacing.sm}`, fontSize: '12px', fontFamily: THEME.font.body, color: THEME.text.primary }}>
      {label && <div style={{ color: THEME.text.secondary, marginBottom: '2px' }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || THEME.text.primary, fontWeight: 500 }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
}

function StatusPieChart({ applications }) {
  const data = STATUSES.map((s) => ({ name: s, value: applications.filter((a) => a.status === s).length })).filter((d) => d.value > 0);
  return (
    <ChartCard title="Status Distribution">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[STATUSES.indexOf(data[i]?.name) % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '12px', fontFamily: THEME.font.body, color: THEME.text.secondary }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function MonthlyChart({ applications }) {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    const key = format(d, 'MMM yyyy');
    const count = applications.filter((a) => { try { return format(parseISO(a.appliedDate), 'MMM yyyy') === key; } catch { return false; } }).length;
    months.push({ month: format(d, 'MMM'), count });
  }
  return (
    <ChartCard title="Applications Over Time">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={months} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke={THEME.border.subtle} />
          <XAxis dataKey="month" tick={{ fill: THEME.text.muted, fontSize: 11, fontFamily: THEME.font.body }} axisLine={{ stroke: THEME.border.subtle }} tickLine={false} />
          <YAxis tick={{ fill: THEME.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" name="Applications" fill={THEME.accent.primary} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function PlatformChart({ applications }) {
  const data = PLATFORMS.map((p) => ({ name: p, value: applications.filter((a) => a.platform === p).length })).filter((d) => d.value > 0);
  const colors = ['#60A5FA', '#FBBF24', '#34D399', '#F87171', '#A78BFA', '#FB923C'];
  return (
    <ChartCard title="By Platform">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={85} dataKey="value" stroke="none">
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '12px', fontFamily: THEME.font.body }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function SalaryChart({ applications }) {
  const ranges = [
    { label: '<₹20L', min: 0, max: 2000000 },
    { label: '₹20-25L', min: 2000000, max: 2500000 },
    { label: '₹25-30L', min: 2500000, max: 3000000 },
    { label: '₹30-40L', min: 3000000, max: 4000000 },
    { label: '₹40L+', min: 4000000, max: Infinity },
  ];
  const data = ranges.map((r) => ({ range: r.label, count: applications.filter((a) => a.salary >= r.min && a.salary < r.max).length }));
  return (
    <ChartCard title="Salary Distribution">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barSize={24}>
          <CartesianGrid strokeDasharray="3 3" stroke={THEME.border.subtle} />
          <XAxis dataKey="range" tick={{ fill: THEME.text.muted, fontSize: 10, fontFamily: THEME.font.body }} axisLine={{ stroke: THEME.border.subtle }} tickLine={false} />
          <YAxis tick={{ fill: THEME.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" name="Jobs" fill="#A78BFA" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Form ────────────────────────────────────────────────

function ApplicationForm({ editData, onDone }) {
  const { addApplication, updateApplication, showToast } = useApp();
  const isEdit = !!editData;
  const [form, setForm] = useState(editData || { company: '', role: '', location: '', salary: '', platform: 'LinkedIn', status: 'Applied', appliedDate: format(new Date(), 'yyyy-MM-dd'), interviewDate: '', notes: '', bookmarked: false });
  const [errors, setErrors] = useState({});

  const handleChange = useCallback((field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((err) => ({ ...err, [field]: '' }));
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    const errs = {};
    if (!form.company.trim()) errs.company = 'Company is required';
    if (!form.role.trim()) errs.role = 'Role is required';
    if (!form.appliedDate) errs.appliedDate = 'Applied date is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const payload = { ...form, salary: Number(form.salary) || 0 };
    if (isEdit) { updateApplication(editData.id, payload); showToast('Application updated'); }
    else { addApplication(payload); showToast('Application added'); }
    if (onDone) onDone();
  }, [form, isEdit, editData, addApplication, updateApplication, showToast, onDone]);

  const inputStyle = { width: '100%', padding: '10px 12px', background: THEME.bg.elevated, border: `1px solid ${THEME.border.default}`, borderRadius: THEME.radius.sm, color: THEME.text.primary, fontSize: '13px', fontFamily: THEME.font.body, outline: 'none', transition: 'border-color 0.15s' };
  const labelStyle = { fontSize: '12px', fontWeight: 500, color: THEME.text.secondary, marginBottom: '4px', display: 'block', fontFamily: THEME.font.body };
  const errStyle = { fontSize: '11px', color: THEME.status.rejected.text, marginTop: '4px' };

  return (
    <div style={{ maxWidth: '640px', animation: 'fadeIn 0.3s ease' }}>
      <h2 style={{ fontFamily: THEME.font.display, fontSize: '20px', fontWeight: 700, marginBottom: THEME.spacing.lg }}>{isEdit ? 'Edit Application' : 'Add Application'}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: THEME.spacing.md }}>
        <div>
          <label style={labelStyle}>Company Name *</label>
          <input style={{ ...inputStyle, borderColor: errors.company ? THEME.status.rejected.text : THEME.border.default }} value={form.company} onChange={handleChange('company')} placeholder="e.g. Stripe" />
          {errors.company && <div style={errStyle}>{errors.company}</div>}
        </div>
        <div>
          <label style={labelStyle}>Job Role *</label>
          <input style={{ ...inputStyle, borderColor: errors.role ? THEME.status.rejected.text : THEME.border.default }} value={form.role} onChange={handleChange('role')} placeholder="e.g. Frontend Engineer" />
          {errors.role && <div style={errStyle}>{errors.role}</div>}
        </div>
        <div>
          <label style={labelStyle}>Location</label>
          <input style={inputStyle} value={form.location} onChange={handleChange('location')} placeholder="e.g. Remote" />
        </div>
        <div>
          <label style={labelStyle}>Salary (Annual INR)</label>
          <input style={inputStyle} type="number" value={form.salary} onChange={handleChange('salary')} placeholder="e.g. 2500000" />
        </div>
        <div>
          <label style={labelStyle}>Platform</label>
          <select style={inputStyle} value={form.platform} onChange={handleChange('platform')}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select style={inputStyle} value={form.status} onChange={handleChange('status')}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Applied Date *</label>
          <input style={{ ...inputStyle, borderColor: errors.appliedDate ? THEME.status.rejected.text : THEME.border.default }} type="date" value={form.appliedDate} onChange={handleChange('appliedDate')} />
          {errors.appliedDate && <div style={errStyle}>{errors.appliedDate}</div>}
        </div>
        <div>
          <label style={labelStyle}>Interview Date</label>
          <input style={inputStyle} type="date" value={form.interviewDate} onChange={handleChange('interviewDate')} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Notes</label>
          <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={form.notes} onChange={handleChange('notes')} placeholder="Add any notes..." />
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: THEME.spacing.sm }}>
          <button type="submit" style={{ padding: '10px 24px', background: THEME.accent.primary, color: '#fff', border: 'none', borderRadius: THEME.radius.sm, fontWeight: 600, fontFamily: THEME.font.body, fontSize: '13px', cursor: 'pointer', transition: 'opacity 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
            {isEdit ? 'Save Changes' : 'Add Application'}
          </button>
          {onDone && (
            <button type="button" onClick={onDone} style={{ padding: '10px 24px', background: 'transparent', color: THEME.text.secondary, border: `1px solid ${THEME.border.default}`, borderRadius: THEME.radius.sm, fontWeight: 500, fontFamily: THEME.font.body, fontSize: '13px', cursor: 'pointer' }}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ─── Application Table ───────────────────────────────────

function ApplicationTable({ data, onEdit, onNavigate }) {
  const { deleteApplication, toggleBookmark, showToast } = useApp();
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / ROWS_PER_PAGE));
  const paged = data.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  useEffect(() => { setPage(1); }, [data.length]);

  const handleDelete = useCallback((id, name) => {
    deleteApplication(id);
    showToast(`Removed ${name}`);
  }, [deleteApplication, showToast]);

  const handleBookmark = useCallback((id) => {
    toggleBookmark(id);
  }, [toggleBookmark]);

  if (!data.length) return <EmptyState message="No applications match your filters. Try broadening your search." />;

  const thStyle = { padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: THEME.text.muted, textTransform: 'uppercase', letterSpacing: '0.6px', fontFamily: THEME.font.body, borderBottom: `1px solid ${THEME.border.default}`, whiteSpace: 'nowrap' };
  const tdStyle = { padding: '10px 12px', fontSize: '13px', borderBottom: `1px solid ${THEME.border.subtle}`, fontFamily: THEME.font.body, whiteSpace: 'nowrap' };
  const actionBtn = { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: THEME.radius.sm, transition: 'color 0.15s', display: 'inline-flex' };

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Company</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Applied</th>
              <th style={thStyle}>Salary</th>
              <th style={thStyle}>Platform</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((app) => (
              <tr key={app.id} style={{ transition: 'background 0.1s' }} onMouseEnter={(e) => e.currentTarget.style.background = THEME.bg.elevated} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <td style={{ ...tdStyle, fontWeight: 600, color: THEME.text.primary }}>{app.company}</td>
                <td style={{ ...tdStyle, color: THEME.text.secondary }}>{app.role}</td>
                <td style={tdStyle}><StatusBadge status={app.status} /></td>
                <td style={{ ...tdStyle, color: THEME.text.secondary, fontFamily: THEME.font.mono, fontSize: '12px' }}>{(() => { try { return format(parseISO(app.appliedDate), 'MMM dd'); } catch { return '—'; } })()}</td>
                <td style={{ ...tdStyle, color: THEME.text.secondary, fontFamily: THEME.font.mono, fontSize: '12px' }}>{app.salary ? `₹${(app.salary / 100000).toFixed(1)}L` : '—'}</td>
                <td style={{ ...tdStyle, color: THEME.text.muted, fontSize: '12px' }}>{app.platform}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                    <button style={{ ...actionBtn, color: app.bookmarked ? THEME.accent.primary : THEME.text.muted }} onClick={() => handleBookmark(app.id)} title="Bookmark"><FiBookmark size={14} fill={app.bookmarked ? THEME.accent.primary : 'none'} /></button>
                    <button style={{ ...actionBtn, color: THEME.text.muted }} onClick={() => onEdit(app)} onMouseEnter={(e) => e.currentTarget.style.color = THEME.text.primary} onMouseLeave={(e) => e.currentTarget.style.color = THEME.text.muted} title="Edit"><FiEdit2 size={14} /></button>
                    <button style={{ ...actionBtn, color: THEME.text.muted }} onClick={() => handleDelete(app.id, app.company)} onMouseEnter={(e) => e.currentTarget.style.color = THEME.status.rejected.text} onMouseLeave={(e) => e.currentTarget.style.color = THEME.text.muted} title="Delete"><FiTrash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${THEME.spacing.md} 0`, fontSize: '12px', color: THEME.text.muted, fontFamily: THEME.font.body }}>
          <span>{data.length} result{data.length !== 1 ? 's' : ''}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: THEME.spacing.sm }}>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ background: 'none', border: `1px solid ${THEME.border.default}`, borderRadius: THEME.radius.sm, padding: '4px 8px', color: page <= 1 ? THEME.text.muted : THEME.text.secondary, cursor: page <= 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center' }}><FiChevronLeft size={14} /></button>
            <span>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ background: 'none', border: `1px solid ${THEME.border.default}`, borderRadius: THEME.radius.sm, padding: '4px 8px', color: page >= totalPages ? THEME.text.muted : THEME.text.secondary, cursor: page >= totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center' }}><FiChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pages ───────────────────────────────────────────────

function DashboardPage({ onNavigate }) {
  const { applications } = useApp();
  const stats = useMemo(() => ({
    total: applications.length,
    interviewing: applications.filter((a) => a.status === 'Interviewing').length,
    offers: applications.filter((a) => a.status === 'Offer').length,
    rejected: applications.filter((a) => a.status === 'Rejected').length,
  }), [applications]);
  const recent = useMemo(() => [...applications].sort((a, b) => b.appliedDate.localeCompare(a.appliedDate)).slice(0, 5), [applications]);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: THEME.spacing.lg }}>
        <h1 style={{ fontFamily: THEME.font.display, fontSize: '24px', fontWeight: 700 }}>Dashboard</h1>
        <p style={{ color: THEME.text.muted, fontSize: '13px', marginTop: '4px' }}>Your job search at a glance</p>
      </div>
      <div style={{ display: 'flex', gap: THEME.spacing.md, marginBottom: THEME.spacing.lg, flexWrap: 'wrap' }}>
        <StatCard icon={<FiBriefcase size={18} />} label="Total Applied" value={stats.total} />
        <StatCard icon={<FiCalendar size={18} />} label="Interviews" value={stats.interviewing} sub={stats.interviewing ? 'Keep preparing!' : ''} />
        <StatCard icon={<FiStar size={18} />} label="Offers" value={stats.offers} sub={stats.offers ? 'Congrats!' : ''} />
        <StatCard icon={<FiTrendingUp size={18} />} label="Rejected" value={stats.rejected} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: THEME.spacing.md, marginBottom: THEME.spacing.lg }}>
        <StatusPieChart applications={applications} />
        <MonthlyChart applications={applications} />
      </div>
      <div style={{ background: THEME.bg.surface, border: `1px solid ${THEME.border.subtle}`, borderRadius: THEME.radius.md, padding: THEME.spacing.lg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: THEME.spacing.md }}>
          <h3 style={{ fontFamily: THEME.font.display, fontSize: '14px', fontWeight: 600 }}>Recent Applications</h3>
          <button onClick={() => onNavigate('applications')} style={{ background: 'none', border: 'none', color: THEME.accent.primary, fontSize: '12px', cursor: 'pointer', fontFamily: THEME.font.body, fontWeight: 500 }}>View all →</button>
        </div>
        {recent.map((app) => (
          <div key={app.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${THEME.border.subtle}` }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>{app.company}</span>
              <span style={{ color: THEME.text.muted, fontSize: '12px', marginLeft: THEME.spacing.sm }}>{app.role}</span>
            </div>
            <StatusBadge status={app.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ApplicationsPage({ onNavigate }) {
  const { applications } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [sortBy, setSortBy] = useState('appliedDate');
  const [sortDir, setSortDir] = useState('desc');
  const [activeTab, setActiveTab] = useState('All');
  const [editApp, setEditApp] = useState(null);
  const debouncedSearch = useDebounce(search, 500);

  const filtered = useMemo(() => {
    let list = [...applications];
    if (activeTab === 'Bookmarked') list = list.filter((a) => a.bookmarked);
    else if (activeTab !== 'All') list = list.filter((a) => a.status === activeTab);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((a) => a.company.toLowerCase().includes(q) || a.role.toLowerCase().includes(q));
    }
    if (statusFilter) list = list.filter((a) => a.status === statusFilter);
    if (platformFilter) list = list.filter((a) => a.platform === platformFilter);
    if (locationFilter) {
      if (locationFilter === 'Remote') list = list.filter((a) => a.location.toLowerCase().includes('remote'));
      else list = list.filter((a) => !a.location.toLowerCase().includes('remote'));
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'appliedDate') cmp = a.appliedDate.localeCompare(b.appliedDate);
      else if (sortBy === 'salary') cmp = (a.salary || 0) - (b.salary || 0);
      else if (sortBy === 'company') cmp = a.company.localeCompare(b.company);
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [applications, debouncedSearch, statusFilter, platformFilter, locationFilter, sortBy, sortDir, activeTab]);

  const hasBookmarks = applications.some((a) => a.bookmarked);
  const tabs = hasBookmarks ? PIPELINE_TABS : PIPELINE_TABS.filter((t) => t !== 'Bookmarked');

  const handleEdit = useCallback((app) => setEditApp(app), []);
  const handleEditDone = useCallback(() => setEditApp(null), []);
  const toggleSort = useCallback((field) => {
    if (sortBy === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  }, [sortBy]);

  if (editApp) return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <ApplicationForm editData={editApp} onDone={handleEditDone} />
    </div>
  );

  const selectStyle = { padding: '8px 10px', background: THEME.bg.elevated, border: `1px solid ${THEME.border.default}`, borderRadius: THEME.radius.sm, color: THEME.text.secondary, fontSize: '12px', fontFamily: THEME.font.body, outline: 'none', cursor: 'pointer' };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: THEME.spacing.lg }}>
        <div>
          <h1 style={{ fontFamily: THEME.font.display, fontSize: '24px', fontWeight: 700 }}>Applications</h1>
          <p style={{ color: THEME.text.muted, fontSize: '13px', marginTop: '4px' }}>{applications.length} total applications tracked</p>
        </div>
        <button onClick={() => onNavigate('add')} style={{ padding: '8px 16px', background: THEME.accent.primary, color: '#fff', border: 'none', borderRadius: THEME.radius.sm, fontWeight: 600, fontSize: '13px', fontFamily: THEME.font.body, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'opacity 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
          <FiPlusCircle size={14} /> Add New
        </button>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: THEME.spacing.md, borderBottom: `1px solid ${THEME.border.subtle}`, overflowX: 'auto' }}>
        {tabs.map((tab) => {
          const active = activeTab === tab;
          const count = tab === 'All' ? applications.length : tab === 'Bookmarked' ? applications.filter((a) => a.bookmarked).length : applications.filter((a) => a.status === tab).length;
          return (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 14px', background: 'none', border: 'none', borderBottom: active ? `2px solid ${THEME.accent.primary}` : '2px solid transparent', color: active ? THEME.text.primary : THEME.text.muted, fontSize: '12px', fontWeight: active ? 600 : 400, fontFamily: THEME.font.body, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>
              {tab} <span style={{ color: THEME.text.muted, fontSize: '11px', marginLeft: '4px' }}>{count}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: THEME.spacing.sm, marginBottom: THEME.spacing.md, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '300px' }}>
          <FiSearch size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: THEME.text.muted }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company or role..." style={{ width: '100%', padding: '8px 10px 8px 32px', background: THEME.bg.elevated, border: `1px solid ${THEME.border.default}`, borderRadius: THEME.radius.sm, color: THEME.text.primary, fontSize: '12px', fontFamily: THEME.font.body, outline: 'none' }} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} style={selectStyle}>
          <option value="">All Platforms</option>
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} style={selectStyle}>
          <option value="">All Locations</option>
          <option value="Remote">Remote</option>
          <option value="Onsite">On-site</option>
        </select>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[{ key: 'appliedDate', label: 'Date' }, { key: 'salary', label: 'Salary' }, { key: 'company', label: 'Name' }].map(({ key, label }) => (
            <button key={key} onClick={() => toggleSort(key)} style={{ padding: '6px 10px', background: sortBy === key ? THEME.accent.primaryMuted : 'transparent', border: `1px solid ${sortBy === key ? THEME.accent.primary : THEME.border.default}`, borderRadius: THEME.radius.sm, color: sortBy === key ? THEME.accent.primary : THEME.text.muted, fontSize: '11px', fontFamily: THEME.font.body, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: sortBy === key ? 600 : 400 }}>
              {label} {sortBy === key && (sortDir === 'desc' ? <FiArrowDown size={10} /> : <FiArrowUp size={10} />)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: THEME.bg.surface, border: `1px solid ${THEME.border.subtle}`, borderRadius: THEME.radius.md, overflow: 'hidden' }}>
        <ApplicationTable data={filtered} onEdit={handleEdit} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function AddPage({ onNavigate, editData }) {
  const handleDone = useCallback(() => onNavigate('applications'), [onNavigate]);
  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <ApplicationForm editData={editData} onDone={handleDone} />
    </div>
  );
}

function AnalyticsPage() {
  const { applications } = useApp();
  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: THEME.spacing.lg }}>
        <h1 style={{ fontFamily: THEME.font.display, fontSize: '24px', fontWeight: 700 }}>Analytics</h1>
        <p style={{ color: THEME.text.muted, fontSize: '13px', marginTop: '4px' }}>Detailed breakdown of your job search</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: THEME.spacing.md }}>
        <StatusPieChart applications={applications} />
        <MonthlyChart applications={applications} />
        <PlatformChart applications={applications} />
        <SalaryChart applications={applications} />
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const handleNavigate = useCallback((page) => setCurrentPage(page), []);

  return (
    <ApplicationProvider>
      <AppInner currentPage={currentPage} onNavigate={handleNavigate} />
    </ApplicationProvider>
  );
}

function AppInner({ currentPage, onNavigate }) {
  const { toasts } = useApp();

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage onNavigate={onNavigate} />;
      case 'applications': return <ApplicationsPage onNavigate={onNavigate} />;
      case 'add': return <AddPage onNavigate={onNavigate} />;
      case 'analytics': return <AnalyticsPage />;
      default: return <DashboardPage onNavigate={onNavigate} />;
    }
  };

  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
      <main style={{ marginLeft: '220px', padding: THEME.spacing.xl, minHeight: '100vh' }}>
        {renderPage()}
      </main>
      <Toast toasts={toasts} />
    </>
  );
}
