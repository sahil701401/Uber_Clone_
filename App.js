import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import RiderDashboard from './pages/RiderDashboard';
import DriverDashboard from './pages/DriverDashboard';
import RideHistory from './pages/RideHistory';
import WalletPage from './pages/WalletPage';
import './App.css';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner large"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && user.role !== requiredRole) return <Navigate to={user.role === 'driver' ? '/driver' : '/rider'} replace />;
  return children;
};

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login"   element={user ? <Navigate to={user.role==='driver'?'/driver':'/rider'}/> : <Login/>}/>
      <Route path="/register" element={user ? <Navigate to={user.role==='driver'?'/driver':'/rider'}/> : <Register/>}/>
      <Route path="/rider"  element={<ProtectedRoute requiredRole="rider"><RiderDashboard/></ProtectedRoute>}/>
      <Route path="/driver" element={<ProtectedRoute requiredRole="driver"><DriverDashboard/></ProtectedRoute>}/>
      <Route path="/history" element={<ProtectedRoute><RideHistory/></ProtectedRoute>}/>
      <Route path="/wallet"  element={<ProtectedRoute><WalletPage/></ProtectedRoute>}/>
      <Route path="/" element={user ? <Navigate to={user.role==='driver'?'/driver':'/rider'}/> : <Navigate to="/login"/>}/>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style: { background: '#1a1a2e', color: '#fff', border: '1px solid #e94560' }, duration: 3000,
        }}/>
        <AppRoutes/>
      </BrowserRouter>
    </AuthProvider>
  );
}
