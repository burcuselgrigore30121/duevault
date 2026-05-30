import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Car, ChevronLeft, Plus, Edit2 } from 'lucide-react';
import { api } from '../api/client';
import { useModal } from '../contexts/ModalContext';
import DeadlineCard from '../components/DeadlineCard';
import AddItemModal from '../components/AddItemModal';

function VehicleModal({ vehicle, onClose, onSaved }) {
  const [form, setForm] = useState({ name: vehicle.name, brand: vehicle.brand, model: vehicle.model, license_plate: vehicle.license_plate, notes: vehicle.notes || '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await api.put(`/api/vehicles/${vehicle.id}`, form); onSaved(); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()} className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
        <h2 className="font-['Outfit'] text-xl font-bold text-[#0F172A] mb-6">Edit Vehicle</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {[['name','Vehicle name'],['brand','Brand'],['model','Model'],['license_plate','License plate'],['notes','Notes']].map(([k,l]) => (
            <div key={k}>
              <label className="block text-sm font-medium text-[#0F172A] mb-1.5">{l}</label>
              <input name={k} value={form[k]} onChange={e => setForm(p => ({...p,[k]:e.target.value}))} required={k !== 'notes'} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400" />
            </div>
          ))}
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-full border border-slate-200 text-[#64748B] text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 text-white text-sm font-semibold disabled:opacity-60 hover:scale-105 transition-all">
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { openAddModal } = useModal();
  const [vehicle, setVehicle] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editVehicle, setEditVehicle] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const load = useCallback(async () => {
    try {
      const [vr, ir] = await Promise.all([
        api.get(`/api/vehicles/${id}`),
        api.get(`/api/items?vehicle_id=${id}`)
      ]);
      setVehicle(vr.data);
      setItems(ir.data);
    } catch (e) { console.error(e); navigate('/vehicles'); }
    finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    try { await api.delete(`/api/items/${item.id}`); load(); } catch (e) { console.error(e); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;
  if (!vehicle) return null;

  const stats = { total: items.length, critical: items.filter(i => i.status === 'critical' || i.status === 'urgent').length };

  return (
    <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-8" data-testid="vehicle-detail-page">
      <button onClick={() => navigate('/vehicles')} className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A] mb-6 transition-colors">
        <ChevronLeft size={16} /> Back to vehicles
      </button>

      {/* Vehicle profile card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-3xl border border-purple-100 p-8 mb-8 shadow-[0_4px_24px_rgba(139,92,246,0.08)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-[0_8px_20px_rgba(139,92,246,0.3)]">
              <Car size={28} strokeWidth={1.5} className="text-white" />
            </div>
            <div>
              <h1 className="font-['Outfit'] text-2xl font-bold text-[#0F172A]">{vehicle.name}</h1>
              <p className="text-[#64748B] mt-0.5">{vehicle.brand} {vehicle.model}</p>
              <span className="inline-block mt-2 text-sm font-semibold bg-white border border-purple-100 text-purple-700 px-3 py-1 rounded-full">
                {vehicle.license_plate}
              </span>
            </div>
          </div>
          <button onClick={() => setEditVehicle(true)} data-testid="edit-vehicle-detail-btn" className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-sm font-medium text-[#64748B] hover:bg-slate-50 transition-colors">
            <Edit2 size={14} /> Edit
          </button>
        </div>
        <div className="flex gap-6 mt-6 pt-6 border-t border-purple-100/50">
          <div><p className="text-2xl font-['Outfit'] font-bold text-[#0F172A]">{stats.total}</p><p className="text-sm text-[#64748B]">Documents</p></div>
          <div><p className="text-2xl font-['Outfit'] font-bold text-orange-600">{stats.critical}</p><p className="text-sm text-[#64748B]">Urgent</p></div>
        </div>
        {vehicle.notes && <p className="mt-4 text-sm text-[#64748B] italic">{vehicle.notes}</p>}
      </motion.div>

      {/* Documents section */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-['Outfit'] text-xl font-bold text-[#0F172A]">Vehicle Documents</h2>
        <button
          data-testid="add-vehicle-doc-btn"
          onClick={() => openAddModal('vehicle_doc')}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 text-white text-sm font-semibold hover:scale-105 transition-all"
        >
          <Plus size={14} strokeWidth={2.5} /> Add Document
        </button>
      </div>

      {items.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 rounded-3xl border border-dashed border-slate-200">
          <p className="font-medium text-[#0F172A]">No documents for this vehicle yet</p>
          <p className="text-sm text-[#64748B] mt-1">Add RCA, ITP, vignette or other reminders</p>
          <button onClick={() => openAddModal('vehicle_doc')} className="mt-5 px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 text-white text-sm font-semibold hover:scale-105 transition-all">
            Add Document
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item, i) => (
            <DeadlineCard key={item.id} item={item} index={i} onEdit={setEditItem} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {editVehicle && <VehicleModal vehicle={vehicle} onClose={() => setEditVehicle(false)} onSaved={() => { setEditVehicle(false); load(); }} />}
      {editItem && <AddItemModal item={editItem} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); load(); }} />}
    </main>
  );
}
