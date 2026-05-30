import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, formatError } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', remember_me: true });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/login', form);
      login(data.user, data.token, form.remember_me);
      navigate('/dashboard');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-cyan-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg font-['Outfit']">D</span>
            </div>
            <span className="text-[#0F172A] font-bold text-2xl tracking-tight font-['Outfit']">
              Due<span className="gradient-text">Vault</span>
            </span>
          </button>
          <h1 className="font-['Outfit'] text-2xl font-bold text-[#0F172A]">Welcome back</h1>
          <p className="text-[#64748B] mt-1.5 text-sm">Sign in to your account</p>
        </div>

        <div className="glass rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <form onSubmit={handleSubmit} data-testid="login-form" className="flex flex-col gap-4">
            {error && (
              <div data-testid="login-error" className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Email address</label>
              <input
                name="email" value={form.email} onChange={handleChange} type="email" required
                data-testid="login-email"
                placeholder="Email address"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/80 text-[#0F172A] placeholder-slate-400 text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1.5">Password</label>
              <input
                name="password" value={form.password} onChange={handleChange} type="password" required
                data-testid="login-password"
                placeholder="Password"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/80 text-[#0F172A] placeholder-slate-400 text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
              />
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox" name="remember_me" checked={form.remember_me} onChange={handleChange}
                data-testid="login-remember"
                className="w-4 h-4 rounded border-slate-300 accent-purple-500"
              />
              <span className="text-sm text-[#64748B]">Remember me</span>
            </label>

            <button
              type="submit"
              data-testid="login-submit-btn"
              disabled={loading}
              className="mt-1 w-full py-3.5 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 text-white font-semibold text-base shadow-[0_6px_20px_rgba(99,102,241,0.35)] hover:shadow-[0_8px_28px_rgba(99,102,241,0.45)] hover:scale-[1.02] disabled:opacity-60 disabled:scale-100 transition-all duration-200"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <p className="text-center text-sm text-[#64748B]">
              No account yet?{' '}
              <button type="button" onClick={() => navigate('/')} data-testid="goto-register-link" className="font-semibold text-blue-600 hover:underline">
                Create one
              </button>
            </p>
          </form>
        </div>

        {/* Demo credentials hint */}
        <div className="mt-4 p-4 rounded-2xl bg-blue-50/80 border border-blue-100 text-center">
          <p className="text-xs text-[#64748B]">Demo account: <span className="font-semibold text-[#0F172A]">demo@duevault.com</span> / <span className="font-semibold text-[#0F172A]">demo123</span></p>
        </div>
      </motion.div>
    </div>
  );
}
