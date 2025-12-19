import React, { useState, useEffect, useCallback } from 'react';
import { FiDollarSign, FiEdit2, FiTrash2, FiPlus, FiLock, FiSave, FiX } from 'react-icons/fi';
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

const paymentStatusOptions = ['Pending', 'Partial', 'Paid', 'Refunded'];

function CandidateFinance({ candidateId, flags, candidateName }) {
  const authUser = useAuthStore((state) => state.user);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  
  // Inline editing state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    amountToAdd: '',
    manualStatus: '',
  });

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
        toast.error('❌ ' + (res.error || 'Failed to load payments'));
      }
    } catch (err) {
      console.error('getCandidatePayments error:', err);
      toast.error('❌ Failed to load payments');
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
    if (!isFinanceEnabled) {
      toast.error('❌ Permission denied: Financial Tracking is disabled for your role.');
      return;
    }

    const total_amount = parseFloat(paymentForm.total_amount);
    const amount_paid = parseFloat(paymentForm.amount_paid) || 0;

    if (!paymentForm.description || paymentForm.description.trim() === '') {
      toast.error('⚠️ Description is required.');
      return;
    }

    if (isNaN(total_amount) || total_amount <= 0) {
      toast.error('⚠️ Total Amount Due must be a positive number.');
      return;
    }

    if (isNaN(amount_paid) || amount_paid < 0) {
      toast.error('⚠️ Amount Paid must be a valid positive number.');
      return;
    }

    setIsSavingPayment(true);
    const toastId = toast.loading('⏳ Adding payment record...');

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
        data,
      });

      if (res.success) {
        setPayments((prev) => [res.data, ...prev]);
        setPaymentForm(initialPaymentForm);
        toast.success('✅ Payment record added successfully.', { id: toastId });

        if (paymentForm.due_date && calculatedStatus !== 'Paid') {
          try {
            await window.electronAPI.createReminder({
              userId: authUser.id,
              candidateId,
              module: 'finance',
              title: '💰 Payment due',
              message: `${paymentForm.description} for ${
                candidateName || 'candidate'
              } is due on ${paymentForm.due_date}`,
              remindAt: new Date(paymentForm.due_date).toISOString(),
            });
          } catch (err) {
            console.error('createReminder (finance) failed:', err);
          }
        }
      } else {
        console.error('Add payment error:', res.error);
        toast.error('❌ ' + (res.error || 'Failed to add payment record.'), { id: toastId });
      }
    } catch (err) {
      console.error('addPayment error:', err);
      toast.error('❌ Failed to add payment record.', { id: toastId });
    } finally {
      setIsSavingPayment(false);
    }
  };

  // START INLINE EDIT
  const handleEditClick = (payment) => {
    if (!isFinanceEnabled) {
      toast.error('❌ Permission denied: Financial Tracking is disabled for your role.');
      return;
    }
    setEditingId(payment.id);
    setEditForm({
      amountToAdd: '',
      manualStatus: payment.status,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ amountToAdd: '', manualStatus: '' });
  };

  const handleSaveEdit = async (payment) => {
    if (!isFinanceEnabled) {
      toast.error('❌ Permission denied: Financial Tracking is disabled for your role.');
      return;
    }

    const addedAmount = parseFloat(editForm.amountToAdd) || 0;

    if (addedAmount < 0) {
      toast.error('❌ New payment amount cannot be negative.');
      return;
    }

    const currentAmountPaid = parseFloat(payment.amount_paid) || 0;
    const totalAmountDue = parseFloat(payment.total_amount) || 0;

    let updatedAmount = currentAmountPaid + addedAmount;
    let calculatedStatus = editForm.manualStatus;

    // Overpayment prevention
    if (calculatedStatus !== 'Refunded' && updatedAmount > totalAmountDue) {
      updatedAmount = totalAmountDue;
      toast('⚠️ Payment capped at total amount due.', { icon: '⚖️' });
    }

    // Auto-calculate status if not Refunded
    if (calculatedStatus !== 'Refunded') {
      if (updatedAmount >= totalAmountDue) {
        calculatedStatus = 'Paid';
      } else if (updatedAmount > 0) {
        calculatedStatus = 'Partial';
      } else {
        calculatedStatus = 'Pending';
      }
    }

    const toastId = toast.loading('⏳ Updating payment record...');

    try {
      const res = await window.electronAPI.updatePayment({
        user: authUser,
        id: payment.id,
        amount_paid: updatedAmount,
        status: calculatedStatus,
      });

      if (res.success) {
        setPayments((prev) =>
          prev.map((p) => (p.id === payment.id ? res.data : p))
        );
        setEditingId(null);
        setEditForm({ amountToAdd: '', manualStatus: '' });
        toast.success('✅ Payment record updated successfully.', { id: toastId });
      } else {
        console.error('Update payment error:', res.error);
        toast.error('❌ ' + (res.error || 'Failed to update payment.'), { id: toastId });
      }
    } catch (err) {
      console.error('updatePayment error:', err);
      toast.error('❌ Failed to update payment.', { id: toastId });
    }
  };
  // END INLINE EDIT

  const handleDeletePayment = async (paymentId, description) => {
    if (!isFinanceEnabled) {
      toast.error('❌ Permission denied: Financial Tracking is disabled for your role.');
      return;
    }

    if (
      window.confirm(
        `⚠️ Are you sure you want to move the payment "${description}" to the Recycle Bin?`
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
          toast.error('❌ ' + (res.error || 'Failed to delete payment'));
        }
      } catch (err) {
        console.error('deletePayment error:', err);
        toast.error('❌ Failed to delete payment');
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
      <div className="financial-content">
        <p>⏳ Loading payment records...</p>
      </div>
    );
  }

  if (!isFinanceEnabled) {
    return (
      <div className="financial-content" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <FiLock size={64} style={{ color: 'var(--danger-color)', marginBottom: '1rem' }} />
        <h3>❌ You do not have permission to view or manage financial records.</h3>
        <p>
          Current role: <strong>{authUser?.role}</strong>
        </p>
      </div>
    );
  }

  const totalDue = payments.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  const totalBalance = totalDue - totalPaid;

  return (
    <div className="financial-content">
      {/* Financial Summary Bar */}
      <div className="financial-summary-bar">
        <div className="finance-summary-inline">
          <div className="summary-icon">
            <FiDollarSign />
          </div>
          <span className="summary-title">Financial Summary</span>
          <span className="summary-divider">|</span>
          <div className="summary-item blue-text">
            💰 <strong>{formatCurrency(totalDue)}</strong> Total Due
          </div>
          <div className="summary-item green-text">
            ✅ <strong>{formatCurrency(totalPaid)}</strong> Paid
          </div>
          <div className="summary-item red-text">
            ⚖️ <strong>{formatCurrency(totalBalance)}</strong> Balance
          </div>
        </div>
      </div>

      {/* Add Payment Form */}
      <div className="payment-form-container">
        <h3>
          <FiPlus /> Add New Payment Record
        </h3>
        <form onSubmit={handleAddPayment} className="finance-form form-grid">
          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <input
              type="text"
              id="description"
              name="description"
              value={paymentForm.description}
              onChange={handlePaymentFormChange}
              placeholder="e.g., Visa Fee, Medical Fee"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="total_amount">Total Amount Due *</label>
            <input
              type="number"
              id="total_amount"
              name="total_amount"
              value={paymentForm.total_amount}
              onChange={handlePaymentFormChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="amount_paid">Amount Paid</label>
            <input
              type="number"
              id="amount_paid"
              name="amount_paid"
              value={paymentForm.amount_paid}
              onChange={handlePaymentFormChange}
              placeholder="0.00"
              step="0.01"
              min="0"
            />
          </div>
          <div className="form-group">
            <label htmlFor="due_date">Due Date</label>
            <input
              type="date"
              id="due_date"
              name="due_date"
              value={paymentForm.due_date}
              onChange={handlePaymentFormChange}
            />
          </div>
          <button
            type="submit"
            className="btn-full-width"
            disabled={isSavingPayment}
            style={{ gridColumn: '1 / -1' }}
          >
            {isSavingPayment ? '⏳ Saving...' : <><FiPlus /> Add Payment Record</>}
          </button>
        </form>
      </div>

      {/* Payment History */}
      <div className="payment-list-container">
        <h3>
          <FiDollarSign /> Payment History
        </h3>
        <div className="payment-list">
          {payments.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              ℹ️ No payment records found.
            </p>
          ) : (
            payments.map((p) => {
              const isOverdue =
                p.due_date && new Date(p.due_date) < new Date() && p.status !== 'Paid';
              const balance = p.total_amount - p.amount_paid;
              const isEditing = editingId === p.id;

              // Calculate projected paid for inline edit
              const projectedPaid = 
                parseFloat(p.amount_paid) + parseFloat(editForm.amountToAdd || 0);
              const isOverpaying = 
                editForm.amountToAdd && 
                projectedPaid > p.total_amount && 
                editForm.manualStatus !== 'Refunded';

              return (
                <div
                  key={p.id}
                  className={`payment-item ${isOverdue ? 'overdue' : ''} ${isEditing ? 'editing-mode' : ''}`}
                >
                  {isEditing ? (
                    // INLINE EDIT MODE
                    <div className="inline-edit-container">
                      <div className="edit-summary-box">
                        <p>
                          💰 Total Invoiced:{' '}
                          <strong>{formatCurrency(p.total_amount)}</strong>
                        </p>
                        <p>
                          ✅ Currently Paid:{' '}
                          <strong>{formatCurrency(p.amount_paid)}</strong>
                        </p>
                        <p>
                          ⚖️ Amount Due:{' '}
                          <strong style={{ color: balance > 0 ? 'var(--danger-color)' : 'var(--success-color)' }}>
                            {formatCurrency(balance > 0 ? balance : 0)}
                          </strong>
                        </p>
                      </div>

                      <div className="edit-form-grid">
                        <div className="edit-field">
                          <label>💵 Amount to Add Now</label>
                          <input
                            type="number"
                            className="edit-input"
                            value={editForm.amountToAdd}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                amountToAdd: e.target.value,
                              }))
                            }
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                          />
                          {editForm.amountToAdd && (
                            <small style={{ 
                              color: isOverpaying ? 'var(--danger-color)' : 'var(--success-color)',
                              fontWeight: 600 
                            }}>
                              📊 Projected Paid: {formatCurrency(projectedPaid)}
                              {isOverpaying && ' ⚠️ (Will be capped)'}
                            </small>
                          )}
                        </div>

                        <div className="edit-field">
                          <label>🏷️ Manual Status Override</label>
                          <select
                            className="edit-input"
                            value={editForm.manualStatus}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                manualStatus: e.target.value,
                              }))
                            }
                          >
                            {paymentStatusOptions.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="edit-actions">
                        <button
                          className="btn-save"
                          onClick={() => handleSaveEdit(p)}
                        >
                          <FiSave /> Save Payment Update
                        </button>
                        <button
                          className="btn-cancel"
                          onClick={handleCancelEdit}
                        >
                          <FiX /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // NORMAL VIEW MODE
                    <>
                      <div className="payment-item-details">
                        <h4>{p.description}</h4>
                        <p>
                          💰 Total: <strong>{formatCurrency(p.total_amount)}</strong> | Paid:{' '}
                          <strong>{formatCurrency(p.amount_paid)}</strong> | Balance:{' '}
                          <strong className={balance > 0 ? 'text-danger' : 'text-success'}>
                            {formatCurrency(balance)}
                          </strong>
                        </p>
                        <p>
                          📅 Due: {p.due_date || 'N/A'}
                          {isOverdue && (
                            <span style={{ color: 'var(--danger-color)', marginLeft: '8px' }}>
                              ⚠️ OVERDUE
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="payment-item-status">
                        <span className={`status-badge ${getStatusBadgeClass(p.status)}`}>
                          {p.status}
                        </span>
                      </div>
                      <div className="payment-item-actions">
                        <button onClick={() => handleEditClick(p)} title="Update Payment">
                          <FiEdit2 />
                        </button>
                        <button
                          onClick={() => handleDeletePayment(p.id, p.description)}
                          title="Delete Payment"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </>
                  )}
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
