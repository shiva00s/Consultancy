import React, { useState } from 'react';
import { FiX, FiPackage, FiAlertTriangle } from 'react-icons/fi';
import toast from 'react-hot-toast';

const visaStatusOptions = [
  'Pending', 'Submitted', 'Biometrics Done', 'In Progress', 
  'Approved', 'Rejected', 'Cancelled',
];

function VisaEditModal({ user, visa, onClose, onSave }) {
  const [formData, setFormData] = useState(visa);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const validate = () => {
    if (!formData.country || formData.country.trim() === '') {
      setError('Country is required.');
      return false;
    }
    if (!formData.application_date || formData.application_date.trim() === '') {
      setError('Application Date is required.');
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
    const res = await window.electronAPI.updateVisaEntry({
      user,
      id: visa.id,
      data: formData
    });

    if (res.success) {
      // Pass the UPDATED data (from the database) back to the parent
      onSave(res.data);
      toast.success('Visa entry updated successfully!');
      onClose();
    } else {
      // Use the validation error from the backend if available
      setError(res.error || 'Failed to update visa entry.');
    }
    // --- END INJECTED CODE ---
    
    setIsSaving(false);
  };

  return (
    <div className="viewer-modal-backdrop" onClick={onClose}>
    {/* MODIFIED: Increased maxWidth to better utilize screen space */}
    <div className="viewer-modal-content payment-modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '750px', height: 'fit-content'}}>
      <button className="viewer-close-btn" onClick={onClose}><FiX /></button>
      <div className="viewer-header">
        <h3><FiPackage /> Edit Visa Entry: {visa.country}</h3>
      </div>
      <div className="payment-modal-body" style={{padding: '2rem'}}>
        <form onSubmit={handleSave} className="form-grid" style={{gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px'}}>
            
          {error && <div className="form-message error full-width"><FiAlertTriangle /> {error}</div>}

          {/* ROW 1 */}
          <div className="form-group">
              <label>Position</label>
              <input type="text" name="position" value={formData.position || ''} onChange={handleFormChange} />
          </div>
          <div className="form-group">
              <label>Country</label>
              <input type="text" name="country" value={formData.country} onChange={handleFormChange} />
          </div>
          <div className="form-group">
              <label>Passport Number</label>
              <input type="text" name="passport_number" value={formData.passport_number || ''} onChange={handleFormChange} />
          </div>
          
          {/* ROW 2 */}
          <div className="form-group">
              <label>Travel Date</label>
              <input type="date" name="travel_date" value={formData.travel_date || ''} onChange={handleFormChange} />
          </div>
          <div className="form-group">
              <label>Visa Type</label>
              <input type="text" name="visa_type" value={formData.visa_type || ''} onChange={handleFormChange} />
          </div>
          <div className="form-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleFormChange}>
                  {visaStatusOptions.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
              </select>
          </div>

          {/* ROW 3 (Contact Info - Full Width) */}
          <div className="form-group full-width" style={{gridTemplateColumns: '1fr 2fr', gap: '20px'}}>
              <label>Contact Type</label>
              <select name="contact_type" value={formData.contact_type || 'Direct Candidate'} onChange={handleFormChange}>
                  <option value="Direct Candidate">Direct Candidate</option>
                  <option value="Agent Candidate">Agent Candidate</option>
              </select>
          </div>
          
          {formData.contact_type === 'Agent Candidate' && (
              <div className="form-group full-width">
                  <label>Agent Contact Details</label>
                  <input type="text" name="agent_contact" value={formData.agent_contact || ''} onChange={handleFormChange} placeholder="e.g., Agent Name or Phone/Email" />
              </div>
          )}
          
          {/* ROW 4 (Notes) */}
          <div className="form-group full-width">
            <label>Notes</label>
            <textarea name="notes" value={formData.notes || ''} onChange={handleFormChange} rows="3"></textarea>
          </div>
          
          <button type="submit" className="btn full-width" disabled={isSaving} style={{gridColumn: '1 / -1'}}>
            {isSaving ? 'Saving...' : 'Save Visa Changes'}
          </button>
        </form>
      </div>
    </div>
  </div>
);
}

export default VisaEditModal;