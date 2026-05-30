import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Plus, AlertTriangle, TrendingUp, CheckCircle2, XCircle, Zap, CreditCard,
  CalendarClock, ArrowRight, Bell, Eye, RotateCcw, ChevronRight,
} from 'lucide-react';
import { api, getCategoryLabel, getTypeLabel, formatError } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import AddItemModal from '../components/AddItemModal';

/* ─────────────────────── Status colors ─────────────────────── */
const STATUS_META = {
  safe:     { label: 'Safe',     dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  ring: 'ring-emerald-100' },
  warning:  { label: 'Warning',  dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',    ring: 'ring-amber-100' },
  urgent:   { label: 'Urgent',   dot: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50',   ring: 'ring-orange-100' },
  critical: { label: 'Critical', dot: 'bg-rose-500',    text: 'text-rose-700',    bg: 'bg-rose-50',     ring: 'ring-rose-100' },
  expired:  { label: 'Expired',  dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-100',   ring: 'ring-slate-200' },
};

/* ─────────────────────── Segments ─────────────────────── */
const SEGMENTS = [
  { key: 'total_active',      label: 'Active',           icon: TrendingUp,    accent: 'text-blue-600',    activeBg: 'bg-blue-50/70',    activeBar: 'bg-blue-500' },
  { key: 'expiring_soon',     label: 'Expiring',         icon: AlertTriangle, accent: 'text-amber-600',   activeBg: 'bg-amber-50/70',   activeBar: 'bg-amber-500' },
  { key: 'critical',          label: 'Critical',         icon: Zap,           accent: 'text-rose-600',    activeBg: 'bg-rose-50/70',    activeBar: 'bg-rose-500' },
  { key: 'expired',           label: 'Expired',          icon: XCircle,       accent: 'text-slate-600',   activeBg: 'bg-slate-100/80',  activeBar: 'bg-slate-500' },
  { key: 'upcoming_payments', label: 'Payments',         icon: CreditCard,    accent: 'text-purple-600',  activeBg: 'bg-purple-50/70',  activeBar: 'bg-purple-500' },
];

const FILTER_LABELS = {
  total_active:      'Active items',
  expiring_soon:     'Expiring soon',
  critical:          'Critical & urgent',
  expired:           'Expired items',
  upcoming_payments: 'Upcoming payments',
  default:           'All items',
};

function applyFilter(items, key) {
  if (!key) return items;
  switch (key) {
    case 'total_active':      return items.filter(i => i.status !== 'expired');
    case 'expiring_soon':     return items.filter(i => ['warning', 'urgent', 'critical'].includes(i.status));
    case 'critical':          return items.filter(i => ['critical', 'urgent'].includes(i.status));
    case 'expired':           return items.filter(i => i.status === 'expired');
    case 'upcoming_payments': return items.filter(i => i.item_type === 'payment' && i.status !== 'expired');
    default:                  return items;
  }
}

const TIMELINE_GROUPS = [
  { key: 'today',  label: 'Today',         test: d => d !== null && d <= 0 },
  { key: 'd3',     label: 'Next 3 days',   test: d => d !== null && d > 0 && d <= 3 },
  { key: 'd10',    label: 'Next 10 days',  test: d => d !== null && d > 3 && d <= 10 },
  { key: 'd30',    label: 'Next 30 days',  test: d => d !== null && d > 10 && d <= 30 },
];

function relatedLabel(item) {
  if (item.item_type === 'vehicle_doc' && item.vehicle_name) {
    return item.license_plate ? `${item.vehicle_name} · ${item.license_plate}` : item.vehicle_name;
  }
  return getCategoryLabel(item.item_type, item.category) || getTypeLabel(item.item_type);
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function daysLabel(item) {
  const d = item.days_remaining;
  if (d === null || d === undefined) return '—';
  if (d < 0)  return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'Today';
  return `${d}d left`;
}

/* ─────────────────────── Dashboard ─────────────────────── */
export default function Dashboard() {
  const { user }          = useAuth();
  const { openAddModal }  = useModal();
  const navigate          = useNavigate();
  const [data, setData]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [editItem, setEditItem] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [sendingId, setSendingId] = useState(null);

  const load = async () => {
    try { const r = await api.get('/api/dashboard'); setData(r.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    try { await api.delete(`/api/items/${item.id}`); load(); } catch (e) { console.error(e); }
  };

  const handleSendReminder = async (item) => {
    const recipient = item.reminder_email || user?.email;
    if (!recipient) { toast.error('No reminder email available'); return; }
    setSendingId(item.id);
    try {
      await api.post('/api/email/test-reminder', { item_id: item.id, recipient_email: recipient });
      toast.success(`Reminder sent to ${recipient}`);
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setSendingId(null);
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const summary  = data?.summary || {};
  const allItems = data?.all_items || [];

  /* Next action: highest priority item */
  const nextAction = useMemo(() => {
    const order = { critical: 0, urgent: 1, warning: 2, expired: 3, safe: 4 };
    const candidates = allItems.filter(i => i.status !== 'safe');
    return candidates.sort(
      (a, b) => (order[a.status] - order[b.status]) || ((a.days_remaining ?? 9999) - (b.days_remaining ?? 9999))
    )[0] || null;
  }, [allItems]);

  /* Filtered list */
  const visibleList = useMemo(() => applyFilter(allItems, activeFilter), [activeFilter, allItems]);
  const sectionTitle = activeFilter ? FILTER_LABELS[activeFilter] : FILTER_LABELS.default;

  /* Timeline groups */
  const timeline = useMemo(() => {
    const items = allItems.filter(i => i.status !== 'safe' || (i.days_remaining !== null && i.days_remaining <= 30));
    return TIMELINE_GROUPS.map(g => ({ ...g, items: items.filter(i => g.test(i.days_remaining)) }));
  }, [allItems]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main data-testid="dashboard-page" className="relative">

      {/* ── Premium ambient hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-white via-slate-50/60 to-blue-50/30 border-b border-slate-100/80">
        <motion.div
          aria-hidden
          animate={{ x: [0, 60, 0], y: [0, -20, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-24 -left-20 w-[460px] h-[460px] rounded-full blur-[120px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.16) 0%, transparent 70%)' }}
        />
        <motion.div
          aria-hidden
          animate={{ x: [0, -50, 0], y: [0, 24, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute -top-10 right-0 w-[380px] h-[380px] rounded-full blur-[110px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 70%)' }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:56px_56px] opacity-50 pointer-events-none" />

        <div className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-8 py-9 md:py-11">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
            className="flex items-end justify-between gap-6 flex-wrap"
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#64748B] mb-1.5">
                {greeting()}
              </p>
              <h1 className="font-['Outfit'] text-2xl md:text-3xl lg:text-4xl font-bold text-[#0F172A] tracking-tight leading-tight">
                {user?.full_name?.split(' ')[0] || 'Welcome'}
              </h1>
            </div>
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              data-testid="dashboard-add-btn"
              onClick={() => openAddModal()}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-shadow duration-200"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6, #06B6D4)', boxShadow: '0 6px 22px rgba(99,102,241,0.32)' }}
            >
              <Plus size={16} strokeWidth={2.5} /> Add Item
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 space-y-8">

        {/* Status Overview — single segmented panel */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          data-testid="status-overview"
          className="rounded-2xl bg-white border border-slate-100 overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-slate-100">
            {SEGMENTS.map((s) => {
              const isActive = activeFilter === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  data-testid={`status-segment-${s.key}`}
                  onClick={() => setActiveFilter(prev => prev === s.key ? null : s.key)}
                  className={`relative text-left px-5 py-4 transition-colors duration-200 ${isActive ? s.activeBg : 'hover:bg-slate-50/60'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#64748B]">{s.label}</p>
                      <p className="text-2xl font-['Outfit'] font-bold text-[#0F172A] leading-none mt-1.5">
                        {summary[s.key] ?? 0}
                      </p>
                    </div>
                    <s.icon size={16} strokeWidth={2} className={`${s.accent} opacity-70`} />
                  </div>
                  {isActive && (
                    <motion.div
                      layoutId="segment-bar"
                      className={`absolute bottom-0 left-3 right-3 h-[2px] rounded-full ${s.activeBar}`}
                      transition={{ duration: 0.25 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* Next Action panel */}
        <NextActionPanel
          item={nextAction}
          sendingId={sendingId}
          onView={(it) => navigate(`/items/${it.id}`)}
          onRenew={(it) => setEditItem(it)}
          onSendReminder={handleSendReminder}
          onAdd={() => openAddModal()}
        />

        {/* Priority Timeline */}
        <PriorityTimeline timeline={timeline} onItemClick={(it) => navigate(`/items/${it.id}`)} />

        {/* Items list (filterable table) */}
        <ItemsTable
          items={visibleList}
          title={sectionTitle}
          activeFilter={activeFilter}
          onClearFilter={() => setActiveFilter(null)}
          onEdit={(it) => setEditItem(it)}
          onDelete={handleDelete}
          onView={(it) => navigate(`/items/${it.id}`)}
          onAdd={() => openAddModal()}
        />
      </div>

      {editItem && (
        <AddItemModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); load(); }}
        />
      )}
    </main>
  );
}

/* ═════════════════════ Next Action ═════════════════════ */
function NextActionPanel({ item, sendingId, onView, onRenew, onSendReminder, onAdd }) {
  if (!item) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        data-testid="next-action-panel"
        className="rounded-2xl bg-gradient-to-br from-emerald-50/60 to-white border border-emerald-100 px-6 py-5 flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 size={18} strokeWidth={2} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Next action</p>
            <p className="font-['Outfit'] text-base font-semibold text-[#0F172A] mt-0.5">All important deadlines are under control.</p>
          </div>
        </div>
        <button
          onClick={onAdd}
          data-testid="next-action-add-btn"
          className="text-sm font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
        >
          Add item <ArrowRight size={14} />
        </button>
      </motion.section>
    );
  }

  const meta = STATUS_META[item.status] || STATUS_META.safe;
  const days = item.days_remaining;
  const phrase = days === null
    ? 'has no scheduled date'
    : days < 0 ? `expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
    : days === 0 ? 'is due today'
    : `expires in ${days} day${days === 1 ? '' : 's'}`;

  const related = relatedLabel(item);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.05 }}
      data-testid="next-action-panel"
      className="relative overflow-hidden rounded-2xl bg-white border border-slate-100"
      style={{ boxShadow: '0 8px 28px rgba(15,23,42,0.05)' }}
    >
      {/* Soft side accent gradient */}
      <div
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: 'linear-gradient(180deg, #6366F1, #8B5CF6, #06B6D4)' }}
      />
      <motion.div
        aria-hidden
        animate={{ opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -right-10 -top-10 w-60 h-60 rounded-full blur-[80px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 px-6 md:px-8 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748B]">Next action</p>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${meta.bg} ${meta.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label}
            </span>
          </div>
          <h2 className="font-['Outfit'] text-lg md:text-xl font-semibold text-[#0F172A] leading-snug">
            Your <span className="font-bold">{item.title}</span>
            {related && <span className="text-[#64748B] font-normal"> · {related}</span>}{' '}
            <span className="text-[#64748B] font-normal">{phrase}.</span>
          </h2>
          <p className="text-sm text-[#94A3B8] mt-1">{formatDate(item.expiration_date || item.due_date)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            data-testid="next-action-view-btn"
            onClick={() => onView(item)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0F172A] text-xs font-semibold transition-colors"
          >
            <Eye size={13} /> View
          </button>
          <button
            data-testid="next-action-renew-btn"
            onClick={() => onRenew(item)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-[#0F172A] text-xs font-semibold transition-colors"
          >
            <RotateCcw size={13} /> Renew
          </button>
          <button
            data-testid="next-action-reminder-btn"
            onClick={() => onSendReminder(item)}
            disabled={sendingId === item.id}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-xs font-semibold transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', boxShadow: '0 4px 14px rgba(99,102,241,0.28)' }}
          >
            <Bell size={13} /> {sendingId === item.id ? 'Sending…' : 'Send reminder'}
          </button>
        </div>
      </div>
    </motion.section>
  );
}

/* ═════════════════════ Priority Timeline ═════════════════════ */
function PriorityTimeline({ timeline, onItemClick }) {
  const total = timeline.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1 }}
      data-testid="priority-timeline"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-[#64748B]" strokeWidth={2} />
          <h2 className="font-['Outfit'] text-base font-semibold text-[#0F172A] tracking-tight">Priority timeline</h2>
        </div>
        <p className="text-xs text-[#94A3B8]">{total} item{total !== 1 ? 's' : ''} in the next 30 days</p>
      </div>

      {total === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 px-6 py-8 text-center">
          <p className="text-sm text-[#64748B]">Nothing scheduled in the next 30 days.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {timeline.map((group) => (
            <div
              key={group.key}
              data-testid={`timeline-group-${group.key}`}
              className="rounded-2xl bg-white border border-slate-100 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">{group.label}</p>
                <span className="text-[11px] font-semibold text-[#94A3B8]">{group.items.length}</span>
              </div>
              {group.items.length === 0 ? (
                <p className="text-xs text-[#CBD5E1]">No items</p>
              ) : (
                <ul className="space-y-2.5">
                  {group.items.slice(0, 5).map((it) => {
                    const meta = STATUS_META[it.status];
                    return (
                      <li
                        key={it.id}
                        onClick={() => onItemClick(it)}
                        className="group cursor-pointer flex items-center gap-2.5 -mx-1 px-1 py-1 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#0F172A] truncate">{it.title}</p>
                          <p className="text-[11px] text-[#94A3B8] truncate">{relatedLabel(it)}</p>
                        </div>
                        <span className="text-[11px] font-medium text-[#64748B] flex-shrink-0">{daysLabel(it)}</span>
                      </li>
                    );
                  })}
                  {group.items.length > 5 && (
                    <li className="text-[11px] text-[#94A3B8] text-center pt-1">+{group.items.length - 5} more</li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.section>
  );
}

/* ═════════════════════ Items Table ═════════════════════ */
function ItemsTable({ items, title, activeFilter, onClearFilter, onEdit, onDelete, onView, onAdd }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <AnimatePresence mode="wait">
            <motion.h2
              key={title}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              data-testid="items-section-title"
              className="font-['Outfit'] text-base font-semibold text-[#0F172A] tracking-tight"
            >
              {title}
            </motion.h2>
          </AnimatePresence>
          <p className="text-xs text-[#94A3B8]">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </p>
          {activeFilter && (
            <button
              onClick={onClearFilter}
              data-testid="clear-filter-btn"
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div
          data-testid="items-empty-state"
          className="rounded-2xl bg-white border border-slate-100 px-6 py-10 flex flex-col items-center text-center"
        >
          <p className="text-sm font-medium text-[#0F172A]">No items in this filter yet.</p>
          <p className="text-xs text-[#94A3B8] mt-1">Add your first deadline or clear the filter.</p>
          <button
            onClick={onAdd}
            data-testid="empty-add-btn"
            className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-xs font-semibold"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6, #06B6D4)' }}
          >
            <Plus size={13} /> Add item
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-100 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          {/* Header */}
          <div className="hidden md:grid grid-cols-[2fr_1.2fr_1.5fr_1fr_0.8fr_1fr_auto] gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8] border-b border-slate-100 bg-slate-50/40">
            <span>Item</span>
            <span>Category</span>
            <span>Related to</span>
            <span>Due date</span>
            <span>Days left</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          {/* Rows */}
          <div className="divide-y divide-slate-100">
            {items.map((it, idx) => (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.025, duration: 0.25 }}
                data-testid={`item-row-${it.id}`}
                className="group grid grid-cols-1 md:grid-cols-[2fr_1.2fr_1.5fr_1fr_0.8fr_1fr_auto] gap-y-1 md:gap-4 items-center px-5 py-3.5 hover:bg-slate-50/60 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A] truncate">{it.title}</p>
                  <p className="text-[11px] text-[#94A3B8] md:hidden truncate">{relatedLabel(it)}</p>
                </div>
                <span className="text-xs text-[#64748B] truncate hidden md:block">
                  {getCategoryLabel(it.item_type, it.category) || getTypeLabel(it.item_type)}
                </span>
                <span className="text-xs text-[#64748B] truncate hidden md:block">{relatedLabel(it)}</span>
                <span className="text-xs text-[#64748B] hidden md:block">{formatDate(it.expiration_date || it.due_date)}</span>
                <span className="text-xs text-[#0F172A] font-medium hidden md:block">{daysLabel(it)}</span>
                <span className="md:block">
                  <StatusPill status={it.status} />
                </span>
                <div className="flex items-center gap-1 md:justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <IconBtn onClick={() => onView(it)} data-testid={`row-view-${it.id}`} title="View">
                    <Eye size={14} />
                  </IconBtn>
                  <IconBtn onClick={() => onEdit(it)} data-testid={`row-edit-${it.id}`} title="Edit">
                    <RotateCcw size={14} />
                  </IconBtn>
                  <IconBtn onClick={() => onDelete(it)} data-testid={`row-delete-${it.id}`} title="Delete" danger>
                    <XCircle size={14} />
                  </IconBtn>
                  <button
                    onClick={() => onView(it)}
                    className="ml-1 hidden md:flex w-6 h-6 items-center justify-center rounded-md text-[#CBD5E1] hover:text-[#0F172A] hover:bg-slate-100 transition-colors"
                    aria-hidden
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.safe;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${meta.bg} ${meta.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label}
    </span>
  );
}

function IconBtn({ children, onClick, danger, title, ...rest }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${danger ? 'text-rose-500 hover:bg-rose-50' : 'text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A]'}`}
      {...rest}
    >
      {children}
    </button>
  );
}
