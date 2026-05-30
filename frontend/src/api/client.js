import axios from 'axios';
import { getToken } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

export { API_BASE_URL };

const headers = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const api = {
  get: (url, cfg = {}) => axios.get(`${API_BASE_URL}${url}`, { headers: headers(), ...cfg }),
  post: (url, data, cfg = {}) => axios.post(`${API_BASE_URL}${url}`, data, { headers: headers(), ...cfg }),
  put: (url, data, cfg = {}) => axios.put(`${API_BASE_URL}${url}`, data, { headers: headers(), ...cfg }),
  delete: (url, cfg = {}) => axios.delete(`${API_BASE_URL}${url}`, { headers: headers(), ...cfg }),
};

export const formatError = (e) => {
  const d = e?.response?.data?.detail;
  if (!d) return e?.message || 'Something went wrong';
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map(x => x?.msg || JSON.stringify(x)).join(' ');
  return String(d);
};

export const ITEM_TYPES = {
  personal_document: {
    label: 'Personal Document',
    icon: 'FileText',
    categories: [
      { value: 'passport', label: 'Passport' },
      { value: 'national_id', label: 'National ID' },
      { value: 'driver_license', label: 'Driver License' },
      { value: 'birth_certificate', label: 'Birth Certificate' },
      { value: 'other_document', label: 'Other Document' },
    ],
  },
  vehicle_doc: {
    label: 'Vehicle Document',
    icon: 'Car',
    categories: [
      { value: 'rca', label: 'RCA Insurance' },
      { value: 'itp', label: 'ITP Inspection' },
      { value: 'vignette', label: 'Vignette / Road Tax' },
      { value: 'casco', label: 'CASCO Insurance' },
      { value: 'service', label: 'Service Revision' },
      { value: 'oil_change', label: 'Oil Change' },
      { value: 'tire_change', label: 'Tire Change' },
      { value: 'other_vehicle', label: 'Other Vehicle Doc' },
    ],
  },
  payment: {
    label: 'Payment / Subscription',
    icon: 'CreditCard',
    categories: [
      { value: 'bank_installment', label: 'Bank Installment' },
      { value: 'rent', label: 'Rent' },
      { value: 'utility', label: 'Utility Bill' },
      { value: 'subscription', label: 'Subscription' },
      { value: 'insurance_payment', label: 'Insurance Payment' },
      { value: 'other_payment', label: 'Other Payment' },
    ],
  },
  warranty: {
    label: 'Warranty',
    icon: 'Shield',
    categories: [
      { value: 'electronics_warranty', label: 'Electronics Warranty' },
      { value: 'appliance_warranty', label: 'Appliance Warranty' },
      { value: 'vehicle_warranty', label: 'Vehicle Warranty' },
      { value: 'home_insurance', label: 'Home Insurance' },
      { value: 'other_warranty', label: 'Other Warranty' },
    ],
  },
  reminder: {
    label: 'Custom Reminder',
    icon: 'Bell',
    categories: [{ value: 'custom', label: 'Custom' }],
  },
};

export const getCategoryLabel = (type, cat) => {
  const t = ITEM_TYPES[type];
  if (!t) return cat?.replace(/_/g, ' ') || '';
  const c = t.categories.find(x => x.value === cat);
  return c ? c.label : cat?.replace(/_/g, ' ') || '';
};

export const getTypeLabel = (type) => ITEM_TYPES[type]?.label || type?.replace(/_/g, ' ') || '';
