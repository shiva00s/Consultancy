import React, { useState } from 'react';
import { FiX, FiUsers, FiAlertTriangle,FiDownload } from 'react-icons/fi';
import toast from 'react-hot-toast';

const medicalStatusOptions = ['Pending', 'Fit', 'Unfit', 'Cancelled'];

// --- NEW HANDLER INJECTION (Temporary Placeholder) ---
const handleNewFileChange = (e) => {
    // Placeholder to make JSX valid. File logic will be implemented later.
    console.warn("New file selected, actual upload logic is pending implementation.");
};
// ----------------------------------------------------

function MedicalEditModal({user, medical, onClose, onSave }) {
  const [formData, setFormData] = useState(medical);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  
  // NOTE: This modal currently does not handle file replacement/upload logic.
  // It only handles text fields and status, as full file handling requires 
  // complex state management within the modal itself, which we skip for simplicity.
  
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const validate = () => {
    if (!formData.test_date || formData.test_date.trim() === '') {
      setError('Test Date is required.');
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
    const res = await window.electronAPI.updateMedicalEntry({
      user,
      id: medical.id,
      data: formData
    });

    if (res.success) {
      // Pass the UPDATED data (from the database) back to the parent
      onSave(res.data);
      toast.success('Medical entry updated successfully!');
      onClose();
    } else {
      // Use the validation error from the backend if available
      setError(res.error || 'Failed to update medical entry.');
    }
    // --- END INJECTED CODE ---
    
    setIsSaving(false);
  };

  return (
    <div className="viewer-modal-backdrop" onClick={onClose}>
      <div className="viewer-modal-content payment-modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '600px', height: 'fit-content'}}>
        <button className="viewer-close-btn" onClick={onClose}><FiX /></button>
        <div className="viewer-header">
          <h3><FiUsers /> Edit Medical Entry: {medical.test_date}</h3>
        </div>
        <div className="payment-modal-body" style={{padding: '2rem'}}>
          <form onSubmit={handleSave} className="form-grid" style={{gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
            
            {error && <div className="form-message error full-width"><FiAlertTriangle /> {error}</div>}

            <div className="form-group">
                <label>Test Date</label>
                <input type="date" name="test_date" value={formData.test_date} onChange={handleFormChange} />
            </div>
            <div className="form-group">
                <label>Status</label>
                <select name="status" value={formData.status} onChange={handleFormChange}>
                    {medicalStatusOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            </div>
            <div className="form-group full-width">
              <label>Notes</label>
              <textarea name="notes" value={formData.notes || ''} onChange={handleFormChange} rows="3"></textarea>
            </div>
            {formData.certificate_path && (
                <div className="form-group full-width">
                    <label>Current Certificate File</label>
                    <a className="doc-item" onClick={() => window.electronAPI.openFileExternally({ path: formData.certificate_path })} style={{cursor: 'pointer', background: 'var(--bg-input)'}}>
                        <FiDownload /> {formData.certificate_path.split(/[/\\]/).pop()} (Click to View)
                    </a>
                </div>
            )}
            
            <div className="form-group full-width">
                <label htmlFor="new-cert-file">Upload New Certificate (Replaces Existing)</label>
                <input 
                    type="file" 
                    id="new-cert-file" 
                    name="new_certificate_file" 
                    onChange={handleNewFileChange} 
                />
            </div>
            
            <button type="submit" className="btn full-width" disabled={isSaving} style={{gridColumn: '1 / -1'}}>
              {isSaving ? 'Saving...' : 'Save Medical Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default MedicalEditModal;