import React, { useState, useEffect, useCallback, useContext, createContext, useMemo, useRef } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { FiHome, FiBriefcase, FiPlusCircle, FiBarChart2, FiSearch, FiEdit2, FiTrash2, FiBookmark, FiChevronLeft, FiChevronRight, FiX, FiCheck, FiFilter, FiArrowUp, FiArrowDown, FiMapPin, FiDollarSign, FiCalendar, FiStar, FiTrendingUp, FiExternalLink, FiClock, FiGlobe, FiKey, FiRefreshCw } from 'react-icons/fi';
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

const JSEARCH_BASE_URL = 'https://jsearch.p.rapidapi.com/search';
const JSEARCH_HOST = 'jsearch.p.rapidapi.com';
const INDIA_CITIES = ['All India', 'Bangalore', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Pune', 'Chennai', 'Kolkata', 'Remote'];
const EMPLOYMENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'FULLTIME', label: 'Full-time' },
  { value: 'PARTTIME', label: 'Part-time' },
  { value: 'CONTRACTOR', label: 'Contract' },
  { value: 'INTERN', label: 'Internship' },
];
const POPULAR_SEARCHES = ['Software Engineer', 'Data Analyst', 'Product Manager', 'Frontend Developer', 'DevOps Engineer', 'UI/UX Designer', 'Backend Developer', 'Machine Learning'];

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

function useJobSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [employmentType, setEmploymentType] = useState('');
  const [location, setLocation] = useState('All India');
  const cache = useRef({});
  const debouncedQuery = useDebounce(query, 800);

  const getApiKey = useCallback(() => {
    try { return window.localStorage.getItem('sjt_rapidapi_key') || ''; }
    catch { return ''; }
  }, []);

  const fetchJobs = useCallback(async (searchQuery, pg, empType, loc) => {
    const apiKey = getApiKey();
    if (!apiKey) { setError('api_key_missing'); setResults([]); return; }
    if (!searchQuery.trim()) { setResults([]); setError(null); return; }

    const locationQuery = loc === 'All India' ? 'India' : loc === 'Remote' ? 'Remote India' : `${loc} India`;
    const cacheKey = `${searchQuery}|${pg}|${empType}|${locationQuery}`;
    if (cache.current[cacheKey]) {
      setResults(cache.current[cacheKey].data);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        query: `${searchQuery} in ${locationQuery}`,
        page: String(pg),
        num_pages: '1',
      });
      if (empType) params.append('employment_types', empType);

      const response = await fetch(`${JSEARCH_BASE_URL}?${params.toString()}`, {
        method: 'GET',
        headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': JSEARCH_HOST },
      });

      if (!response.ok) {
        if (response.status === 429) throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        if (response.status === 403 || response.status === 401) throw new Error('Invalid API key. Please update your RapidAPI key in settings.');
        throw new Error(`API error (${response.status}). Please try again.`);
      }

      const json = await response.json();
      const data = json.data || [];
      cache.current[cacheKey] = { data };
      setResults(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch jobs. Check your connection and try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [getApiKey]);

  useEffect(() => {
    if (debouncedQuery.trim()) {
      setPage(1);
      fetchJobs(debouncedQuery, 1, employmentType, location);
    } else {
      setResults([]);
      setError(null);
    }
  }, [debouncedQuery, employmentType, location, fetchJobs]);

  const goToPage = useCallback((pg) => {
    setPage(pg);
    fetchJobs(debouncedQuery, pg, employmentType, location);
  }, [debouncedQuery, employmentType, location, fetchJobs]);

  const clearCache = useCallback(() => { cache.current = {}; }, []);

  return { query, setQuery, results, loading, error, page, goToPage, employmentType, setEmploymentType, location, setLocation, refetch: () => { clearCache(); fetchJobs(query, page, employmentType, location); } };
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

function APIKeyModal({ onClose }) {
  const [key, setKey] = useState(() => {
    try { return window.localStorage.getItem('sjt_rapidapi_key') || ''; }
    catch { return ''; }
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    try { window.localStorage.setItem('sjt_rapidapi_key', key.trim()); }
    catch {}
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: THEME.bg.overlay, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }} onClick={onClose}>
      <div style={{ background: THEME.bg.surface, border: `1px solid ${THEME.border.default}`, borderRadius: THEME.radius.lg, padding: THEME.spacing.xl, width: '440px', maxWidth: '90vw', boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: THEME.spacing.lg }}>
          <h3 style={{ fontFamily: THEME.font.display, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: THEME.spacing.sm, color: THEME.text.primary }}>
            <FiKey size={16} style={{ color: THEME.accent.primary }} /> API Configuration
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: THEME.text.muted, cursor: 'pointer', padding: '4px' }}><FiX size={16} /></button>
        </div>
        <div style={{ background: THEME.bg.elevated, borderRadius: THEME.radius.md, padding: THEME.spacing.md, marginBottom: THEME.spacing.md, border: `1px solid ${THEME.border.subtle}` }}>
          <p style={{ fontSize: '12px', color: THEME.text.secondary, lineHeight: 1.7, margin: 0 }}>
            This app uses the <strong style={{ color: THEME.text.primary }}>JSearch API</strong> via RapidAPI to fetch real-time job listings. The free tier gives you <strong style={{ color: THEME.accent.primaryText }}>200 requests/month</strong>.
          </p>
          <a href="https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch" target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: THEME.accent.primary, textDecoration: 'none', fontSize: '12px', fontWeight: 500, marginTop: THEME.spacing.sm }}
          >
            Get your free API key <FiExternalLink size={11} />
          </a>
        </div>
        <label style={{ fontSize: '11px', fontWeight: 600, color: THEME.text.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>X-RapidAPI-Key</label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste your API key here..."
          style={{ width: '100%', padding: '10px 12px', background: THEME.bg.elevated, border: `1px solid ${THEME.border.default}`, borderRadius: THEME.radius.sm, color: THEME.text.primary, fontSize: '13px', fontFamily: THEME.font.mono, outline: 'none', marginBottom: THEME.spacing.md, transition: 'border-color 0.15s' }}
          onFocus={(e) => e.target.style.borderColor = THEME.accent.primary}
          onBlur={(e) => e.target.style.borderColor = THEME.border.default}
        />
        <button onClick={handleSave} disabled={!key.trim()} style={{ width: '100%', padding: '10px', background: saved ? '#14532D' : !key.trim() ? THEME.border.default : THEME.accent.primary, color: saved ? '#34D399' : '#fff', border: 'none', borderRadius: THEME.radius.sm, fontWeight: 600, fontSize: '13px', fontFamily: THEME.font.body, cursor: key.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: THEME.spacing.sm, transition: 'all 0.2s' }}>
          {saved ? <><FiCheck size={14} /> Saved!</> : 'Save API Key'}
        </button>
      </div>
    </div>
  );
}

function JobCard({ job, onTrack, tracked }) {
  const formatSalary = (min, max, currency) => {
    if (!min && !max) return null;
    const fmt = (v) => {
      if (!v) return null;
      if (currency === 'INR' || currency === 'inr') return `₹${(v / 100000).toFixed(1)}L`;
      if (currency === 'USD' || currency === 'usd') return `$${(v / 1000).toFixed(0)}K`;
      return `${currency || ''}${v.toLocaleString()}`;
    };
    const minF = fmt(min);
    const maxF = fmt(max);
    if (minF && maxF && minF !== maxF) return `${minF} – ${maxF}`;
    return minF || maxF;
  };

  const formatPostedDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const days = differenceInDays(new Date(), parseISO(dateStr));
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days}d ago`;
      if (days < 30) return `${Math.floor(days / 7)}w ago`;
      return `${Math.floor(days / 30)}mo ago`;
    } catch { return null; }
  };

  const empTypeMap = { FULLTIME: 'Full-time', PARTTIME: 'Part-time', CONTRACTOR: 'Contract', INTERN: 'Internship' };
  const empLabel = empTypeMap[job.job_employment_type] || job.job_employment_type || '';
  const locationStr = [job.job_city, job.job_state].filter(Boolean).join(', ') || 'India';
  const salary = formatSalary(job.job_min_salary, job.job_max_salary, job.job_salary_currency);
  const posted = formatPostedDate(job.job_posted_at_datetime_utc);
  const desc = (job.job_description || '').slice(0, 180).replace(/<[^>]*>/g, '');

  return (
    <div style={{ background: THEME.bg.surface, border: `1px solid ${THEME.border.subtle}`, borderRadius: THEME.radius.lg, padding: THEME.spacing.lg, animation: 'fadeIn 0.3s ease', transition: 'border-color 0.2s, box-shadow 0.2s' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = THEME.border.strong; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = THEME.border.subtle; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', gap: THEME.spacing.md }}>
        <div style={{ width: '44px', height: '44px', borderRadius: THEME.radius.md, background: THEME.bg.elevated, border: `1px solid ${THEME.border.subtle}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
          {job.employer_logo
            ? <img src={job.employer_logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }} />
            : null
          }
          <div style={{ display: job.employer_logo ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontFamily: THEME.font.display, fontWeight: 700, fontSize: '16px', color: THEME.accent.primary }}>
            {(job.employer_name || '?')[0].toUpperCase()}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontFamily: THEME.font.display, fontSize: '15px', fontWeight: 600, color: THEME.text.primary, margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.job_title}</h3>
          <p style={{ fontSize: '13px', color: THEME.text.secondary, margin: '2px 0 0', fontWeight: 500 }}>{job.employer_name}</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: THEME.spacing.sm }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: THEME.text.muted, background: THEME.bg.elevated, padding: '3px 8px', borderRadius: '20px' }}>
          <FiMapPin size={10} /> {locationStr}
        </span>
        {empLabel && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: THEME.status.applied.text, background: THEME.status.applied.bg, padding: '3px 8px', borderRadius: '20px' }}>{empLabel}</span>}
        {salary && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: THEME.status.offer.text, background: THEME.status.offer.bg, padding: '3px 8px', borderRadius: '20px' }}><FiDollarSign size={10} /> {salary}</span>}
        {posted && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: THEME.text.muted, background: THEME.bg.elevated, padding: '3px 8px', borderRadius: '20px' }}><FiClock size={10} /> {posted}</span>}
      </div>

      {desc && <p style={{ fontSize: '12px', color: THEME.text.muted, lineHeight: 1.6, marginTop: THEME.spacing.sm, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{desc}...</p>}

      <div style={{ display: 'flex', gap: THEME.spacing.sm, marginTop: THEME.spacing.md }}>
        {job.job_apply_link && (
          <a href={job.job_apply_link} target="_blank" rel="noopener noreferrer"
            style={{ flex: 1, padding: '8px 12px', background: THEME.accent.primary, color: '#fff', border: 'none', borderRadius: THEME.radius.sm, fontWeight: 600, fontSize: '12px', fontFamily: THEME.font.body, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'opacity 0.15s', textAlign: 'center' }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Apply <FiExternalLink size={12} />
          </a>
        )}
        <button onClick={() => onTrack(job)} disabled={tracked}
          style={{ flex: 1, padding: '8px 12px', background: tracked ? THEME.status.offer.bg : 'transparent', color: tracked ? THEME.status.offer.text : THEME.text.secondary, border: `1px solid ${tracked ? THEME.status.offer.text : THEME.border.default}`, borderRadius: THEME.radius.sm, fontWeight: 500, fontSize: '12px', fontFamily: THEME.font.body, cursor: tracked ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s' }}
          onMouseEnter={(e) => { if (!tracked) { e.currentTarget.style.borderColor = THEME.accent.primary; e.currentTarget.style.color = THEME.accent.primary; } }}
          onMouseLeave={(e) => { if (!tracked) { e.currentTarget.style.borderColor = THEME.border.default; e.currentTarget.style.color = THEME.text.secondary; } }}
        >
          {tracked ? <><FiCheck size={12} /> Tracked</> : <><FiPlusCircle size={12} /> Track</>}
        </button>
      </div>
    </div>
  );
}

function JobCardSkeleton() {
  const shimmer = { background: `linear-gradient(90deg, ${THEME.bg.elevated} 25%, ${THEME.border.subtle} 50%, ${THEME.bg.elevated} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: THEME.radius.sm };
  return (
    <div style={{ background: THEME.bg.surface, border: `1px solid ${THEME.border.subtle}`, borderRadius: THEME.radius.lg, padding: THEME.spacing.lg }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div style={{ display: 'flex', gap: THEME.spacing.md }}>
        <div style={{ ...shimmer, width: '44px', height: '44px', borderRadius: THEME.radius.md }} />
        <div style={{ flex: 1 }}>
          <div style={{ ...shimmer, height: '16px', width: '70%', marginBottom: '8px' }} />
          <div style={{ ...shimmer, height: '14px', width: '40%' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', marginTop: THEME.spacing.sm }}>
        <div style={{ ...shimmer, height: '20px', width: '80px', borderRadius: '20px' }} />
        <div style={{ ...shimmer, height: '20px', width: '60px', borderRadius: '20px' }} />
      </div>
      <div style={{ ...shimmer, height: '12px', width: '100%', marginTop: THEME.spacing.sm }} />
      <div style={{ ...shimmer, height: '12px', width: '80%', marginTop: '4px' }} />
      <div style={{ display: 'flex', gap: THEME.spacing.sm, marginTop: THEME.spacing.md }}>
        <div style={{ ...shimmer, height: '34px', flex: 1, borderRadius: THEME.radius.sm }} />
        <div style={{ ...shimmer, height: '34px', flex: 1, borderRadius: THEME.radius.sm }} />
      </div>
    </div>
  );
}

function Sidebar({ currentPage, onNavigate, onApiKeyClick }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <FiHome size={18} /> },
    { id: 'applications', label: 'Applications', icon: <FiBriefcase size={18} /> },
    { id: 'jobsearch', label: 'Job Search', icon: <FiGlobe size={18} /> },
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
      <div style={{ padding: `${THEME.spacing.sm} ${THEME.spacing.lg}`, borderTop: `1px solid ${THEME.border.subtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: THEME.text.muted, fontFamily: THEME.font.mono }}>v1.1.0</span>
        {onApiKeyClick && <button onClick={onApiKeyClick} title="API Key Settings" style={{ background: 'none', border: 'none', color: THEME.text.muted, cursor: 'pointer', padding: '4px', borderRadius: THEME.radius.sm, display: 'flex', transition: 'color 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.color = THEME.accent.primary} onMouseLeave={(e) => e.currentTarget.style.color = THEME.text.muted}><FiKey size={14} /></button>}
      </div>
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

// ─── Job Search Page ─────────────────────────────────────

function JobSearchPage({ onNavigate }) {
  const { addApplication, showToast } = useApp();
  const { query, setQuery, results, loading, error, page, goToPage, employmentType, setEmploymentType, location, setLocation, refetch } = useJobSearch();
  const [trackedIds, setTrackedIds] = useState(new Set());
  const [showApiModal, setShowApiModal] = useState(false);

  const handleTrack = useCallback((job) => {
    const loc = [job.job_city, job.job_state].filter(Boolean).join(', ') || 'India';
    const app = {
      company: job.employer_name || 'Unknown',
      role: job.job_title || 'Unknown Role',
      location: loc,
      salary: job.job_max_salary || job.job_min_salary || 0,
      platform: 'Job Search',
      status: 'Applied',
      appliedDate: format(new Date(), 'yyyy-MM-dd'),
      interviewDate: '',
      notes: job.job_apply_link ? `Apply link: ${job.job_apply_link}` : '',
      bookmarked: false,
    };
    addApplication(app);
    setTrackedIds((prev) => new Set(prev).add(job.job_id));
    showToast(`Tracking: ${job.employer_name} — ${job.job_title}`);
  }, [addApplication, showToast]);

  const chipStyle = (active) => ({
    padding: '6px 14px',
    background: active ? THEME.accent.primaryMuted : THEME.bg.elevated,
    border: `1px solid ${active ? THEME.accent.primary : THEME.border.default}`,
    borderRadius: '20px',
    color: active ? THEME.accent.primary : THEME.text.secondary,
    fontSize: '12px',
    fontWeight: active ? 600 : 400,
    fontFamily: THEME.font.body,
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  });

  const hasApiKey = (() => { try { return !!window.localStorage.getItem('sjt_rapidapi_key'); } catch { return false; } })();

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {showApiModal && <APIKeyModal onClose={() => setShowApiModal(false)} />}

      <div style={{ marginBottom: THEME.spacing.lg }}>
        <h1 style={{ fontFamily: THEME.font.display, fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: THEME.spacing.sm }}>
          <FiGlobe size={22} style={{ color: THEME.accent.primary }} /> Job Search
        </h1>
        <p style={{ color: THEME.text.muted, fontSize: '13px', marginTop: '4px' }}>Discover real-time job openings across India</p>
      </div>

      {!hasApiKey && (
        <div style={{ background: `linear-gradient(135deg, ${THEME.accent.primaryMuted}, ${THEME.bg.surface})`, border: `1px solid ${THEME.accent.primary}40`, borderRadius: THEME.radius.lg, padding: THEME.spacing.xl, marginBottom: THEME.spacing.lg, textAlign: 'center' }}>
          <FiKey size={32} style={{ color: THEME.accent.primary, marginBottom: THEME.spacing.sm }} />
          <h3 style={{ fontFamily: THEME.font.display, fontSize: '16px', fontWeight: 600, marginBottom: THEME.spacing.sm }}>Set Up Your API Key</h3>
          <p style={{ fontSize: '13px', color: THEME.text.secondary, maxWidth: '400px', margin: '0 auto', marginBottom: THEME.spacing.md, lineHeight: 1.6 }}>Get free access to real-time job listings. Sign up at RapidAPI and subscribe to JSearch (200 free requests/month).</p>
          <button onClick={() => setShowApiModal(true)} style={{ padding: '10px 24px', background: THEME.accent.primary, color: '#fff', border: 'none', borderRadius: THEME.radius.sm, fontWeight: 600, fontSize: '13px', fontFamily: THEME.font.body, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <FiKey size={14} /> Configure API Key
          </button>
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: THEME.spacing.md }}>
        <FiSearch size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: THEME.text.muted }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search jobs... e.g. React Developer, Data Analyst, Product Manager"
          style={{ width: '100%', padding: '12px 14px 12px 40px', background: THEME.bg.surface, border: `1px solid ${THEME.border.default}`, borderRadius: THEME.radius.md, color: THEME.text.primary, fontSize: '14px', fontFamily: THEME.font.body, outline: 'none', transition: 'border-color 0.2s' }}
          onFocus={(e) => e.target.style.borderColor = THEME.accent.primary}
          onBlur={(e) => e.target.style.borderColor = THEME.border.default}
        />
        {loading && <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: THEME.accent.primary, animation: 'spin 1s linear infinite' }}><FiRefreshCw size={16} /></div>}
        <style>{`@keyframes spin { from { transform: translateY(-50%) rotate(0deg); } to { transform: translateY(-50%) rotate(360deg); } }`}</style>
      </div>

      {!query && (
        <div style={{ marginBottom: THEME.spacing.lg }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: THEME.text.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: THEME.spacing.sm }}>Popular Searches</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {POPULAR_SEARCHES.map((s) => (
              <button key={s} onClick={() => setQuery(s)} style={{ ...chipStyle(false), background: THEME.bg.surface }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = THEME.accent.primary; e.currentTarget.style.color = THEME.accent.primary; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = THEME.border.default; e.currentTarget.style.color = THEME.text.secondary; }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: THEME.spacing.lg, marginBottom: THEME.spacing.md, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: THEME.text.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: THEME.spacing.xs }}>Location</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {INDIA_CITIES.map((city) => (
              <button key={city} onClick={() => setLocation(city)} style={chipStyle(location === city)}>{city}</button>
            ))}
          </div>
        </div>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: THEME.text.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: THEME.spacing.xs }}>Type</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {EMPLOYMENT_TYPES.map((t) => (
              <button key={t.value} onClick={() => setEmploymentType(t.value)} style={chipStyle(employmentType === t.value)}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {error && error !== 'api_key_missing' && (
        <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: THEME.radius.md, padding: THEME.spacing.md, marginBottom: THEME.spacing.md, display: 'flex', alignItems: 'center', gap: THEME.spacing.sm }}>
          <FiX size={16} style={{ color: THEME.status.rejected.text, flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: THEME.status.rejected.text, flex: 1 }}>{error}</span>
          <button onClick={refetch} style={{ background: 'none', border: `1px solid ${THEME.status.rejected.text}`, borderRadius: THEME.radius.sm, color: THEME.status.rejected.text, padding: '4px 12px', fontSize: '12px', cursor: 'pointer', fontFamily: THEME.font.body, fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}><FiRefreshCw size={12} /> Retry</button>
        </div>
      )}

      {error === 'api_key_missing' && hasApiKey === false && !query && null}

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: THEME.spacing.md }}>
          {[1, 2, 3, 4, 5, 6].map((i) => <JobCardSkeleton key={i} />)}
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          <p style={{ fontSize: '12px', color: THEME.text.muted, marginBottom: THEME.spacing.md }}>
            Showing {results.length} result{results.length !== 1 ? 's' : ''} for <strong style={{ color: THEME.text.secondary }}>"{query}"</strong> in <strong style={{ color: THEME.text.secondary }}>{location}</strong>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: THEME.spacing.md }}>
            {results.map((job) => (
              <JobCard key={job.job_id} job={job} onTrack={handleTrack} tracked={trackedIds.has(job.job_id)} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: THEME.spacing.sm, marginTop: THEME.spacing.lg, paddingBottom: THEME.spacing.lg }}>
            <button disabled={page <= 1} onClick={() => goToPage(page - 1)} style={{ background: 'none', border: `1px solid ${THEME.border.default}`, borderRadius: THEME.radius.sm, padding: '8px 14px', color: page <= 1 ? THEME.text.muted : THEME.text.secondary, cursor: page <= 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontFamily: THEME.font.body }}><FiChevronLeft size={14} /> Previous</button>
            <span style={{ fontSize: '13px', color: THEME.text.secondary, fontFamily: THEME.font.mono, padding: '0 8px' }}>Page {page}</span>
            <button disabled={results.length < 10} onClick={() => goToPage(page + 1)} style={{ background: 'none', border: `1px solid ${THEME.border.default}`, borderRadius: THEME.radius.sm, padding: '8px 14px', color: results.length < 10 ? THEME.text.muted : THEME.text.secondary, cursor: results.length < 10 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontFamily: THEME.font.body }}>Next <FiChevronRight size={14} /></button>
          </div>
        </>
      )}

      {!loading && !error && query && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: THEME.spacing.xxl, color: THEME.text.muted }}>
          <div style={{ fontSize: '40px', marginBottom: THEME.spacing.md, opacity: 0.3 }}>🔍</div>
          <h3 style={{ fontFamily: THEME.font.display, fontSize: '16px', fontWeight: 600, color: THEME.text.secondary, marginBottom: THEME.spacing.sm }}>No jobs found</h3>
          <p style={{ fontSize: '13px', maxWidth: '300px', margin: '0 auto' }}>Try different keywords or broaden your location filter.</p>
        </div>
      )}

      {!query && !loading && (
        <div style={{ textAlign: 'center', padding: THEME.spacing.xxl, color: THEME.text.muted }}>
          <div style={{ fontSize: '40px', marginBottom: THEME.spacing.md, opacity: 0.3 }}>💼</div>
          <h3 style={{ fontFamily: THEME.font.display, fontSize: '16px', fontWeight: 600, color: THEME.text.secondary, marginBottom: THEME.spacing.sm }}>Search for jobs</h3>
          <p style={{ fontSize: '13px', maxWidth: '360px', margin: '0 auto' }}>Enter a job title or keyword above to discover real-time openings across India. Click "Track" to add jobs to your application list.</p>
        </div>
      )}
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
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage onNavigate={onNavigate} />;
      case 'applications': return <ApplicationsPage onNavigate={onNavigate} />;
      case 'jobsearch': return <JobSearchPage onNavigate={onNavigate} />;
      case 'add': return <AddPage onNavigate={onNavigate} />;
      case 'analytics': return <AnalyticsPage />;
      default: return <DashboardPage onNavigate={onNavigate} />;
    }
  };

  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} onApiKeyClick={() => setShowApiKeyModal(true)} />
      <main style={{ marginLeft: '220px', padding: THEME.spacing.xl, minHeight: '100vh' }}>
        {renderPage()}
      </main>
      <Toast toasts={toasts} />
      {showApiKeyModal && <APIKeyModal onClose={() => setShowApiKeyModal(false)} />}
    </>
  );
}
