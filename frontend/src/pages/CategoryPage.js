import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search } from 'lucide-react';
import { api } from '../api/client';
import { useModal } from '../contexts/ModalContext';
import DeadlineCard from '../components/DeadlineCard';
import AddItemModal from '../components/AddItemModal';

const TYPE_ICONS = { personal_document: 'FileText', vehicle_doc: 'Car', payment: 'CreditCard', warranty: 'Shield', reminder: 'Bell' };

export default function CategoryPage({ type, title }) {
  const { openAddModal } = useModal();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/api/items?item_type=${type}`);
      setItems(r.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    try { await api.delete(`/api/items/${item.id}`); load(); } catch (e) { console.error(e); }
  };

  const filtered = items.filter(i => i.title?.toLowerCase().includes(search.toLowerCase()));

  const counts = {
    total: items.length,
    critical: items.filter(i => i.status === 'critical' || i.status === 'urgent').length,
    expired: items.filter(i => i.status === 'expired').length,
  };

  return (
    <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-8" data-testid={`category-page-${type}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B] mb-1">Category</p>
          <h1 className="font-['Outfit'] text-3xl font-bold text-[#0F172A] tracking-tight">{title}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-[#64748B]">
            <span>{counts.total} total</span>
            {counts.critical > 0 && <span className="text-orange-600 font-semibold">{counts.critical} critical/urgent</span>}
            {counts.expired > 0 && <span className="text-slate-500">{counts.expired} expired</span>}
          </div>
        </div>
        <button
          data-testid={`add-${type}-btn`}
          onClick={() => openAddModal(type)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 text-white text-sm font-semibold shadow-[0_4px_14px_rgba(59,130,246,0.35)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.45)] hover:scale-105 transition-all duration-200 shrink-0"
        >
          <Plus size={16} strokeWidth={2.5} /> Add
        </button>
      </motion.div>

      {/* Search */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="relative mb-6 max-w-sm">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.5} />
        <input
          data-testid="category-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${title.toLowerCase()}...`}
          className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-200 bg-white text-sm text-[#0F172A] placeholder-slate-400 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
        />
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 rounded-3xl border border-dashed border-slate-200">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-4">
            <Plus size={24} strokeWidth={1.5} className="text-blue-500" />
          </div>
          <h3 className="font-['Outfit'] font-semibold text-[#0F172A]">
            {search ? 'No results found' : `No ${title.toLowerCase()} yet`}
          </h3>
          <p className="text-sm text-[#64748B] mt-1">
            {search ? 'Try a different search term' : `Click Add to track your first item`}
          </p>
          {!search && (
            <button
              onClick={() => openAddModal(type)}
              className="mt-5 px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 text-white text-sm font-semibold hover:scale-105 transition-all duration-200"
            >
              Add {title}
            </button>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item, i) => (
            <DeadlineCard
              key={item.id}
              item={item}
              index={i}
              onEdit={(it) => setEditItem(it)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

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
