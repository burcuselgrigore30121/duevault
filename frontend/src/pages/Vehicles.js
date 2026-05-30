import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Car, ChevronRight, Edit2, Trash2, FileText } from 'lucide-react';
import { api } from '../api/client';
import AddItemModal from '../components/AddItemModal';

function VehicleCard({ vehicle, onEdit, onDelete }) {
  const navigate = useNavigate();
  return (
    <motion.div
      data-testid={`vehicle-card-${vehicle.id}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="group bg-white rounded-3xl border border-slate-100 p-6 shadow-[0_2px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
          <Car size={22} strokeWidth={1.5} className="text-purple-600" />
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onEdit(vehicle); }} data-testid={`edit-vehicle-${vehicle.id}`} className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
            <Edit2 size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(vehicle); }} data-testid={`delete-vehicle-${vehicle.id}`} className="p-2 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <h3 className="font-['Outfit'] font-semibold text-[#0F172A] text-lg">{vehicle.name}</h3>
      <p className="text-[#64748B] text-sm mt-1">{vehicle.brand} {vehicle.model}</p>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
        <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-3 py-1 rounded-full tracking-wide">
          {vehicle.license_plate}
        </span>
        <button
          onClick={() => navigate(`/vehicles/${vehicle.id}`)}
          className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          View <ChevronRight size={14} />
        </button>
      </div>
      {vehicle.notes && <p className="text-xs text-[#64748B] mt-3 italic">{vehicle.notes}</p>}
    </motion.div>
  );
}

function VehicleModal({ vehicle, onClose, onSaved }) {
  const [form, setForm] = useState(vehicle || { name: '', brand: '', model: '', license_plate: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (vehicle) await api.put(`/api/vehicles/${vehicle.id}`, form);
      else await api.post('/api/vehicles', form);
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Error saving vehicle');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8"
        data-testid="vehicle-modal"
      >
        <h2 className="font-['Outfit'] text-xl font-bold text-[#0F172A] mb-6">{vehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
        {error && <div className="mb-4 px-4 py-2 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {[
            { name: 'name', label: 'Vehicle name', placeholder: 'Vehicle name' },
            { name: 'brand', label: 'Brand', placeholder: 'Brand' },
            { name: 'model', label: 'Model', placeholder: 'Model' },
            { name: 'license_plate', label: 'License plate', placeholder: 'License plate number' },
            { name: 'notes', label: 'Notes (optional)', placeholder: 'Additional notes' },
          ].map(f => (
            <div key={f.name}>
              <label className="block text-sm font-medium text-[#0F172A] mb-1.5">{f.label}</label>
              <input
                name={f.name}
                value={form[f.name] || ''}
                onChange={e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))}
                placeholder={f.placeholder}
                required={f.name !== 'notes'}
                data-testid={`vehicle-field-${f.name}`}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[#0F172A] text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
              />
            </div>
          ))}
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-full border border-slate-200 text-[#64748B] text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} data-testid="vehicle-save-btn" className="flex-1 py-3 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 text-white text-sm font-semibold disabled:opacity-60 hover:scale-105 transition-all duration-200">
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vehicleModal, setVehicleModal] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    try { const r = await api.get('/api/vehicles'); setVehicles(r.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (v) => {
    if (!window.confirm(`Delete "${v.name}"?`)) return;
    try { await api.delete(`/api/vehicles/${v.id}`); load(); } catch (e) { console.error(e); }
  };

  return (
    <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-8" data-testid="vehicles-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B] mb-1">Management</p>
          <h1 className="font-['Outfit'] text-3xl font-bold text-[#0F172A] tracking-tight">Vehicles</h1>
          <p className="text-[#64748B] mt-1.5 text-sm">{vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button
          data-testid="add-vehicle-btn"
          onClick={() => setVehicleModal({})}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 text-white text-sm font-semibold shadow-[0_4px_14px_rgba(59,130,246,0.35)] hover:scale-105 transition-all duration-200 shrink-0"
        >
          <Plus size={16} strokeWidth={2.5} /> Add Vehicle
        </button>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
      ) : vehicles.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 rounded-3xl border border-dashed border-slate-200">
          <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center mb-4">
            <Car size={24} strokeWidth={1.5} className="text-purple-600" />
          </div>
          <h3 className="font-['Outfit'] font-semibold text-[#0F172A]">No vehicles yet</h3>
          <p className="text-sm text-[#64748B] mt-1">Add your first vehicle to track its documents</p>
          <button onClick={() => setVehicleModal({})} className="mt-5 px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 text-white text-sm font-semibold hover:scale-105 transition-all">Add Vehicle</button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {vehicles.map(v => (
            <VehicleCard key={v.id} vehicle={v} onEdit={setVehicleModal} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {vehicleModal !== null && (
        <VehicleModal
          vehicle={vehicleModal?.id ? vehicleModal : null}
          onClose={() => setVehicleModal(null)}
          onSaved={() => { setVehicleModal(null); load(); }}
        />
      )}
    </main>
  );
}
