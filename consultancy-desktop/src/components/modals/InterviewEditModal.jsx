import React, { useState } from 'react';
import { FiX, FiCalendar, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

const interviewStatusOptions = ['Scheduled', 'Passed', 'Failed', 'Cancelled'];

function InterviewEditModal({ user, interview, jobOrders, onClose, onSave }) {
  const [formData, setFormData] = useState(interview);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const validate = () => {
    if (!formData.job_order_id) {
      setError('Job Order is required.');
      return false;
    }
    if (!formData.interview_date || formData.interview_date.trim() === '') {
      setError('Interview Date is required.');
      return false;
    }
    return true;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    setError('');
    
    // --- INJECTED CODE ---
    // Call the real backend API
    const res = await window.electronAPI.updateInterviewEntry({
      user,
      id: interview.id,
      data: formData
    });

    if (res.success) {
      // Pass the UPDATED data (from the database) back to the parent
      // This response includes the joined companyName and positionTitle
      onSave(res.data);
      toast.success('Interview entry updated successfully!');
      onClose();
    } else {
      // Use the validation error from the backend if available
      setError(res.error || 'Failed to update interview entry.');
    }
    // --- END INJECTED CODE ---
    
    setIsSaving(false);
  };

  return (
    <div className="viewer-modal-backdrop" onClick={onClose}>
      <div className="viewer-modal-content payment-modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '600px', height: 'fit-content'}}>
        <button className="viewer-close-btn" onClick={onClose}><FiX /></button>
        <div className="viewer-header">
          <h3><FiCalendar /> Edit Interview: {interview.positionTitle}</h3>
        </div>
        <div className="payment-modal-body" style={{padding: '2rem'}}>
          <form onSubmit={handleSave} className="form-grid" style={{gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
            
            {error && <div className="form-message error full-width"><FiAlertTriangle /> {error}</div>}

            <div className="form-group full-width">
                <label>Job Order</label>
                <select name="job_order_id" value={formData.job_order_id} onChange={handleFormChange}>
                    <option value="">-- Select a Job Order --</option>
                    {jobOrders.map((job) => (
                        <option key={job.id} value={job.id}>
                            {job.companyName} - {job.positionTitle}
                        </option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label>Interview Date</label>
                <input type="date" name="interview_date" value={formData.interview_date} onChange={handleFormChange} />
            </div>
            <div className="form-group">
                <label>Round</label>
                <input type="text" name="round" value={formData.round || ''} onChange={handleFormChange} />
            </div>
            <div className="form-group full-width">
                <label>Status</label>
                <select name="status" value={formData.status} onChange={handleFormChange}>
                    {interviewStatusOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            </div>
            <div className="form-group full-width">
              <label>Notes/Feedback</label>
              <textarea name="notes" value={formData.notes || ''} onChange={handleFormChange} rows="3"></textarea>
            </div>
            
            <button type="submit" className="btn full-width" disabled={isSaving} style={{gridColumn: '1 / -1'}}>
              {isSaving ? 'Saving...' : 'Save Interview Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default InterviewEditModal;