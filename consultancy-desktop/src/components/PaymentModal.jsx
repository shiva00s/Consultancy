import React, { useState } from 'react';
import { FiX, FiDollarSign } from 'react-icons/fi';
import { formatCurrency } from '../utils/format';

// Constants
const paymentStatusOptions = ['Pending', 'Partial', 'Paid', 'Refunded'];

function PaymentModal({ user, payment, onClose, onSave }) {
  // Store the original amount_paid from the prop
  const [originalAmount] = useState(payment.amount_paid);

  const [newPayment, setNewPayment] = useState(''); // Amount to add (input string)
  const [status, setStatus] = useState(payment.status); // Manual status override (select string)
  const [error, setError] = useState('');

  const handleSave = () => {
    setError('');

    // --- 1. Input Validation ---
    if (newPayment && parseFloat(newPayment) < 0) {
        setError("New payment amount cannot be negative.");
        return;
    }
    
    // --- 2. Calculate Updated Amounts ---
    const currentAmountPaid = parseFloat(originalAmount) || 0;
    const addedAmount = parseFloat(newPayment) || 0; 
    const totalAmountDue = parseFloat(payment.total_amount) || 0;

    // The potential updated total amount paid
    let updatedAmount = currentAmountPaid + addedAmount;
    
    // 🐞 FIX: Initialize the status variable (was missing in previous patch)
    let calculatedStatus = status; 
    
    // --- 💥 FIX: Overpayment Prevention Check (Caps only if not intentionally refunding) ---
    // Only cap payment if the resulting status is NOT intended to be Refunded.
    if (calculatedStatus !== 'Refunded' && updatedAmount > totalAmountDue) {
        // Calculate the maximum allowed amount to add
        const maxAllowedAdd = totalAmountDue - currentAmountPaid;
        
        if (maxAllowedAdd >= 0) {
            // Recalculate the updated amount to exactly match totalAmountDue
            updatedAmount = totalAmountDue;
        } else {
            // If already overpaid, cap it at totalDue (prevents further accidental increases)
            updatedAmount = totalAmountDue;
        }
    }
    // --- END NEW CHECK ---

    // --- 4. Determine Final Status (Post-cap calculation) ---
    // If user selected 'Refunded', respect it. Otherwise, calculate status based on actual capped/paid amount.
    if (calculatedStatus !== 'Refunded') { 
      if (updatedAmount >= totalAmountDue) {
        calculatedStatus = 'Paid';
      } else if (updatedAmount > 0) {
        calculatedStatus = 'Partial';
      } else {
        calculatedStatus = 'Pending';
      }
    }
    
    // --- 5. Pass Data to Parent and Close ---
    onSave({
      user, 
      id: payment.id,
      total_amount: totalAmountDue, 
      amount_paid: updatedAmount,   // The capped or calculated amount
      status: calculatedStatus,     // The final calculated or overridden status
    });
    onClose();
  };

  // Calculate values for display
  const amountRemaining = (parseFloat(payment.total_amount) || 0) - (parseFloat(originalAmount) || 0);
  const projectedAmountPaid = (parseFloat(originalAmount) || 0) + (parseFloat(newPayment) || 0);
  const totalAmountDue = parseFloat(payment.total_amount) || 0;
  const isOverpaying = newPayment && (parseFloat(newPayment) > 0) && (projectedAmountPaid > totalAmountDue && status !== 'Refunded');
  
  // Custom helper for display message based on projected amount
  const getProjectedMessage = () => {
      if (!newPayment || parseFloat(newPayment) <= 0) return null;
      
      if (projectedAmountPaid > totalAmountDue && status !== 'Refunded') {
          const excess = projectedAmountPaid - totalAmountDue;
          return <small style={{ marginTop: '0.5rem', display: 'block', color: 'var(--danger-color)' }}>
              Projected Paid: {formatCurrency(projectedAmountPaid)}. **Warning: {formatCurrency(excess)} excess (Capped).**
          </small>;
      }
      return <small style={{ marginTop: '0.5rem', display: 'block' }}>
          Projected Paid: {formatCurrency(projectedAmountPaid)}
      </small>;
  }

  return (
    <div className="viewer-modal-backdrop" onClick={onClose}>
      <div
        className="viewer-modal-content payment-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '450px', height: 'fit-content' }}
      >
        <button className="viewer-close-btn" onClick={onClose}>
          <FiX />
        </button>
        <div className="viewer-header">
          <h3><FiDollarSign /> Update Payment: {payment.description}</h3>
        </div>
        <div className="payment-modal-body" style={{ padding: '2rem' }}>
          
          {error && <div className="form-message error" style={{marginBottom: '1rem'}}>{error}</div>}

          <div className="payment-modal-info" style={{marginBottom: '1.5rem', padding: '10px', background: 'var(--bg-input)', borderRadius: 'var(--border-radius)'}}>
            <p style={{color: 'var(--text-primary)', marginBottom: '5px'}}>
              Total Invoiced:{' '}
              <strong>{formatCurrency(payment.total_amount)}</strong>
            </p>
            <p style={{color: 'var(--text-primary)', marginBottom: '5px'}}>
              Currently Paid:{' '}
              <strong style={{color: 'var(--success-color)'}}>{formatCurrency(originalAmount)}</strong>
            </p>
            <p style={{color: 'var(--text-primary)'}}>
              Amount Due:{' '}
              <strong style={{color: amountRemaining > 0 ? 'var(--danger-color)' : 'var(--success-color)'}}>
                {formatCurrency(amountRemaining > 0 ? amountRemaining : 0)}
              </strong>
            </p>
          </div>
          
          <div className="form-grid" style={{ padding: 0 }}>
            <div className="form-group">
              <label>Amount to Add Now</label>
              <input
                type="number"
                step="0.01"
                value={newPayment}
                onChange={(e) => setNewPayment(e.target.value)}
                placeholder="0.00"
              />
              {getProjectedMessage()}
            </div>
            
            <div className="form-group">
              <label>Manual Status Override</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {paymentStatusOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <button
            className="btn btn-full-width"
            style={{ marginTop: '1.25rem' }}
            onClick={handleSave}
            disabled={isOverpaying}
          >
            Save Payment Update
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentModal;