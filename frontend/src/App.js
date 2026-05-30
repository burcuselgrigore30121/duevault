import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ModalProvider, useModal } from './contexts/ModalContext';
import { Toaster } from './components/ui/sonner';
import './App.css';

const LandingPage   = lazy(() => import('./pages/LandingPage'));
const LoginPage     = lazy(() => import('./pages/LoginPage'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Vehicles      = lazy(() => import('./pages/Vehicles'));
const VehicleDetail = lazy(() => import('./pages/VehicleDetail'));
const ItemDetail    = lazy(() => import('./pages/ItemDetail'));
const CategoryPage  = lazy(() => import('./pages/CategoryPage'));
const ProfilePage   = lazy(() => import('./pages/ProfilePage'));
const TopNav        = lazy(() => import('./components/TopNav'));
const AddItemModal  = lazy(() => import('./components/AddItemModal'));

/* ─────────────────────────────────────────
   Vault Entry Screen — shown after login
───────────────────────────────────────── */
function VaultEntryScreen() {
  return (
    <motion.div
      key="vault-entry"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.04 }}
      transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 45%, #0C1445 100%)' }}
    >
      {/* Ambient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)' }}
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-1/3 right-1/3 w-[400px] h-[400px] rounded-full blur-[100px]"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)' }}
        />
      </div>

      {/* Logo + text */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.2, 0, 0, 1] }}
        className="relative z-10 flex flex-col items-center gap-5"
      >
        {/* Floating logo */}
        <motion.div
          animate={{ y: [-5, 5, -5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-20 h-20 rounded-[22px] flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6, #06B6D4)',
            boxShadow: '0 0 60px rgba(99,102,241,0.45), 0 20px 40px rgba(0,0,0,0.3)',
          }}
        >
          <span className="text-white font-bold text-4xl" style={{ fontFamily: 'Outfit, sans-serif' }}>D</span>
        </motion.div>

        {/* Name */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4 }}
          className="text-white font-bold text-2xl tracking-tight"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          DueVault
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.55 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="text-slate-300 text-xs tracking-[0.22em] uppercase"
        >
          Loading your deadlines
        </motion.p>

        {/* Animated dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex gap-1.5"
        >
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              animate={{ opacity: [0.25, 1, 0.25], scale: [0.7, 1, 0.7] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
              className="w-1.5 h-1.5 rounded-full bg-blue-400"
            />
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   Generic full-page spinner
───────────────────────────────────────── */
function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

/* ─────────────────────────────────────────
   App content — knows auth state
───────────────────────────────────────── */
function AppContent() {
  const { user, loading } = useAuth();
  const { addItemModal, closeModal } = useModal();

  /* Show entry screen only on active login, not on page refresh */
  const [showEntry, setShowEntry]   = useState(false);
  const initialLoadDone             = useRef(false);
  const prevUser                    = useRef(null);

  useEffect(() => {
    if (loading) return;
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      prevUser.current = user;
      return;
    }
    if (user && !prevUser.current) {
      setShowEntry(true);
      const t = setTimeout(() => setShowEntry(false), 1750);
      return () => clearTimeout(t);
    }
    prevUser.current = user;
  }, [user, loading]);

  if (loading) return <Spinner />;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Vault entry animation */}
      <AnimatePresence>
        {showEntry && <VaultEntryScreen key="entry" />}
      </AnimatePresence>

      {user && (
        <Suspense fallback={null}>
          <TopNav />
        </Suspense>
      )}

      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/"             element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
          <Route path="/login"        element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
          <Route path="/dashboard"    element={user ? <Dashboard /> : <Navigate to="/" />} />
          <Route path="/documents"    element={user ? <CategoryPage type="personal_document" title="Documents" /> : <Navigate to="/" />} />
          <Route path="/vehicles"     element={user ? <Vehicles /> : <Navigate to="/" />} />
          <Route path="/vehicles/:id" element={user ? <VehicleDetail /> : <Navigate to="/" />} />
          <Route path="/payments"     element={user ? <CategoryPage type="payment" title="Payments & Subscriptions" /> : <Navigate to="/" />} />
          <Route path="/warranties"   element={user ? <CategoryPage type="warranty" title="Warranties" /> : <Navigate to="/" />} />
          <Route path="/reminders"    element={user ? <CategoryPage type="reminder" title="Reminders" /> : <Navigate to="/" />} />
          <Route path="/items/:id"    element={user ? <ItemDetail /> : <Navigate to="/" />} />
          <Route path="/profile"      element={user ? <ProfilePage /> : <Navigate to="/" />} />
          <Route path="*"             element={<Navigate to="/" />} />
        </Routes>
      </Suspense>

      {addItemModal.open && (
        <Suspense fallback={null}>
          <AddItemModal
            item={addItemModal.item}
            defaultType={addItemModal.defaultType}
            onClose={closeModal}
            onSaved={closeModal}
          />
        </Suspense>
      )}

      <Toaster position="top-right" richColors />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ModalProvider>
          <AppContent />
        </ModalProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
