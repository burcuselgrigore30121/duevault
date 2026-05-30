import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Bell, CheckCircle2, AlertCircle, Clock, Zap, Calendar } from 'lucide-react';
import { api, formatError } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user, login } = useAuth();
  const [profile, setProfile] = useState({ full_name: '', notification_email: '' });
  const [passwords, setPasswords] = useState({ old_password: '', new_password: '', confirm: '' });
  const [scheduler, setScheduler] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({ full_name: user.full_name || '', notification_email: user.notification_email || user.email || '' });
    }
    api.get('/api/scheduler/status').then(r => setScheduler(r.data)).catch(() => {});
  }, [user]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!profile.full_name.trim()) { toast.error('Full name is required'); return; }
    setProfileLoading(true);
    try {
      const { data } = await api.put('/api/auth/profile', profile);
      const token = localStorage.getItem('dv_token') || sessionStorage.getItem('dv_token');
      if (token) login(data, token, !!localStorage.getItem('dv_token'));
      toast.success('Profile updated successfully');
    } catch (e) { toast.error(formatError(e)); }
    finally { setProfileLoading(false); }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm) { toast.error('Passwords do not match'); return; }
    if (passwords.new_password.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    setPassLoading(true);
    try {
      await api.put('/api/auth/change-password', { old_password: passwords.old_password, new_password: passwords.new_password });
      toast.success('Password changed successfully');
      setPasswords({ old_password: '', new_password: '', confirm: '' });
    } catch (e) { toast.error(formatError(e)); }
    finally { setPassLoading(false); }
  };

  const formatNextRun = (iso) => {
    if (!iso) return 'Calculating...';
    try {
      const d = new Date(iso);
      const diff = Math.round((d - Date.now()) / 60000);
      if (diff < 1) return 'Any moment now';
      if (diff < 60) return `in ${diff} minutes`;
      return `in ${Math.round(diff / 60)} hours`;
    } catch { return iso; }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8" data-testid="profile-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B] mb-1">Account</p>
        <h1 className="font-['Outfit'] text-3xl font-bold text-[#0F172A] tracking-tight">Profile & Settings</h1>
        <p className="text-[#64748B] mt-1.5">Manage your account details and notification preferences.</p>
      </motion.div>

      <div className="flex flex-col gap-6">
        {/* Profile info */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white rounded-3xl border border-slate-100 p-8 shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-4 mb-7 pb-6 border-b border-slate-100">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold shadow-[0_8px_20px_rgba(99,102,241,0.25)]">
              {user?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="font-['Outfit'] font-semibold text-[#0F172A] text-lg">{user?.full_name}</h2>
              <p className="text-sm text-[#64748B]">{user?.email}</p>
              <span className="inline-block mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{user?.role}</span>
            </div>
          </div>

          <h3 className="font-['Outfit'] font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
            <User size={16} strokeWidth={1.5} /> Edit Profile
          </h3>
          <form onSubmit={handleProfileSave} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Full name</label>
              <input
                value={profile.full_name}
                onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                data-testid="profile-fullname-input"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[#0F172A] text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
                <span className="flex items-center gap-1.5"><Bell size={14} strokeWidth={1.5} /> Reminder notification email</span>
              </label>
              <input
                type="email"
                value={profile.notification_email}
                onChange={e => setProfile(p => ({ ...p, notification_email: e.target.value }))}
                data-testid="profile-email-input"
                placeholder="Emails will be sent to this address"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[#0F172A] text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
              />
              <p className="text-xs text-[#64748B] mt-1.5">Automatic reminders will be sent to this address based on your items' reminder intervals.</p>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={profileLoading} data-testid="profile-save-btn" className="px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 text-white text-sm font-semibold hover:scale-105 disabled:opacity-60 transition-all duration-200">
                {profileLoading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Change password */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-3xl border border-slate-100 p-8 shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
          <h3 className="font-['Outfit'] font-semibold text-[#0F172A] mb-5 flex items-center gap-2">
            <Lock size={16} strokeWidth={1.5} /> Change Password
          </h3>
          <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
            {[
              { key: 'old_password', label: 'Current password', id: 'profile-old-password' },
              { key: 'new_password', label: 'New password', id: 'profile-new-password' },
              { key: 'confirm',      label: 'Confirm new password', id: 'profile-confirm-password' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">{f.label}</label>
                <input
                  type="password" value={passwords[f.key]}
                  onChange={e => setPasswords(p => ({ ...p, [f.key]: e.target.value }))}
                  data-testid={f.id}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[#0F172A] text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
                />
              </div>
            ))}
            <div className="flex justify-end">
              <button type="submit" disabled={passLoading} data-testid="profile-change-password-btn" className="px-6 py-2.5 rounded-full border border-slate-200 bg-slate-50 text-sm font-medium text-[#0F172A] hover:bg-slate-100 disabled:opacity-60 transition-colors">
                {passLoading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Scheduler status */}
        {scheduler && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white rounded-3xl border border-slate-100 p-8 shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
            <h3 className="font-['Outfit'] font-semibold text-[#0F172A] mb-5 flex items-center gap-2">
              <Bell size={16} strokeWidth={1.5} /> Automatic Email Reminders
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                {scheduler.active ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> : <AlertCircle size={18} className="text-slate-400 shrink-0" />}
                <div>
                  <p className="text-xs text-[#64748B]">Scheduler</p>
                  <p className="text-sm font-semibold text-[#0F172A]">{scheduler.active ? 'Active' : 'Inactive'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                {scheduler.email_configured ? <Zap size={18} className="text-blue-500 shrink-0" /> : <AlertCircle size={18} className="text-slate-400 shrink-0" />}
                <div>
                  <p className="text-xs text-[#64748B]">Email service</p>
                  <p className="text-sm font-semibold text-[#0F172A]">{scheduler.email_configured ? 'Configured' : 'Not configured'}</p>
                </div>
              </div>
              {scheduler.next_run && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <Clock size={18} className="text-purple-500 shrink-0" />
                  <div>
                    <p className="text-xs text-[#64748B]">Next check</p>
                    <p className="text-sm font-semibold text-[#0F172A]">{formatNextRun(scheduler.next_run)}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
              <p className="text-sm text-[#64748B] leading-relaxed">
                The scheduler automatically checks all your items every hour. If an item's days remaining matches one of its configured reminder intervals (30, 10, 3, or 0 days), an email is sent to its reminder address — only once per day per interval.
              </p>
            </div>
          </motion.div>
        )}

        {/* Account info */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-3xl border border-slate-100 p-8 shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
          <h3 className="font-['Outfit'] font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
            <Calendar size={16} strokeWidth={1.5} /> Account Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-[#64748B]">Email address</span>
              <span className="font-medium text-[#0F172A]">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-[#64748B]">Account role</span>
              <span className="font-medium text-[#0F172A] capitalize">{user?.role}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
