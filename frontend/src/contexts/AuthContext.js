import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const AuthContext = createContext(null);

const getToken = () => localStorage.getItem('dv_token') || sessionStorage.getItem('dv_token');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    axios.get(`${API_BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setUser(r.data))
      .catch(() => { localStorage.removeItem('dv_token'); sessionStorage.removeItem('dv_token'); })
      .finally(() => setLoading(false));
  }, []);

  const login = (userData, token, rememberMe) => {
    if (rememberMe) localStorage.setItem('dv_token', token);
    else sessionStorage.setItem('dv_token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('dv_token');
    sessionStorage.removeItem('dv_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export { getToken };
