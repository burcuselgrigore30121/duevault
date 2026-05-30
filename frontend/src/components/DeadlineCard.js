import { useNavigate } from 'react-router-dom';
import { Calendar, Car, Clock, Edit2, Trash2 } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { getCategoryLabel, getTypeLabel } from '../api/client';
import { motion } from 'framer-motion';

const formatDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const formatDays = (days) => {
  if (days === null || days === undefined) return null;
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return 'Due today';
  return `${days} day${days !== 1 ? 's' : ''} remaining`;
};

export default function DeadlineCard({ item, onEdit, onDelete, index = 0 }) {
  const navigate = useNavigate();
  const targetDate = item.expiration_date || item.due_date;
  const daysLabel = formatDays(item.days_remaining);

  return (
    <motion.div
      data-testid={`deadline-card-${item.id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.2, 0, 0, 1] }}
      className="group bg-white rounded-3xl border border-slate-100 p-6 shadow-[0_2px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 cursor-pointer"
      onClick={() => navigate(`/items/${item.id}`)}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#0F172A] text-base leading-tight truncate">{item.title}</h3>
          <p className="text-xs text-[#64748B] mt-1 uppercase tracking-[0.12em] font-medium">
            {getCategoryLabel(item.item_type, item.category)}
          </p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      {item.vehicle_name && (
        <div className="flex items-center gap-1.5 mb-3 text-sm text-[#64748B]">
          <Car size={14} strokeWidth={1.5} />
          <span>{item.vehicle_name}</span>
          {item.license_plate && <span className="text-slate-400">· {item.license_plate}</span>}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
        <div className="flex items-center gap-1.5 text-sm text-[#64748B]">
          <Calendar size={14} strokeWidth={1.5} />
          <span>{formatDate(targetDate)}</span>
        </div>
        {daysLabel && (
          <div className="flex items-center gap-1 text-xs font-semibold text-[#64748B]">
            <Clock size={12} strokeWidth={2} />
            <span>{daysLabel}</span>
          </div>
        )}
      </div>

      {item.amount && (
        <div className="mt-2 text-sm font-semibold text-[#0F172A]">
          {item.amount.toLocaleString('ro-RO')} {item.currency}
          {item.recurrence && <span className="text-xs font-normal text-[#64748B] ml-1">/ {item.recurrence}</span>}
        </div>
      )}

      <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200" onClick={e => e.stopPropagation()}>
        <button
          data-testid={`edit-item-${item.id}`}
          onClick={() => onEdit(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
        >
          <Edit2 size={12} /> Edit
        </button>
        <button
          data-testid={`delete-item-${item.id}`}
          onClick={() => onDelete(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </motion.div>
  );
}
