import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Calendar, Clock, Car, Mail, RotateCcw, Edit2, Trash2, CheckCircle2, Upload, Download, X, Paperclip } from 'lucide-react';
import { api, API_BASE_URL, getCategoryLabel, getTypeLabel, formatError } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import AddItemModal from '../components/AddItemModal';
import { toast } from 'sonner';

const getToken = () => localStorage.getItem('dv_token') || sessionStorage.getItem('dv_token');

const formatDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return d; }
};

function RenewModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({ new_expiration_date: '', notes: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.new_expiration_date) return;
    setLoading(true);
    try {
      await api.post(`/api/items/${item.id}/renew`, {
        previous_expiration_date: item.expiration_date || item.due_date,
        new_expiration_date: form.new_expiration_date,
        notes: form.notes
      });
      toast.success('Item renewed successfully');
      onSaved();
    } catch (e) { toast.error(formatError(e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()} className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8" data-testid="renew-modal">
        <h2 className="font-['Outfit'] text-xl font-bold text-[#0F172A] mb-2">Mark as Renewed</h2>
        <p className="text-sm text-[#64748B] mb-6">Enter the new expiration / due date.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1.5">New expiration date</label>
            <input type="date" value={form.new_expiration_date} onChange={e => setForm(p => ({...p, new_expiration_date: e.target.value}))} required data-testid="renew-date-input" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-purple-500/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Notes (optional)</label>
            <input type="text" value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Renewal notes" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-purple-500/20" />
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-full border border-slate-200 text-[#64748B] text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading} data-testid="renew-submit-btn" className="flex-1 py-3 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 text-white text-sm font-semibold disabled:opacity-60 hover:scale-105 transition-all">
              {loading ? 'Saving...' : 'Confirm Renewal'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [item, setItem] = useState(null);
  const [renewals, setRenewals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ir, rr, er] = await Promise.all([
        api.get(`/api/items/${id}`),
        api.get(`/api/items/${id}/renewals`),
        api.get('/api/email/status'),
      ]);
      setItem(ir.data);
      setRenewals(rr.data);
      setEmailConfigured(er.data.configured);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${item?.title}"?`)) return;
    try { await api.delete(`/api/items/${id}`); navigate(-1); }
    catch (e) { toast.error(formatError(e)); }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/items/${id}/upload`, {
        method: 'POST', body: formData,
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Upload failed');
      }
      toast.success('File attached successfully');
      load();
    } catch (e) { toast.error(e.message || 'Upload failed'); }
    finally { setUploadLoading(false); }
  };

  const handleRemoveFile = async () => {
    if (!window.confirm('Remove attached file?')) return;
    try { await api.delete(`/api/items/${id}/file`); toast.success('File removed'); load(); }
    catch (e) { toast.error(formatError(e)); }
  };

  const handleTestEmail = async () => {
    const email = item?.reminder_email || prompt('Enter recipient email:');
    if (!email) return;
    setEmailLoading(true);
    try {
      await api.post('/api/email/test-reminder', { item_id: id, recipient_email: email });
      toast.success(`Test reminder sent to ${email}`);
    } catch (e) { toast.error(formatError(e)); }
    finally { setEmailLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;
  if (!item) return <div className="text-center py-20 text-[#64748B]">Item not found.</div>;

  const target = item.expiration_date || item.due_date;
  const daysLabel = item.days_remaining !== null
    ? item.days_remaining < 0 ? `${Math.abs(item.days_remaining)} days overdue` : item.days_remaining === 0 ? 'Due today' : `${item.days_remaining} days remaining`
    : null;

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8" data-testid="item-detail-page">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A] mb-6 transition-colors">
        <ChevronLeft size={16} /> Back
      </button>

      {/* Main card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl border border-slate-100 p-8 shadow-[0_4px_24px_rgba(0,0,0,0.05)] mb-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B] mb-1">
              {getTypeLabel(item.item_type)} · {getCategoryLabel(item.item_type, item.category)}
            </p>
            <h1 className="font-['Outfit'] text-2xl font-bold text-[#0F172A]">{item.title}</h1>
          </div>
          <StatusBadge status={item.status} size="lg" />
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {item.vehicle_name && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-purple-50 border border-purple-100">
              <Car size={18} strokeWidth={1.5} className="text-purple-500 shrink-0" />
              <div>
                <p className="text-xs text-[#64748B]">Vehicle</p>
                <p className="text-sm font-semibold text-[#0F172A]">{item.vehicle_name} · {item.license_plate}</p>
              </div>
            </div>
          )}
          {item.issue_date && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <Calendar size={18} strokeWidth={1.5} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-xs text-[#64748B]">Issue Date</p>
                <p className="text-sm font-semibold text-[#0F172A]">{formatDate(item.issue_date)}</p>
              </div>
            </div>
          )}
          {target && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <Calendar size={18} strokeWidth={1.5} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-xs text-[#64748B]">{item.expiration_date ? 'Expiration Date' : 'Due Date'}</p>
                <p className="text-sm font-semibold text-[#0F172A]">{formatDate(target)}</p>
              </div>
            </div>
          )}
          {daysLabel && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <Clock size={18} strokeWidth={1.5} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-xs text-[#64748B]">Time remaining</p>
                <p className="text-sm font-semibold text-[#0F172A]">{daysLabel}</p>
              </div>
            </div>
          )}
          {item.amount && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="w-[18px] h-[18px] text-slate-400 shrink-0 flex items-center justify-center font-bold text-sm">$</div>
              <div>
                <p className="text-xs text-[#64748B]">Amount</p>
                <p className="text-sm font-semibold text-[#0F172A]">{item.amount.toLocaleString()} {item.currency}{item.recurrence ? ` / ${item.recurrence}` : ''}</p>
              </div>
            </div>
          )}
          {item.reminder_email && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <Mail size={18} strokeWidth={1.5} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-xs text-[#64748B]">Reminder email</p>
                <p className="text-sm font-semibold text-[#0F172A]">{item.reminder_email}</p>
              </div>
            </div>
          )}
        </div>

        {item.custom_message && (
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-500 mb-1">Note</p>
            <p className="text-sm text-[#0F172A]">{item.custom_message}</p>
          </div>
        )}

        {/* Reminder intervals */}
        {item.reminder_intervals?.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B] mb-3">Reminder intervals</p>
            <div className="flex flex-wrap gap-2">
              {item.reminder_intervals.map(d => (
                <span key={d} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">
                  <CheckCircle2 size={12} /> {d} days before
                </span>
              ))}
            </div>
          </div>
        )}

        {/* File attachment */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B] mb-3 flex items-center gap-1.5">
            <Paperclip size={13} /> Attached Document
          </p>
          {item.file_path ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <Paperclip size={18} strokeWidth={1.5} className="text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0F172A] truncate">{item.file_name}</p>
                <p className="text-xs text-[#64748B]">File attached</p>
              </div>
              <div className="flex gap-2">
                <a
                  href={`${API_BASE_URL}/api/items/${id}/file`}
                  target="_blank" rel="noopener noreferrer"
                  data-testid="item-download-file-btn"
                  onClick={e => { e.preventDefault(); window.open(`${API_BASE_URL}/api/items/${id}/file?token=${getToken()}`, '_blank'); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-emerald-200 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                  title="View file"
                >
                  <Download size={12} /> View
                </a>
                <button onClick={handleRemoveFile} data-testid="item-remove-file-btn" className="p-1.5 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          ) : (
            <div>
              <input
                ref={fileInputRef} type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => handleFileUpload(e.target.files?.[0])}
              />
              <button
                data-testid="item-attach-file-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 border-dashed border-slate-200 text-sm text-[#64748B] hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-600 transition-all disabled:opacity-50 w-full justify-center"
              >
                <Upload size={14} />
                {uploadLoading ? 'Uploading...' : 'Attach document (JPG, PNG, PDF — max 10 MB)'}
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-6 border-t border-slate-100">
          <button data-testid="item-edit-btn" onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-[#64748B] hover:bg-slate-50 transition-colors">
            <Edit2 size={14} /> Edit
          </button>
          <button data-testid="item-renew-btn" onClick={() => setShowRenew(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors">
            <RotateCcw size={14} /> Mark as Renewed
          </button>
          <button
            data-testid="item-send-email-btn"
            onClick={handleTestEmail}
            disabled={emailLoading || !emailConfigured}
            title={!emailConfigured ? 'Email service not configured' : ''}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-blue-200 bg-blue-50 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            <Mail size={14} /> {emailLoading ? 'Sending...' : 'Send Test Reminder'}
          </button>
          <button data-testid="item-delete-btn" onClick={handleDelete} className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-red-200 bg-red-50 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </motion.div>

      {/* Renewal history */}
      {renewals.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white rounded-3xl border border-slate-100 p-8 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
          <h2 className="font-['Outfit'] text-lg font-bold text-[#0F172A] mb-5">Renewal History</h2>
          <div className="relative pl-5 border-l-2 border-slate-100 flex flex-col gap-5">
            {renewals.map((r, i) => (
              <div key={r.id} className="relative">
                <div className="absolute -left-[25px] top-1 w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 border-2 border-white shadow" />
                <p className="text-xs text-[#64748B] mb-0.5">{formatDate(r.created_at)}</p>
                <p className="text-sm font-semibold text-[#0F172A]">Renewed</p>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {formatDate(r.previous_expiration_date)} → <span className="text-emerald-600 font-medium">{formatDate(r.new_expiration_date)}</span>
                </p>
                {r.notes && <p className="text-xs text-[#64748B] mt-1 italic">{r.notes}</p>}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {showEdit && <AddItemModal item={item} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load(); }} />}
      {showRenew && <RenewModal item={item} onClose={() => setShowRenew(false)} onSaved={() => { setShowRenew(false); load(); }} />}
    </main>
  );
}
