import React, { useState } from 'react';
import { FiX, FiSend, FiAlertTriangle, FiDownload } from 'react-icons/fi';
import toast from 'react-hot-toast';

function TravelEditModal({ user, travel, onClose, onSave }) {
  const [formData, setFormData] = useState(travel);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  
  // NOTE: This modal currently does not handle file replacement/upload logic.
  // It only handles text fields and status for simplicity.
  
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const validate = () => {
    if (!formData.travel_date || formData.travel_date.trim() === '') {
      setError('Travel Date is required.');
      return false;
    }
    if (!formData.departure_city || formData.departure_city.trim() === '') {
      setError('Departure City is required.');
      return false;
    }
    if (!formData.arrival_city || formData.arrival_city.trim() === '') {
      setError('Arrival City is required.');
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
    const res = await window.electronAPI.updateTravelEntry({
      user,
      id: travel.id,
      data: formData
    });

    if (res.success) {
      // Pass the UPDATED data (from the database) back to the parent
      onSave(res.data);
      toast.success('Travel entry updated successfully!');
      onClose();
    } else {
      // Use the validation error from the backend if available
      setError(res.error || 'Failed to update travel entry.');
    }
    // --- END INJECTED CODE ---
    
    setIsSaving(false);
  };
  
  const openFile = (filePath) => {
      window.electronAPI.openFileExternally({ path: filePath });
  };

  return (
    <div className="viewer-modal-backdrop" onClick={onClose}>
      <div className="viewer-modal-content payment-modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '600px', height: 'fit-content'}}>
        <button className="viewer-close-btn" onClick={onClose}><FiX /></button>
        <div className="viewer-header">
          <h3><FiSend /> Edit Travel Entry: {travel.departure_city} to {travel.arrival_city}</h3>
        </div>
        <div className="payment-modal-body" style={{padding: '2rem'}}>
          <form onSubmit={handleSave} className="form-grid" style={{gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
            
            {error && <div className="form-message error full-width"><FiAlertTriangle /> {error}</div>}

            <div className="form-group">
                <label>Travel Date</label>
                <input type="date" name="travel_date" value={formData.travel_date} onChange={handleFormChange} />
            </div>
            <div className="form-group">
                <label>PNR / Ticket No. (Optional)</label>
                <input type="text" name="pnr" value={formData.pnr || ''} onChange={handleFormChange} />
            </div>
            <div className="form-group">
                <label>Departure City</label>
                <input type="text" name="departure_city" value={formData.departure_city} onChange={handleFormChange} />
            </div>
            <div className="form-group">
                <label>Arrival City</label>
                <input type="text" name="arrival_city" value={formData.arrival_city} onChange={handleFormChange} />
            </div>
            <div className="form-group full-width">
              <label>Notes</label>
              <textarea name="notes" value={formData.notes || ''} onChange={handleFormChange} rows="3"></textarea>
            </div>
            {formData.ticket_file_path && (
                <div className="form-group full-width">
                    <label>Current Ticket Document</label>
                    <a className="doc-item" onClick={() => openFile(formData.ticket_file_path)} style={{cursor: 'pointer', background: 'var(--bg-input)'}}>
                        <FiDownload /> {formData.ticket_file_path.split('/').pop()} (Click to View)
                    </a>
                </div>
            )}
            
            <button type="submit" className="btn full-width" disabled={isSaving} style={{gridColumn: '1 / -1'}}>
              {isSaving ? 'Saving...' : 'Save Travel Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default TravelEditModal;