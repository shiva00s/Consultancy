import React, { useState } from 'react';
import { FiX, FiAlertTriangle } from 'react-icons/fi';

function JobEditModal({user, job, employers, onClose, onSave }) {
  const [formData, setFormData] = useState(job);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
const defaultJob = {
  id: null,
  employer_id: "",
  positionTitle: "",
  jobDescription: "",
  salary: "",
  location: "",
  created_at: "",
};


  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const validate = () => {
    if (!formData.employer_id) {
      setError('Employer is required.');
      return false;
    }
    if (!formData.positionTitle || formData.positionTitle.trim() === '') {
      setError('Position Title is required.');
      return false;
    }
    const openings = parseInt(formData.openingsCount, 10);
    if (isNaN(openings) || openings < 1) {
      setError('Openings must be a positive number.');
      return false;
    }
    return true;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    // Call the new backend update handler
    const res = await window.electronAPI.updateJobOrder({ 
      user,
        id: job.id, 
        data: formData 
    });

    if (res.success) {
      onSave(res.data); // Pass the updated job (with company name) back
      onClose();
    } else {
      setError(res.error || 'Failed to save changes.');
    }
    setIsSaving(false);
  };

  return (
    <div className="viewer-modal-backdrop" onClick={onClose}>
      <div className="viewer-modal-content payment-modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '600px', height: 'fit-content'}}>
        <button className="viewer-close-btn" onClick={onClose}><FiX /></button>
        <div className="viewer-header">
          <h3>Edit Job Order: {job.positionTitle}</h3>
        </div>
        <div className="payment-modal-body" style={{padding: '2rem'}}>
          <form onSubmit={handleSave} className="form-grid" style={{gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
            
            {error && <div className="form-message error full-width"><FiAlertTriangle /> {error}</div>}

            <div className="form-group full-width">
              <label>Employer / Company</label>
              <select name="employer_id" value={formData.employer_id} onChange={handleFormChange}>
                {employers.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.companyName} ({emp.country})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Position Title</label>
              <input type="text" name="positionTitle" value={formData.positionTitle} onChange={handleFormChange} />
            </div>
            
            <div className="form-group">
              <label>Country (if specified)</label>
              <input type="text" name="country" value={formData.country || ''} onChange={handleFormChange} />
            </div>
            
            <div className="form-group">
              <label>Number of Openings</label>
              <input type="number" name="openingsCount" min="1" value={formData.openingsCount} onChange={handleFormChange} />
            </div>
            
            <div className="form-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleFormChange}>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
            
            <div className="form-group full-width">
              <label>Requirements / Notes</label>
              <textarea name="requirements" value={formData.requirements || ''} onChange={handleFormChange} rows="3"></textarea>
            </div>

            <button type="submit" className="btn full-width" disabled={isSaving} style={{gridColumn: '1 / -1'}}>
              {isSaving ? 'Saving...' : 'Save Job Order Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default JobEditModal;