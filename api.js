import axios from 'axios';

const API = axios.create({ baseURL: '/api' });

API.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem('uberJaipurUser') || '{}');
  if (user.token) config.headers.Authorization = `Bearer ${user.token}`;
  return config;
});

// Auth
export const register         = (data) => API.post('/auth/register', data);
export const login            = (data) => API.post('/auth/login', data);
export const getMe            = ()     => API.get('/auth/me');
export const updateLocation   = (data) => API.put('/auth/update-location', data);
export const toggleAvailability = ()   => API.put('/auth/toggle-availability');

// Rides
export const estimateFare    = (data) => API.post('/rides/estimate', data);
export const bookRide        = (data) => API.post('/rides/book', data);
export const getActiveRide   = ()     => API.get('/rides/active');
export const getRideHistory  = ()     => API.get('/rides/history');
export const getAvailableRides = ()   => API.get('/rides/available');
export const acceptRide      = (id)   => API.put(`/rides/${id}/accept`);
export const startRide       = (id, otp) => API.put(`/rides/${id}/start`, { otp });
export const completeRide    = (id)   => API.put(`/rides/${id}/complete`);
export const cancelRide      = (id, reason) => API.put(`/rides/${id}/cancel`, { reason });
export const rateRide        = (id, rating) => API.put(`/rides/${id}/rate`, { rating });

// Wallet
export const getWallet       = ()     => API.get('/wallet');
export const addMoney        = (data) => API.post('/wallet/add', data);
export const getTransactions = ()     => API.get('/wallet/transactions');

// Promos — fixed: /promo not /promos
export const validatePromo      = (data) => API.post('/promo/validate', { code: data.code, rideAmount: data.fare || data.rideAmount });
export const getAvailablePromos = ()     => API.get('/promo/available');
export const applyPromo         = (data) => API.post('/promo/apply', data);

// Notifications
export const getNotifications = ()   => API.get('/notifications');
export const markAllRead      = ()   => API.put('/notifications/read-all');
export const markOneRead      = (id) => API.put(`/notifications/${id}/read`);
export const clearNotifications = () => API.delete('/notifications');
