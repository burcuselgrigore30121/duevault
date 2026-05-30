import { useState, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, LogOut, User, ChevronDown, Menu, X, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
const SearchModal = lazy(() => import('./SearchModal'));

const NAV_LINKS = [
  { path: '/dashboard',  label: 'Dashboard' },
  { path: '/documents',  label: 'Documents' },
  { path: '/vehicles',   label: 'Vehicles' },
  { path: '/payments',   label: 'Payments' },
  { path: '/warranties', label: 'Warranties' },
  { path: '/reminders',  label: 'Reminders' },
];

export default function TopNav() {
  const { user, logout } = useAuth();
  const { openAddModal } = useModal();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
    <header className="sticky top-0 z-50 glass border-b border-white/30 shadow-[0_2px_20px_rgba(0,0,0,0.04)]">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <button
          onClick={() => navigate('/dashboard')}
          data-testid="nav-logo"
          className="flex items-center gap-2.5 shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-cyan-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm font-['Outfit']">D</span>
          </div>
          <span className="text-[#0F172A] font-bold text-lg tracking-tight font-['Outfit'] hidden sm:block">
            Due<span className="gradient-text">Vault</span>
          </span>
        </button>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map(({ path, label }) => (
            <button
              key={path}
              data-testid={`nav-link-${label.toLowerCase()}`}
              onClick={() => navigate(path)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                location.pathname === path
                  ? 'bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 text-blue-600'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100/80'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search button */}
          <button
            data-testid="nav-search-btn"
            onClick={() => setSearchOpen(true)}
            className="p-2.5 rounded-full hover:bg-slate-100/80 transition-colors text-[#64748B] hover:text-[#0F172A]"
          >
            <Search size={18} strokeWidth={1.5} />
          </button>

          <button
            data-testid="nav-add-btn"
            onClick={() => openAddModal()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 text-white text-sm font-semibold shadow-[0_4px_14px_rgba(59,130,246,0.35)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.45)] hover:scale-105 transition-all duration-200"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span className="hidden sm:block">Add</span>
          </button>

          {/* Profile dropdown */}
          <div className="relative">
            <button
              data-testid="nav-profile-btn"
              onClick={() => setProfileOpen(p => !p)}
              className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-slate-100/80 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="hidden md:block text-sm font-medium text-[#0F172A] max-w-[100px] truncate">
                {user?.full_name?.split(' ')[0]}
              </span>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-12 w-52 glass rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/50 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="font-semibold text-[#0F172A] text-sm truncate">{user?.full_name}</p>
                  <p className="text-xs text-[#64748B] truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { navigate('/profile'); setProfileOpen(false); }}
                  data-testid="nav-profile-settings-btn"
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#64748B] hover:bg-slate-50 transition-colors"
                >
                  <User size={15} /> Profile & Settings
                </button>
                <button
                  data-testid="nav-logout-btn"
                  onClick={() => { logout(); setProfileOpen(false); navigate('/'); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu */}
          <button
            data-testid="nav-mobile-menu"
            onClick={() => setMobileOpen(p => !p)}
            className="lg:hidden p-2 rounded-full hover:bg-slate-100 transition-colors"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white/95 backdrop-blur-xl px-4 py-3 flex flex-col gap-1">
          {NAV_LINKS.map(({ path, label }) => (
            <button
              key={path}
              onClick={() => { navigate(path); setMobileOpen(false); }}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                location.pathname === path ? 'bg-blue-50 text-blue-600' : 'text-[#64748B] hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </header>

    {searchOpen && (
      <Suspense fallback={null}>
        <SearchModal onClose={() => setSearchOpen(false)} />
      </Suspense>
    )}
  </>
  );
}
