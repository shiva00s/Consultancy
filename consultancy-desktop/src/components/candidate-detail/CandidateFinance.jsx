import React, { useState, useEffect, useCallback } from 'react';
import { FiDollarSign, FiEdit2, FiTrash2, FiPlus, FiLock, FiSave, FiX } from 'react-icons/fi';
import { formatCurrency } from '../../utils/format';
import toast from 'react-hot-toast';
import '../../css/CandidateFinance.css';
import useAuthStore from '../../store/useAuthStore';
import ConfirmDialog from '../common/ConfirmDialog';

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

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
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
      toast.error('🔒 Permission denied: Financial Tracking is disabled for your role.');
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
      const res = await window.electronAPI.addPayment({ user: authUser, data });
      if (res.success) {
        setPayments((prev) => [res.data, ...prev]);
        setPaymentForm(initialPaymentForm);
        toast.success('✅ Payment record added successfully!', { id: toastId });

        if (paymentForm.due_date && calculatedStatus !== 'Paid') {
          try {
            await window.electronAPI.createReminder({
              userId: authUser.id,
              candidateId,
              module: 'finance',
              title: '💰 Payment due',
              message: `${paymentForm.description} for ${candidateName || 'candidate'} is due on ${paymentForm.due_date}`,
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
      toast.error('🔒 Permission denied: Financial Tracking is disabled for your role.');
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
      toast.error('🔒 Permission denied: Financial Tracking is disabled for your role.');
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
        toast.success('✅ Payment record updated successfully!', { id: toastId });
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

  const handleDeletePayment = (paymentId, description) => {
    if (!isFinanceEnabled) {
      toast.error('🔒 Permission denied: Financial Tracking is disabled for your role.');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: '⚠️ Move to Recycle Bin?',
      message: `Are you sure you want to move the payment "${description}" to the Recycle Bin?`,
      onConfirm: async () => {
        const toastId = toast.loading('⏳ Deleting payment record...');
        try {
          const res = await window.electronAPI.deletePayment({
            user: authUser,
            id: paymentId,
          });
          
          if (res.success) {
            setPayments((prev) => prev.filter((p) => p.id !== paymentId));
            toast.success('✅ Payment record moved to Recycle Bin.', { id: toastId });
          } else {
            console.error('Delete payment error:', res.error);
            toast.error('❌ ' + (res.error || 'Failed to delete payment'), { id: toastId });
          }
        } catch (err) {
          console.error('deletePayment error:', err);
          toast.error('❌ Failed to delete payment', { id: toastId });
        }
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
      },
    });
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
        <div className="loading-message">
          <FiDollarSign size={48} />
          <p>⏳ Loading payment records...</p>
        </div>
      </div>
    );
  }

  if (!isFinanceEnabled) {
    return (
      <div className="financial-content">
        <div className="permission-denied-box">
          <FiLock size={48} />
          <h3>🔒 Access Restricted</h3>
          <p>You don't have permission to view financial records.</p>
          <p>
            Current role: <strong>{authUser?.role}</strong>
          </p>
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalInvoiced = payments.reduce((sum, p) => sum + p.total_amount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount_paid, 0);
  const totalDue = totalInvoiced - totalPaid;

  return (
    <div className="financial-content">
      {/* FINANCIAL SUMMARY BAR */}
      <div className="financial-summary-bar">
        <div className="finance-summary-inline">
          <div className="summary-icon">
            <FiDollarSign />
          </div>
          <span className="summary-title">💰 Financial Overview</span>
          <span className="summary-divider">|</span>
          <div className="summary-item">
            <small>📊 Total Invoiced:</small>
            <strong className="blue-text">{formatCurrency(totalInvoiced)}</strong>
          </div>
          <span className="summary-divider">|</span>
          <div className="summary-item">
            <small>✅ Total Paid:</small>
            <strong className="green-text">{formatCurrency(totalPaid)}</strong>
          </div>
          <span className="summary-divider">|</span>
          <div className="summary-item">
            <small>⚖️ Total Due:</small>
            <strong className={totalDue > 0 ? 'red-text' : 'green-text'}>
              {formatCurrency(totalDue > 0 ? totalDue : 0)}
            </strong>
          </div>
        </div>
      </div>

      {/* ADD PAYMENT FORM */}
      <div className="payment-form-container">
        <h3>
          <FiPlus /> ➕ Add New Payment Record
        </h3>
        <form className="finance-form form-grid" onSubmit={handleAddPayment}>
          <div className="form-group">
            <label>📝 Description *</label>
            <input
              type="text"
              name="description"
              placeholder="e.g., Visa Processing Fee 💼"
              value={paymentForm.description}
              onChange={handlePaymentFormChange}
              required
            />
          </div>
          <div className="form-group">
            <label>💵 Total Amount Due *</label>
            <input
              type="number"
              name="total_amount"
              placeholder="0.00"
              step="0.01"
              value={paymentForm.total_amount}
              onChange={handlePaymentFormChange}
              required
            />
          </div>
          <div className="form-group">
            <label>✅ Amount Paid (Initial)</label>
            <input
              type="number"
              name="amount_paid"
              placeholder="0.00"
              step="0.01"
              value={paymentForm.amount_paid}
              onChange={handlePaymentFormChange}
            />
          </div>
          <div className="form-group">
            <label>📅 Due Date</label>
            <input
              type="date"
              name="due_date"
              value={paymentForm.due_date}
              onChange={handlePaymentFormChange}
            />
          </div>
          <button
            type="submit"
            className="btn-full-width btn-span-2"
            disabled={isSavingPayment}
          >
            <FiPlus />
            {isSavingPayment ? '⏳ Adding...' : '➕ Add Payment Record'}
          </button>
        </form>
      </div>

      {/* PAYMENT HISTORY LIST */}
      <div className="payment-list-container">
        <h3>
          <FiDollarSign /> 📜 Payment History
        </h3>
        {!payments || payments.length === 0 ? (
          <div className="empty-message">
            <p>ℹ️ No payment records found.</p>
          </div>
        ) : (
          <div className="payment-list">
            {payments.map((p) => {
              const isOverdue =
                p.due_date &&
                new Date(p.due_date) < new Date() &&
                p.status !== 'Paid';
              const balance = p.total_amount - p.amount_paid;
              const isEditing = editingId === p.id;

              // Calculate projected paid for inline edit
              const projectedPaid =
                parseFloat(p.amount_paid) +
                parseFloat(editForm.amountToAdd || 0);
              const isOverpaying =
                editForm.amountToAdd &&
                projectedPaid > p.total_amount &&
                editForm.manualStatus !== 'Refunded';

              return (
                <div
                  key={p.id}
                  className={`payment-item ${isOverdue ? 'overdue' : ''} ${
                    isEditing ? 'editing-mode' : ''
                  }`}
                >
                  {!isEditing ? (
                    <>
                      <div className="payment-item-details">
                        <h4>📋 {p.description}</h4>
                        <p>
                          💰 <strong>Total:</strong> {formatCurrency(p.total_amount)} |{' '}
                          <strong>Paid:</strong> {formatCurrency(p.amount_paid)} |{' '}
                          <strong>Balance:</strong>{' '}
                          <span
                            className={balance > 0 ? 'text-danger' : 'text-success'}
                          >
                            {formatCurrency(balance)}
                          </span>
                        </p>
                        <p>
                          📅 <strong>Due:</strong> {p.due_date || 'N/A'}
                          {isOverdue && (
                            <span className="overdue-badge"> ⚠️ OVERDUE</span>
                          )}
                        </p>
                      </div>
                      <div className="payment-item-status">
                        <span className={`status-badge ${getStatusBadgeClass(p.status)}`}>
                          {p.status === 'Paid' && '✅'}
                          {p.status === 'Partial' && '⏳'}
                          {p.status === 'Pending' && '⏰'}
                          {p.status === 'Refunded' && '↩️'} {p.status}
                        </span>
                      </div>
                      <div className="payment-item-actions">
                        <button
                          type="button"
                          onClick={() => handleEditClick(p)}
                          title="Edit Payment"
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePayment(p.id, p.description)}
                          title="Delete Payment"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="inline-edit-container">
                      <div className="edit-summary-box">
                        <p>
                          📋 <strong>{p.description}</strong>
                        </p>
                        <p>
                          💰 <strong>Total Invoiced:</strong>{' '}
                          <strong>{formatCurrency(p.total_amount)}</strong>
                        </p>
                        <p>
                          ✅ <strong>Currently Paid:</strong>{' '}
                          <strong>{formatCurrency(p.amount_paid)}</strong>
                        </p>
                        <p>
                          ⚖️ <strong>Amount Due:</strong>{' '}
                          <strong
                            style={{
                              color:
                                balance > 0
                                  ? 'var(--danger-color)'
                                  : 'var(--success-color)',
                            }}
                          >
                            {formatCurrency(balance > 0 ? balance : 0)}
                          </strong>
                        </p>
                      </div>
                      <div className="edit-form-grid">
                        <div className="edit-field">
                          <label>💳 Add Payment Amount</label>
                          <input
                            type="number"
                            className="edit-input"
                            placeholder="Enter amount to add (e.g., 500.00)"
                            step="0.01"
                            value={editForm.amountToAdd}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                amountToAdd: e.target.value,
                              }))
                            }
                          />
                          {isOverpaying && (
                            <small style={{ color: 'var(--danger-color)' }}>
                              ⚠️ Exceeds total due!
                            </small>
                          )}
                          {editForm.amountToAdd && !isOverpaying && (
                            <small style={{ color: 'var(--success-color)' }}>
                              ✅ New total: {formatCurrency(projectedPaid)}
                            </small>
                          )}
                        </div>
                        <div className="edit-field">
                          <label>📊 Payment Status</label>
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
                                {status === 'Paid' && '✅ '}
                                {status === 'Partial' && '⏳ '}
                                {status === 'Pending' && '⏰ '}
                                {status === 'Refunded' && '↩️ '}
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
                          <FiSave /> 💾 Save Changes
                        </button>
                        <button className="btn-cancel" onClick={handleCancelEdit}>
                          <FiX /> ❌ Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() =>
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })
        }
      />
    </div>
  );
}

export default CandidateFinance;
