import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Shield, Clock, Bell, FileText, Car, CreditCard, ChevronDown } from 'lucide-react';
import { api, formatError } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const BRAND = 'DueVault'.split('');

const FLOAT_CARDS = [
  { label: 'Insurance',         sub: 'Vehicle document',     days: 18,  status: 'warning',  pos: 'top-[16%] left-[7%]',   rot: -4, delay: 0    },
  { label: 'Bank Installment',  sub: 'Payment',              days: 5,   status: 'urgent',   pos: 'top-[11%] right-[6%]',  rot: 3,  delay: 0.4  },
  { label: 'Passport',          sub: 'Personal document',    days: 42,  status: 'safe',     pos: 'bottom-[26%] left-[4%]',rot: -2, delay: 0.8  },
  { label: 'Streaming Plan',    sub: 'Subscription',         days: 12,  status: 'warning',  pos: 'bottom-[20%] right-[5%]',rot: 2, delay: 0.25 },
];

const STATUS_COLORS = {
  safe:    'text-emerald-600 bg-emerald-50',
  warning: 'text-amber-600  bg-amber-50',
  urgent:  'text-orange-600 bg-orange-50',
  critical:'text-red-600    bg-red-50',
};

const FEATURES = [
  { icon: FileText,   title: 'Personal Documents',      desc: 'Passport, ID, driver license and all important documents in one place.' },
  { icon: Car,        title: 'Vehicle Deadlines',       desc: 'Insurance, inspection, vignette and service reminders for all your vehicles.' },
  { icon: CreditCard, title: 'Payments & Subscriptions',desc: 'Bank installments, rent, utilities and recurring subscriptions.' },
  { icon: Shield,     title: 'Warranties',              desc: 'Electronics, appliances and home warranties tracked automatically.' },
  { icon: Bell,       title: 'Smart Reminders',         desc: 'Email notifications at 30, 10 and 3 days before every deadline.' },
  { icon: Clock,      title: 'Status Tracking',         desc: 'Real-time status: Safe, Warning, Urgent, Critical and Expired.' },
];

/* ── Floating card with hover tilt ── */
function FloatCard({ card, index }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [hover, setHover] = useState(false);

  const handleMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width  - 0.5;
    const y = (e.clientY - r.top)  / r.height - 0.5;
    setTilt({ rx: -y * 8, ry: x * 10 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setTilt({ rx: 0, ry: 0 }); }}
      initial={{ opacity: 0, y: 16 }}
      animate={{
        opacity: 1,
        y: [0, -10, 0],
        rotate: [card.rot, card.rot + 0.6, card.rot],
      }}
      transition={{
        opacity: { duration: 0.6, delay: 0.4 + index * 0.08 },
        y:      { duration: 5.5 + index * 0.4, repeat: Infinity, ease: 'easeInOut', delay: card.delay },
        rotate: { duration: 6 + index * 0.5,   repeat: Infinity, ease: 'easeInOut', delay: card.delay },
      }}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        transformStyle: 'preserve-3d',
      }}
      className={`absolute hidden lg:block pointer-events-auto ${card.pos}`}
    >
      <div
        className="glass rounded-2xl px-5 py-3.5 transition-all duration-300"
        style={{
          boxShadow: hover
            ? '0 24px 60px rgba(99,102,241,0.18), 0 8px 20px rgba(0,0,0,0.08)'
            : '0 8px 32px rgba(0,0,0,0.07)',
          borderColor: hover ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.5)',
          transform: hover ? 'translateY(-4px)' : 'translateY(0)',
        }}
      >
        <div className="flex items-center justify-between gap-6 min-w-[210px]">
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">{card.label}</p>
            <p className="text-xs text-[#64748B] mt-0.5">{card.sub}</p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_COLORS[card.status]}`}>
            {card.days}d
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Animated letter that responds to scroll progress ── */
function HeroLetter({ char, index, scrollY }) {
  const start = index * 18;
  const end   = start + 260;
  const y       = useTransform(scrollY, [0, start, end], [0, 0, -180]);
  const opacity = useTransform(scrollY, [0, start, end], [1, 1, 0]);
  const spacing = useTransform(scrollY, [0, end], [0, 14]);
  const blur    = useTransform(scrollY, [0, end], [0, 6]);
  const filter  = useTransform(blur, v => `blur(${v}px)`);

  return (
    <motion.span
      style={{
        y, opacity, filter,
        marginLeft: spacing, marginRight: spacing,
        display: 'inline-block',
      }}
      initial={{ opacity: 0, y: 40, scale: 0.85, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.65, delay: index * 0.08, ease: [0.2, 0, 0, 1] }}
      className="gradient-text"
    >
      {char}
    </motion.span>
  );
}

export default function LandingPage() {
  const navigate  = useNavigate();
  const { login } = useAuth();

  const { scrollY }     = useScroll();
  const subtitleY       = useTransform(scrollY, [0, 380], [0, -80]);
  const subtitleOpacity = useTransform(scrollY, [0, 220], [1, 0]);
  const floatOpacity    = useTransform(scrollY, [0, 200], [1, 0]);
  const indicatorOpacity= useTransform(scrollY, [0, 120], [1, 0]);
  const heroLogoY       = useTransform(scrollY, [0, 400], [0, -120]);
  const heroLogoOpacity = useTransform(scrollY, [0, 280], [1, 0]);

  /* ── form state ── */
  const [form, setForm]     = useState({ full_name: '', email: '', password: '', confirm: '', remember_me: true });
  const [errors, setErrors] = useState({});
  const [loading, setLoading]   = useState(false);
  const [apiError, setApiError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    setErrors(er => ({ ...er, [name]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.full_name.trim())             e.full_name = 'Full name is required';
    if (!form.email.trim())                 e.email     = 'Email is required';
    if (form.password.length < 6)          e.password  = 'Minimum 6 characters';
    if (form.password !== form.confirm)    e.confirm   = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/register', {
        full_name: form.full_name, email: form.email, password: form.password,
      });
      login(data.user, data.token, form.remember_me);
      navigate('/dashboard');
    } catch (err) {
      setApiError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white overflow-x-hidden">

      {/* ════════════ HERO ════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">

        {/* Subtle grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] bg-[size:64px_64px]" />

        {/* Soft gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-blue-400/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-purple-400/6 blur-[100px] pointer-events-none" />

        {/* Floating deadline cards */}
        <motion.div style={{ opacity: floatOpacity }} className="absolute inset-0 pointer-events-none">
          {FLOAT_CARDS.map((c, i) => <FloatCard key={i} card={c} index={i} />)}
        </motion.div>

        {/* Hero content */}
        <motion.div
          style={{ y: heroLogoY, opacity: heroLogoOpacity }}
          className="relative z-10 text-center px-6 max-w-4xl mx-auto w-full"
        >
          {/* Brand name — minimal luxury, thin, wide tracking */}
          <h1
            className="font-['Outfit'] font-light"
            style={{
              fontSize: 'clamp(3.5rem, 10vw, 7.5rem)',
              lineHeight: 1,
              letterSpacing: '0.04em',
            }}
          >
            {BRAND.map((letter, i) => (
              <HeroLetter key={i} char={letter} index={i} scrollY={scrollY} />
            ))}
          </h1>

          {/* Subtitle group — scroll together */}
          <motion.div style={{ y: subtitleY, opacity: subtitleOpacity }}>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.95, duration: 0.55 }}
              className="text-xl md:text-2xl font-medium text-[#0F172A] mt-8 leading-relaxed max-w-2xl mx-auto"
            >
              Never miss an important deadline again.
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.55 }}
              className="text-base md:text-lg text-[#64748B] mt-3 max-w-xl mx-auto"
            >
              Track documents, vehicles, payments, subscriptions and renewals — all in one place.
            </motion.p>
          </motion.div>
        </motion.div>

        {/* Scroll indicator — centered, low opacity, smooth float */}
        <motion.div
          style={{ opacity: indicatorOpacity }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.5 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-10 pointer-events-none"
        >
          <motion.p
            animate={{ opacity: [0.4, 0.65, 0.4] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            className="text-[10px] font-medium text-[#94A3B8] tracking-[0.28em] uppercase"
          >
            Scroll to continue
          </motion.p>
          <motion.div
            animate={{ y: [0, 8, 0], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="text-[#94A3B8]"
          >
            <ChevronDown size={18} strokeWidth={1.5} />
          </motion.div>
        </motion.div>
      </section>

      {/* ════════════ FEATURES ════════════ */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.65 }}
            className="text-center mb-14"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#64748B] mb-3">
              Everything in one place
            </p>
            <h2 className="font-['Outfit'] text-3xl md:text-4xl font-bold text-[#0F172A] tracking-tight">
              Manage all your deadlines effortlessly
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.48, delay: i * 0.07 }}
                className="group p-7 rounded-3xl border border-slate-100 bg-white hover:bg-gradient-to-br hover:from-blue-50/50 hover:to-purple-50/30 hover:border-blue-100 hover:shadow-[0_10px_32px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <f.icon size={22} strokeWidth={1.5} className="text-blue-600" />
                </div>
                <h3 className="font-['Outfit'] font-semibold text-[#0F172A] text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ CREATE ACCOUNT ════════════ */}
      <section id="create-account" className="py-24 px-6 bg-gradient-to-br from-slate-50 via-blue-50/40 to-purple-50/20">
        <div className="max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.65 }}
          >
            <div className="text-center mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#64748B] mb-3">
                Get started
              </p>
              <h2 className="font-['Outfit'] text-3xl font-bold text-[#0F172A] tracking-tight">
                Create your account
              </h2>
              <p className="text-[#64748B] mt-2 text-sm">
                Track all your important deadlines in one secure place.
              </p>
            </div>

            <div className="glass rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
              <form onSubmit={handleRegister} data-testid="register-form" className="flex flex-col gap-4">
                {apiError && (
                  <div data-testid="register-error" className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                    {apiError}
                  </div>
                )}

                {[
                  { name: 'full_name', label: 'Full name',        type: 'text',     placeholder: 'Full name' },
                  { name: 'email',     label: 'Email address',    type: 'email',    placeholder: 'Email address' },
                  { name: 'password',  label: 'Password',         type: 'password', placeholder: 'Password' },
                  { name: 'confirm',   label: 'Confirm password', type: 'password', placeholder: 'Confirm password' },
                ].map(f => (
                  <div key={f.name}>
                    <label className="block text-sm font-medium text-[#0F172A] mb-1.5">{f.label}</label>
                    <input
                      name={f.name} type={f.type} value={form[f.name]}
                      onChange={handleChange}
                      data-testid={`register-${f.name}`}
                      placeholder={f.placeholder}
                      className={`w-full px-4 py-3 rounded-xl border bg-white/80 text-[#0F172A] placeholder-slate-400 text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all ${errors[f.name] ? 'border-red-300' : 'border-slate-200'}`}
                    />
                    {errors[f.name] && <p className="text-red-500 text-xs mt-1">{errors[f.name]}</p>}
                  </div>
                ))}

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox" name="remember_me" checked={form.remember_me}
                    onChange={handleChange} data-testid="register-remember"
                    className="w-4 h-4 rounded border-slate-300 accent-purple-500"
                  />
                  <span className="text-sm text-[#64748B]">Remember me</span>
                </label>

                <button
                  type="submit" data-testid="register-submit-btn" disabled={loading}
                  className="mt-1 w-full py-3.5 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 text-white font-semibold text-base shadow-[0_6px_20px_rgba(99,102,241,0.35)] hover:shadow-[0_8px_28px_rgba(99,102,241,0.45)] hover:scale-[1.02] disabled:opacity-60 disabled:scale-100 transition-all duration-200"
                >
                  {loading ? 'Creating account...' : 'Create account'}
                </button>

                <p className="text-center text-sm text-[#64748B]">
                  Already have an account?{' '}
                  <button
                    type="button" onClick={() => navigate('/login')}
                    data-testid="goto-login-link"
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
