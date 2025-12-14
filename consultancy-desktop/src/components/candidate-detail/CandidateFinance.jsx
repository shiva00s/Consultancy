import React, { useState, useEffect, useCallback } from 'react';
import { FiDollarSign, FiEdit2, FiTrash2, FiPlus, FiLock } from 'react-icons/fi';
import PaymentModal from '../PaymentModal';
import { formatCurrency } from '../../utils/format';
import toast from 'react-hot-toast';
import '../../css/CandidateFinance.css';
import useAuthStore from '../../store/useAuthStore';

const initialPaymentForm = {
  description: '',
  total_amount: '',
  amount_paid: '',
  due_date: '',
};

function CandidateFinance({ candidateId, flags }) {
  const authUser = useAuthStore((state) => state.user);

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);

  // ✅ FIXED: Proper permission check
  const isFinanceEnabled =
    authUser?.role === 'super_admin' ||
    authUser?.role === 'admin' ||
    (flags?.isFinanceTrackingEnabled ?? false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getCandidatePayments({
        user: authUser,
        candidateId,
      });
      if (res.success) {
        setPayments(res.data || []);
      } else {
        console.error('Payment fetch error:', res.error);
        toast.error(res.error || 'Failed to load payments');
      }
    } catch (err) {
      console.error('getCandidatePayments error:', err);
      toast.error('Failed to load payments');
    }
    setLoading(false);
  }, [candidateId, authUser]);

  useEffect(() => {
    if (!candidateId) return;
    fetchPayments();
  }, [candidateId, fetchPayments]);

  const handlePaymentFormChange = (e) => {
    const { name, value } = e.target;
    setPaymentForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();

    // ✅ FIXED: Check permission first
    if (!isFinanceEnabled) {
      toast.error('❌ Permission denied: Financial Tracking is disabled for your role.');
      return;
    }

    const total_amount = parseFloat(paymentForm.total_amount);
    const amount_paid = parseFloat(paymentForm.amount_paid) || 0;

    // Validation
    if (!paymentForm.description || paymentForm.description.trim() === '') {
      toast.error('Description is required.');
      return;
    }
    if (isNaN(total_amount) || total_amount <= 0) {
      toast.error('Total Amount Due must be a positive number.');
      return;
    }
    if (isNaN(amount_paid) || amount_paid < 0) {
      toast.error('Amount Paid must be a valid positive number.');
      return;
    }

    setIsSavingPayment(true);
    const toastId = toast.loading('Adding payment record...');

    // Calculate status
    let calculatedStatus;
    if (amount_paid >= total_amount) {
      calculatedStatus = 'Paid';
    } else if (amount_paid > 0) {
      calculatedStatus = 'Partial';
    } else {
      calculatedStatus = 'Pending';
    }

    const data = {
      ...paymentForm,
      candidate_id: candidateId,
      amount_paid,
      total_amount,
      status: calculatedStatus,
    };

    try {
      const res = await window.electronAPI.addPayment({ 
        user: authUser, 
        data 
      });
      
      if (res.success) {
        setPayments((prev) => [res.data, ...prev]);
        setPaymentForm(initialPaymentForm);
        toast.success('✅ Payment record added successfully.', { id: toastId });
      } else {
        console.error('Add payment error:', res.error);
        toast.error(res.error || 'Failed to add payment record.', { id: toastId });
      }
    } catch (err) {
      console.error('addPayment error:', err);
      toast.error('Failed to add payment record.', { id: toastId });
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleUpdatePayment = async (updatedData) => {
    // ✅ FIXED: Check permission first
    if (!isFinanceEnabled) {
      toast.error('❌ Permission denied: Financial Tracking is disabled for your role.');
      return;
    }

    const toastId = toast.loading('Updating payment record...');

    try {
      const res = await window.electronAPI.updatePayment({
        user: authUser,
        id: updatedData.id,
        amount_paid: updatedData.amount_paid,
        status: updatedData.status,
      });

      if (res.success) {
        setPayments((prev) =>
          prev.map((p) => (p.id === updatedData.id ? res.data : p))
        );
        setEditingPayment(null);
        toast.success('✅ Payment record updated successfully.', { id: toastId });
      } else {
        console.error('Update payment error:', res.error);
        toast.error(res.error || 'Failed to update payment.', { id: toastId });
      }
    } catch (err) {
      console.error('updatePayment error:', err);
      toast.error('Failed to update payment.', { id: toastId });
    }
  };

  const handleDeletePayment = async (paymentId, description) => {
    // ✅ FIXED: Check permission first
    if (!isFinanceEnabled) {
      toast.error('❌ Permission denied: Financial Tracking is disabled for your role.');
      return;
    }

    if (
      window.confirm(
        `Are you sure you want to move the payment "${description}" to the Recycle Bin?`
      )
    ) {
      try {
        const res = await window.electronAPI.deletePayment({
          user: authUser,
          id: paymentId,
        });
        
        if (res.success) {
          setPayments((prev) => prev.filter((p) => p.id !== paymentId));
          toast.success('✅ Payment record moved to Recycle Bin.');
        } else {
          console.error('Delete payment error:', res.error);
          toast.error(res.error || 'Failed to delete payment');
        }
      } catch (err) {
        console.error('deletePayment error:', err);
        toast.error('Failed to delete payment');
      }
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Paid':
        return 'badge-green';
      case 'Partial':
        return 'badge-yellow';
      case 'Refunded':
        return 'badge-grey';
      case 'Pending':
      default:
        return 'badge-red';
    }
  };

  if (loading) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '3rem',
        color: 'var(--text-secondary)' 
      }}>
        Loading financial data...
      </div>
    );
  }

  if (!isFinanceEnabled) {
    return (
      <div className="financial-content module-vertical-stack">
        <div
          className="module-form-card"
          style={{
            textAlign: 'center',
            padding: '3rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              color: 'var(--danger-color)',
            }}
          >
            <FiLock />
          </div>
          <div>
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>
              Financial Tracking Disabled
            </h3>
            <p>You do not have permission to view or manage financial records.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Current role: <strong>{authUser?.role}</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const totalDue = payments.reduce(
    (sum, p) => sum + (parseFloat(p.total_amount) || 0),
    0
  );
  const totalPaid = payments.reduce(
    (sum, p) => sum + (parseFloat(p.amount_paid) || 0),
    0
  );
  const totalPending = totalDue - totalPaid;

  return (
    <div className="financial-content module-vertical-stack">
      {editingPayment && (
        <PaymentModal
          user={authUser}
          payment={editingPayment}
          onClose={() => setEditingPayment(null)}
          onSave={handleUpdatePayment}
        />
      )}

      <div className="financial-summary-bar module-form-card">
        <div className="finance-summary-inline">
          <span className="summary-icon">
            <FiDollarSign />
          </span>
          <strong className="summary-title">Financial Summary</strong>
          <span className="summary-divider">|</span>
          <span className="summary-item blue-text">
            Total Invoiced <strong>{formatCurrency(totalDue)}</strong>
          </span>
          <span className="summary-divider">|</span>
          <span className="summary-item green-text">
            Total Collected <strong>{formatCurrency(totalPaid)}</strong>
          </span>
          <span className="summary-divider">|</span>
          <span className="summary-item red-text">
            Pending <strong>{formatCurrency(totalPending)}</strong>
          </span>
        </div>
      </div>

      <div className="payment-form-container module-form-card">
        <h3>
          <FiPlus /> Add New Payment Entry
        </h3>
        <form
          onSubmit={handleAddPayment}
          className="payment-form form-grid"
          style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}
        >
          <div className="form-group full-width" style={{ gridColumn: '1 / -1' }}>
            <label>Description</label>
            <input
              type="text"
              name="description"
              placeholder="e.g., Service Fee, Visa Fee"
              value={paymentForm.description}
              onChange={handlePaymentFormChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Total Amount Due</label>
            <input
              type="number"
              name="total_amount"
              placeholder="10000"
              value={paymentForm.total_amount}
              onChange={handlePaymentFormChange}
              min="0"
              step="0.01"
              required
            />
          </div>
          <div className="form-group">
            <label>Amount Paid Now</label>
            <input
              type="number"
              name="amount_paid"
              placeholder="0"
              value={paymentForm.amount_paid}
              onChange={handlePaymentFormChange}
              min="0"
              step="0.01"
            />
          </div>
          <div className="form-group">
            <label>Due Date</label>
            <input
              type="date"
              name="due_date"
              value={paymentForm.due_date}
              onChange={handlePaymentFormChange}
            />
          </div>

          <button
            type="submit"
            className="btn btn-full-width"
            disabled={isSavingPayment}
            style={{ gridColumn: '1 / -1' }}
          >
            {isSavingPayment ? 'Saving...' : 'Add Payment Record'}
          </button>
        </form>
      </div>

      <div className="payment-list-container module-list-card">
        <h3>
          <FiDollarSign /> Payment History ({payments.length})
        </h3>
        <div className="module-list payment-list">
          {payments.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
              No payment records found.
            </p>
          ) : (
            payments.map((p) => {
              const isOverdue =
                p.due_date &&
                new Date(p.due_date) < new Date() &&
                p.status !== 'Paid';
              return (
                <div
                  className={`payment-item module-list-item ${
                    isOverdue ? 'overdue' : ''
                  }`}
                  key={p.id}
                >
                  <div className="payment-item-details">
                    <h4>{p.description}</h4>
                    <p>Due: {p.due_date || 'N/A'}</p>
                    {isOverdue && (
                      <p
                        style={{
                          color: 'var(--danger-color)',
                          marginTop: '5px',
                          fontWeight: '700',
                        }}
                      >
                        ⚠️ OVERDUE
                      </p>
                    )}
                  </div>
                  <div className="payment-item-status item-status">
                    <span className={`status-badge ${getStatusBadgeClass(p.status)}`}>
                      {p.status}
                    </span>
                    <strong
                      className="mt-1"
                      style={{ color: 'var(--success-color)' }}
                    >
                      Paid: {formatCurrency(p.amount_paid)}
                    </strong>
                    <span
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Due: {formatCurrency(p.total_amount)}
                    </span>
                  </div>
                  <div className="payment-item-actions item-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      title="Update Payment"
                      onClick={() => setEditingPayment(p)}
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Move to Recycle Bin"
                      onClick={() => handleDeletePayment(p.id, p.description)}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default CandidateFinance;
