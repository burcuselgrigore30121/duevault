import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Camera, FileText } from 'lucide-react';
import { api, ITEM_TYPES, formatError } from '../api/client';
import { toast } from 'sonner';

const RECURRENCE = ['monthly', 'quarterly', 'yearly', 'custom'];
const INTERVALS = [{ value: 30, label: '30 days before' }, { value: 10, label: '10 days before' }, { value: 3, label: '3 days before' }, { value: 0, label: 'On due date' }];

const DEFAULT_FORM = {
  title: '', item_type: 'personal_document', category: '', vehicle_id: '', vehicle_name: '',
  license_plate: '', issue_date: '', expiration_date: '', due_date: '', amount: '',
  currency: 'RON', recurrence: '', custom_message: '', reminder_intervals: [30, 10, 3],
  reminder_email: '', notes: '',
};

export default function AddItemModal({ item, defaultType, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState(() => {
    if (item) return {
      ...DEFAULT_FORM, ...item,
      amount: item.amount ? String(item.amount) : '',
      reminder_intervals: item.reminder_intervals || [30, 10, 3],
    };
    return { ...DEFAULT_FORM, item_type: defaultType || 'personal_document' };
  });
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'scan'

  useEffect(() => {
    api.get('/api/vehicles').then(r => setVehicles(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const cats = ITEM_TYPES[form.item_type]?.categories || [];
    if (cats.length && !cats.find(c => c.value === form.category)) {
      setForm(p => ({ ...p, category: cats[0].value }));
    }
  }, [form.item_type, form.category]);

  const set = (name, value) => setForm(p => ({ ...p, [name]: value }));

  const toggleInterval = (v) => {
    setForm(p => ({
      ...p,
      reminder_intervals: p.reminder_intervals.includes(v)
        ? p.reminder_intervals.filter(x => x !== v)
        : [...p.reminder_intervals, v],
    }));
  };

  const handleVehicleChange = (vid) => {
    const v = vehicles.find(x => x.id === vid);
    setForm(p => ({ ...p, vehicle_id: vid, vehicle_name: v ? `${v.brand} ${v.model}` : '', license_plate: v?.license_plate || '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.category) { toast.error('Category is required'); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        amount: form.amount ? parseFloat(form.amount) : null,
        vehicle_id: form.vehicle_id || null,
        vehicle_name: form.vehicle_name || null,
        license_plate: form.license_plate || null,
        issue_date: form.issue_date || null,
        expiration_date: form.expiration_date || null,
        due_date: form.due_date || null,
        recurrence: form.recurrence || null,
        custom_message: form.custom_message || null,
        reminder_email: form.reminder_email || null,
        notes: form.notes || null,
      };
      if (isEdit) await api.put(`/api/items/${item.id}`, payload);
      else await api.post('/api/items', payload);
      toast.success(isEdit ? 'Item updated' : 'Item added');
      onSaved();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const currentCats = ITEM_TYPES[form.item_type]?.categories || [];
  const showVehicle = form.item_type === 'vehicle_doc';
  const showPayment = form.item_type === 'payment';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-black/30 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.22 }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.14)] w-full max-w-xl mb-8"
          data-testid="add-item-modal"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-8 pt-7 pb-0">
            <h2 className="font-['Outfit'] text-xl font-bold text-[#0F172A]">
              {isEdit ? 'Edit Item' : 'Add Item'}
            </h2>
            <div className="flex items-center gap-2">
              {!isEdit && (
                <button
                  onClick={() => setStep(s => s === 'scan' ? 'form' : 'scan')}
                  data-testid="scan-upload-toggle"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                >
                  <Upload size={12} /> Scan / Upload
                </button>
              )}
              <button onClick={onClose} data-testid="modal-close-btn" className="p-2 rounded-full hover:bg-slate-100 transition-colors text-[#64748B]">
                <X size={18} />
              </button>
            </div>
          </div>

          {step === 'scan' ? (
            <ScanSection onBack={() => setStep('form')} />
          ) : (
            <form onSubmit={handleSubmit} className="px-8 pb-8 pt-5 flex flex-col gap-4">
              {/* Item type */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-[#64748B] mb-2">Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(ITEM_TYPES).map(([k, v]) => (
                    <button
                      key={k} type="button"
                      data-testid={`type-btn-${k}`}
                      onClick={() => set('item_type', k)}
                      className={`py-2 px-3 rounded-xl text-xs font-medium transition-all ${form.item_type === k ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-700 border border-blue-200' : 'bg-slate-50 text-[#64748B] border border-slate-100 hover:bg-slate-100'}`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <Field label="Title" required>
                <input name="title" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Document title" required data-testid="item-title-input" className={INPUT} />
              </Field>

              {/* Category */}
              <Field label="Category" required>
                <select value={form.category} onChange={e => set('category', e.target.value)} data-testid="item-category-select" className={INPUT}>
                  <option value="">Select category</option>
                  {currentCats.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>

              {/* Vehicle selector */}
              {showVehicle && (
                <Field label="Vehicle">
                  <select value={form.vehicle_id} onChange={e => handleVehicleChange(e.target.value)} data-testid="item-vehicle-select" className={INPUT}>
                    <option value="">No vehicle selected</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} — {v.brand} {v.model} ({v.license_plate})</option>)}
                  </select>
                </Field>
              )}

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Issue Date">
                  <input type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)} data-testid="item-issue-date" className={INPUT} />
                </Field>
                {showPayment ? (
                  <Field label="Due Date">
                    <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} data-testid="item-due-date" className={INPUT} />
                  </Field>
                ) : (
                  <Field label="Expiration Date">
                    <input type="date" value={form.expiration_date} onChange={e => set('expiration_date', e.target.value)} data-testid="item-expiration-date" className={INPUT} />
                  </Field>
                )}
              </div>

              {/* Payment-specific */}
              {showPayment && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Amount">
                    <div className="relative">
                      <input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" data-testid="item-amount" className={`${INPUT} pr-16`} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#64748B]">{form.currency}</span>
                    </div>
                  </Field>
                  <Field label="Recurrence">
                    <select value={form.recurrence} onChange={e => set('recurrence', e.target.value)} data-testid="item-recurrence" className={INPUT}>
                      <option value="">One-time</option>
                      {RECURRENCE.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                  </Field>
                </div>
              )}

              {/* Reminder email */}
              <Field label="Reminder email (optional)">
                <input type="email" value={form.reminder_email} onChange={e => set('reminder_email', e.target.value)} placeholder="Reminder email address" data-testid="item-reminder-email" className={INPUT} />
              </Field>

              {/* Reminder intervals */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-[#64748B] mb-2">Reminder intervals</label>
                <div className="flex flex-wrap gap-2">
                  {INTERVALS.map(({ value, label }) => (
                    <button
                      key={value} type="button"
                      data-testid={`interval-btn-${value}`}
                      onClick={() => toggleInterval(value)}
                      className={`py-1.5 px-3 rounded-full text-xs font-medium transition-all ${form.reminder_intervals.includes(value) ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-700 border border-blue-200' : 'bg-slate-50 text-[#64748B] border border-slate-100 hover:bg-slate-100'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom message */}
              <Field label="Custom reminder message (optional)">
                <textarea value={form.custom_message} onChange={e => set('custom_message', e.target.value)} rows={2} placeholder="Reminder message" data-testid="item-custom-message" className={`${INPUT} resize-none`} />
              </Field>

              {/* Submit */}
              <button
                type="submit"
                data-testid="save-item-btn"
                disabled={loading}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 text-white font-semibold text-sm shadow-[0_4px_14px_rgba(59,130,246,0.3)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.4)] hover:scale-[1.02] disabled:opacity-60 disabled:scale-100 transition-all duration-200 mt-2"
              >
                {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Item'}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

const INPUT = "w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[#0F172A] text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all";

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function ScanSection({ onBack }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  return (
    <div className="px-8 pb-8 pt-5">
      <p className="text-sm text-[#64748B] mb-5">Upload a document or take a photo. The detected information will be shown for review before saving.</p>
      <div
        data-testid="scan-drop-zone"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center gap-3 p-10 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer ${dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50'}`}
        onClick={() => document.getElementById('scan-file-input')?.click()}
      >
        <input id="scan-file-input" type="file" accept="image/*,.pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${dragging ? 'bg-blue-100' : 'bg-white border border-slate-200'}`}>
          {dragging ? <Upload size={24} className="text-blue-500" /> : <FileText size={24} className="text-slate-400" strokeWidth={1.5} />}
        </div>
        <div className="text-center">
          <p className="font-medium text-[#0F172A] text-sm">Drop file here or click to browse</p>
          <p className="text-xs text-[#64748B] mt-1">Supports JPG, PNG, PDF</p>
        </div>
      </div>

      {file && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-1">File selected</p>
          <p className="text-sm text-[#0F172A] font-medium truncate">{file.name}</p>
          <p className="text-xs text-[#64748B] mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
          <p className="text-xs text-[#64748B] mt-3 italic">OCR preview: Fill in details manually using the form.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={onBack} className="flex-1 py-2 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 text-white text-xs font-semibold hover:scale-105 transition-all">
              Fill in manually
            </button>
            <button onClick={() => setFile(null)} className="px-4 py-2 rounded-full border border-slate-200 text-xs text-[#64748B] hover:bg-slate-50">
              Remove
            </button>
          </div>
        </motion.div>
      )}

      <div className="flex gap-2 mt-4">
        <button onClick={onBack} className="flex-1 py-2.5 rounded-full border border-slate-200 text-sm text-[#64748B] font-medium hover:bg-slate-50 transition-colors">
          Back to form
        </button>
        <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-slate-100 text-sm text-[#64748B] font-medium hover:bg-slate-200 transition-colors">
          <Camera size={14} /> Camera
        </button>
      </div>
    </div>
  );
}
