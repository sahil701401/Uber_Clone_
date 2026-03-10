import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getWallet, addMoney } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000];
const PAYMENT_METHODS = [
  { key: 'upi', label: 'UPI', icon: '📱', desc: 'GPay, PhonePe, Paytm' },
  { key: 'debit', label: 'Debit Card', icon: '💳', desc: 'All major banks' },
  { key: 'netbanking', label: 'Net Banking', icon: '🏦', desc: 'All major banks' },
];

export default function WalletPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { fetchWallet(); }, []);

  const fetchWallet = async () => {
    try {
      const { data } = await getWallet();
      setBalance(data.balance);
      setTransactions(data.transactions);
    } catch {} finally { setLoading(false); }
  };

  const handleAddMoney = async () => {
    const amt = Number(amount);
    if (!amt || amt < 10) return toast.error('Minimum amount is Rs.10');
    if (amt > 10000) return toast.error('Maximum amount is Rs.10,000');
    setAdding(true);
    try {
      await new Promise(r => setTimeout(r, 1500));
      const { data } = await addMoney({ amount: amt, method });
      setBalance(data.balance);
      setTransactions(prev => [data.transaction, ...prev]);
      toast.success('Rs.' + amt + ' added to your wallet!');
      setAmount('');
      setActiveTab('overview');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    } finally { setAdding(false); }
  };

  const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="wallet-page">
      <div className="wallet-header">
        <button className="back-btn" onClick={() => navigate(user.role === 'driver' ? '/driver' : '/rider')}>
          Back
        </button>
        <h2>My Wallet</h2>
      </div>

      <div className="wallet-balance-card">
        <p className="balance-label">Available Balance</p>
        <h1 className="balance-amount">Rs.{balance.toFixed(2)}</h1>
        <p className="balance-sub">Uber Jaipur Wallet</p>
      </div>

      <div className="wallet-tabs">
        <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={activeTab === 'add' ? 'active' : ''} onClick={() => setActiveTab('add')}>Add Money</button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>History</button>
      </div>

      <div className="wallet-content">
        {activeTab === 'overview' && (
          <div className="wallet-overview">
            <div className="wallet-stats-grid">
              <div className="wallet-stat">
                <div className="ws-value">Rs.{transactions.filter(t=>t.type==='debit').reduce((s,t)=>s+t.amount,0)}</div>
                <div className="ws-label">Total Spent</div>
              </div>
              <div className="wallet-stat">
                <div className="ws-value">Rs.{transactions.filter(t=>t.type==='credit').reduce((s,t)=>s+t.amount,0)}</div>
                <div className="ws-label">Total Added</div>
              </div>
              <div className="wallet-stat">
                <div className="ws-value">{transactions.length}</div>
                <div className="ws-label">Transactions</div>
              </div>
            </div>
            <h3 className="section-title">Recent Transactions</h3>
            {loading ? <div className="loading-state">Loading...</div> :
              transactions.length === 0 ? (
                <div className="empty-state small"><span>💳</span><p>No transactions yet</p></div>
              ) : (
                <div className="txn-list">
                  {transactions.slice(0,5).map((t,i) => (
                    <div key={i} className="txn-item">
                      <div className={"txn-icon " + t.type}>{t.type==='credit'?'↓':'↑'}</div>
                      <div className="txn-details">
                        <div className="txn-desc">{t.description}</div>
                        <div className="txn-date">{formatDate(t.createdAt)}</div>
                      </div>
                      <div className={"txn-amount " + t.type}>{t.type==='credit'?'+':'-'}Rs.{t.amount}</div>
                    </div>
                  ))}
                  {transactions.length > 5 && (
                    <button className="view-all-btn" onClick={() => setActiveTab('history')}>View all {transactions.length} transactions</button>
                  )}
                </div>
              )
            }
            <button className="btn-primary" style={{marginTop:'20px'}} onClick={() => setActiveTab('add')}>+ Add Money to Wallet</button>
          </div>
        )}

        {activeTab === 'add' && (
          <div className="add-money-panel">
            <h3 className="section-title">Add Money</h3>
            <div className="quick-amounts">
              {QUICK_AMOUNTS.map(a => (
                <button key={a} className={"quick-amt " + (Number(amount)===a?'selected':'')} onClick={() => setAmount(a.toString())}>Rs.{a}</button>
              ))}
            </div>
            <div className="form-group">
              <label>Or enter amount</label>
              <div className="amount-input-wrapper">
                <span className="currency-symbol">Rs.</span>
                <input type="number" placeholder="Enter amount" value={amount} onChange={e => setAmount(e.target.value)} min="10" max="10000"/>
              </div>
              <span className="input-hint">Min: Rs.10 | Max: Rs.10,000</span>
            </div>
            <h3 className="section-title">Payment Method</h3>
            <div className="payment-methods">
              {PAYMENT_METHODS.map(pm => (
                <div key={pm.key} className={"payment-method-card " + (method===pm.key?'selected':'')} onClick={() => setMethod(pm.key)}>
                  <span className="pm-icon">{pm.icon}</span>
                  <div className="pm-info"><div className="pm-label">{pm.label}</div><div className="pm-desc">{pm.desc}</div></div>
                  {method===pm.key && <span className="pm-check">✓</span>}
                </div>
              ))}
            </div>
            <div className="add-summary">
              <div className="sum-row"><span>Amount</span><span>Rs.{amount||0}</span></div>
              <div className="sum-row total"><span>Total Payable</span><strong>Rs.{amount||0}</strong></div>
            </div>
            <button className="btn-primary" onClick={handleAddMoney} disabled={adding || !amount}>
              {adding ? <span>Processing Payment...</span> : `Pay Rs.${amount||0} via ${PAYMENT_METHODS.find(p=>p.key===method)?.label}`}
            </button>
            <p className="secure-note">🔒 100% Secure Payment (Simulated)</p>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-panel">
            <h3 className="section-title">All Transactions ({transactions.length})</h3>
            {transactions.length === 0 ? (
              <div className="empty-state small"><span>📋</span><p>No transactions yet</p></div>
            ) : (
              <div className="txn-list">
                {transactions.map((t,i) => (
                  <div key={i} className="txn-item">
                    <div className={"txn-icon " + t.type}>{t.type==='credit'?'↓':'↑'}</div>
                    <div className="txn-details">
                      <div className="txn-desc">{t.description}</div>
                      <div className="txn-date">{formatDate(t.createdAt)}</div>
                    </div>
                    <div className="txn-right">
                      <div className={"txn-amount " + t.type}>{t.type==='credit'?'+':'-'}Rs.{t.amount}</div>
                      <div className={"txn-status " + t.status}>{t.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
