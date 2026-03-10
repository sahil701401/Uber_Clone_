import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register as registerAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', role: 'rider',
    vehicleType: 'mini', vehicleModel: '', plateNumber: '', vehicleColor: '',
  });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: form.name, email: form.email, phone: form.phone,
        password: form.password, role: form.role,
      };
      if (form.role === 'driver') {
        payload.vehicleDetails = {
          type: form.vehicleType, model: form.vehicleModel,
          plateNumber: form.plateNumber, color: form.vehicleColor,
        };
      }
      const { data } = await registerAPI(payload);
      login(data);
      toast.success(`Account created! Welcome, ${data.name} 🎉`);
      navigate(data.role === 'driver' ? '/driver' : '/rider');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card wide">
        <div className="auth-logo">
          <span className="logo-icon">🚕</span>
          <h1>Join <span className="pink">Uber Jaipur</span></h1>
          <p>Create your account to get started</p>
        </div>

        <div className="role-tabs">
          <button
            className={form.role === 'rider' ? 'active' : ''}
            onClick={() => setForm({ ...form, role: 'rider' })}
            type="button"
          >🧍 I'm a Rider</button>
          <button
            className={form.role === 'driver' ? 'active' : ''}
            onClick={() => setForm({ ...form, role: 'driver' })}
            type="button"
          >🚗 I'm a Driver</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" placeholder="Your full name"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input type="tel" placeholder="+91 98765 43210"
                value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
            </div>
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" placeholder="you@example.com"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" placeholder="Minimum 6 characters"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
          </div>

          {form.role === 'driver' && (
            <div className="driver-fields">
              <h3>🚗 Vehicle Details</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Vehicle Type</label>
                  <select value={form.vehicleType} onChange={e => setForm({ ...form, vehicleType: e.target.value })}>
                    <option value="auto">Auto Rickshaw</option>
                    <option value="mini">Mini (Hatchback)</option>
                    <option value="sedan">Sedan</option>
                    <option value="suv">SUV / Premium</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Vehicle Color</label>
                  <input type="text" placeholder="e.g. White, Black"
                    value={form.vehicleColor} onChange={e => setForm({ ...form, vehicleColor: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Vehicle Model</label>
                  <input type="text" placeholder="e.g. Maruti Swift"
                    value={form.vehicleModel} onChange={e => setForm({ ...form, vehicleModel: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Plate Number</label>
                  <input type="text" placeholder="RJ14 AB 1234"
                    value={form.plateNumber} onChange={e => setForm({ ...form, plateNumber: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <span className="spinner"></span> : 'Create Account'}
          </button>
        </form>
        <p className="auth-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
