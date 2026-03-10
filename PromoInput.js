import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function PromoInput({ rideAmount, onPromoApplied, onPromoRemoved }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [availablePromos, setAvailablePromos] = useState([]);
  const [showAvailable, setShowAvailable] = useState(false);

  useEffect(() => {
    fetchAvailablePromos();
  }, []);

  const fetchAvailablePromos = async () => {
    try {
      const { data } = await axios.get('/api/promo/available');
      setAvailablePromos(data);
    } catch {}
  };

  const validatePromo = async (promoCode) => {
    const codeToUse = promoCode || code;
    if (!codeToUse.trim()) return toast.error('Enter a promo code');
    setLoading(true);
    try {
      const { data } = await axios.post('/api/promo/validate', {
        code: codeToUse, rideAmount,
      });
      setAppliedPromo(data);
      onPromoApplied({ code: data.code, discount: data.discount, finalAmount: data.finalAmount });
      toast.success(data.message);
      setShowAvailable(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid promo code');
      setAppliedPromo(null);
    } finally { setLoading(false); }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setCode('');
    onPromoRemoved();
    toast('Promo code removed');
  };

  return (
    <div className="promo-section">
      {!appliedPromo ? (
        <>
          <div className="promo-input-row">
            <input
              type="text"
              placeholder="Enter promo code"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              className="promo-input"
              onKeyDown={e => e.key === 'Enter' && validatePromo()}
            />
            <button className="btn-apply" onClick={() => validatePromo()} disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Apply'}
            </button>
          </div>

          {/* Available promos toggle */}
          <button className="show-promos-btn" onClick={() => setShowAvailable(!showAvailable)}>
            🎟️ {availablePromos.length} promo{availablePromos.length !== 1 ? 's' : ''} available {showAvailable ? '▲' : '▼'}
          </button>

          {showAvailable && availablePromos.length > 0 && (
            <div className="available-promos">
              {availablePromos.map(promo => (
                <div key={promo._id} className="promo-card" onClick={() => { setCode(promo.code); validatePromo(promo.code); }}>
                  <div className="promo-code-tag">{promo.code}</div>
                  <div className="promo-desc">{promo.description}</div>
                  <div className="promo-meta">
                    {promo.discountType === 'percentage'
                      ? `${promo.discountValue}% off (max ₹${promo.maxDiscount})`
                      : `₹${promo.discountValue} flat off`}
                    {promo.minRideAmount > 0 && ` • Min ₹${promo.minRideAmount}`}
                  </div>
                  <div className="promo-expiry">
                    Expires: {new Date(promo.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="promo-applied">
          <div className="promo-applied-info">
            <span className="promo-tag">🎟️ {appliedPromo.code}</span>
            <span className="promo-savings">You save ₹{appliedPromo.discount}!</span>
          </div>
          <div className="promo-breakdown">
            <span>Original: ₹{appliedPromo.originalAmount}</span>
            <span className="discount-line">- ₹{appliedPromo.discount} discount</span>
            <span className="final-fare">Final: ₹{appliedPromo.finalAmount}</span>
          </div>
          <button className="remove-promo" onClick={removePromo}>✕ Remove</button>
        </div>
      )}
    </div>
  );
}
