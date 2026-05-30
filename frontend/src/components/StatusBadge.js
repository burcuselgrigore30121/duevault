const STATUS_CONFIG = {
  safe:     { label: 'Safe',     bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  warning:  { label: 'Warning',  bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  urgent:   { label: 'Urgent',   bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  critical: { label: 'Critical', bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500' },
  expired:  { label: 'Expired',  bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400' },
};

export default function StatusBadge({ status, size = 'sm' }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.safe;
  const px = size === 'lg' ? 'px-4 py-1.5 text-sm' : 'px-2.5 py-0.5 text-xs';
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide uppercase ${px} ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === 'critical' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
}

export { STATUS_CONFIG };
