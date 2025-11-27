import React, { useState } from 'react';
import { FiX, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
// We assume modal styles are in DocumentViewer.css (viewer-modal-backdrop/content)

function EmployerEditModal({ user, employer, onClose, onSave }) {
  const [formData, setFormData] = useState(employer);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const validate = () => {
    if (!formData.companyName || formData.companyName.trim() === '') {
      setError('Company Name is required.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.contactEmail && !emailRegex.test(formData.contactEmail)) {
      setError('Please enter a valid email address.');
      return false;
    }
    return true;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    // Call the new backend update handler
    const res = await window.electronAPI.updateEmployer({ 
        user,
        id: employer.id, 
        data: formData 
    });

    if (res.success) {
      onSave(res.data); // Pass the updated data back to the list page
      onClose();
    } else {
      setError(res.error || 'Failed to save changes.');
    }
    setIsSaving(false);
  };

  return (
    <div className="viewer-modal-backdrop" onClick={onClose}>
      <div className="viewer-modal-content payment-modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '500px', height: 'fit-content'}}>
        <button className="viewer-close-btn" onClick={onClose}><FiX /></button>
        <div className="viewer-header">
          <h3>Edit Employer: {employer.companyName}</h3>
        </div>
        <div className="payment-modal-body" style={{padding: '2rem'}}>
          <form onSubmit={handleSave} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
            
            {error && <div className="form-message error"><FiAlertTriangle /> {error}</div>}

            <div className="form-group">
              <label>Company Name</label>
              <input type="text" name="companyName" value={formData.companyName} onChange={handleFormChange} />
            </div>
            <div className="form-group">
              <label>Country</label>
              <input type="text" name="country" value={formData.country || ''} onChange={handleFormChange} />
            </div>
            <div className="form-group">
              <label>Contact Person</label>
              <input type="text" name="contactPerson" value={formData.contactPerson || ''} onChange={handleFormChange} />
            </div>
            <div className="form-group">
              <label>Contact Email</label>
              <input type="text" name="contactEmail" value={formData.contactEmail || ''} onChange={handleFormChange} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea name="notes" value={formData.notes || ''} onChange={handleFormChange} rows="3"></textarea>
            </div>
            
            <button type="submit" className="btn btn-full-width" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default EmployerEditModal;