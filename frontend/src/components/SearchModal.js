import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Car, FileText, CreditCard, Shield, Bell, Clock } from 'lucide-react';
import { api } from '../api/client';
import StatusBadge from './StatusBadge';
import { getCategoryLabel } from '../api/client';

const TYPE_ICONS = {
  personal_document: FileText,
  vehicle_doc: Car,
  payment: CreditCard,
  warranty: Shield,
  reminder: Bell,
};

const formatDays = (days) => {
  if (days === null || days === undefined) return null;
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `${days}d remaining`;
};

export default function SearchModal({ onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ items: [], vehicles: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setResults({ items: [], vehicles: [] }); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.get(`/api/search?q=${encodeURIComponent(query.trim())}`);
        setResults(r.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  const goToItem = (id) => { navigate(`/items/${id}`); onClose(); };
  const goToVehicle = (id) => { navigate(`/vehicles/${id}`); onClose(); };

  const total = results.items.length + results.vehicles.length;
  const empty = query.trim().length >= 2 && !loading && total === 0;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] flex items-start justify-center pt-16 px-4 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        data-testid="search-overlay"
      >
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-2xl bg-white rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.18)] overflow-hidden"
          data-testid="search-modal"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <Search size={20} strokeWidth={1.5} className={`shrink-0 transition-colors ${loading ? 'text-blue-500' : 'text-slate-400'}`} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search items, vehicles, categories..."
              data-testid="search-input"
              className="flex-1 text-base text-[#0F172A] placeholder-slate-400 outline-none bg-transparent"
              onKeyDown={e => e.key === 'Escape' && onClose()}
            />
            {query && (
              <button onClick={() => setQuery('')} className="p-1 rounded-full hover:bg-slate-100 transition-colors">
                <X size={16} className="text-slate-400" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {query.trim().length < 2 && (
              <div className="px-5 py-8 text-center">
                <Search size={32} strokeWidth={1} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-[#64748B]">Type at least 2 characters to search</p>
              </div>
            )}

            {empty && (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-[#64748B]">No results found for <strong>"{query}"</strong></p>
              </div>
            )}

            {loading && query.trim().length >= 2 && total === 0 && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            )}

            {/* Items */}
            {results.items.length > 0 && (
              <div className="py-2">
                <p className="px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#64748B]">
                  Items ({results.items.length})
                </p>
                {results.items.map(item => {
                  const Icon = TYPE_ICONS[item.item_type] || FileText;
                  return (
                    <button
                      key={item.id}
                      data-testid={`search-result-item-${item.id}`}
                      onClick={() => goToItem(item.id)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center shrink-0">
                        <Icon size={16} strokeWidth={1.5} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] truncate">{item.title}</p>
                        <p className="text-xs text-[#64748B] truncate">
                          {getCategoryLabel(item.item_type, item.category)}
                          {item.vehicle_name && <span className="ml-1.5">· {item.vehicle_name}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.days_remaining !== null && (
                          <span className="text-xs text-[#64748B] flex items-center gap-1">
                            <Clock size={11} /> {formatDays(item.days_remaining)}
                          </span>
                        )}
                        <StatusBadge status={item.status} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Vehicles */}
            {results.vehicles.length > 0 && (
              <div className="py-2">
                <p className="px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#64748B]">
                  Vehicles ({results.vehicles.length})
                </p>
                {results.vehicles.map(v => (
                  <button
                    key={v.id}
                    data-testid={`search-result-vehicle-${v.id}`}
                    onClick={() => goToVehicle(v.id)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center shrink-0">
                      <Car size={16} strokeWidth={1.5} className="text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A] truncate">{v.name}</p>
                      <p className="text-xs text-[#64748B] truncate">{v.brand} {v.model}</p>
                    </div>
                    <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full shrink-0">
                      {v.license_plate}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {total > 0 && (
              <div className="px-5 py-3 border-t border-slate-50 text-center">
                <p className="text-xs text-[#64748B]">{total} result{total !== 1 ? 's' : ''} found</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
