import React, { useState } from 'react';
import { FiX, FiEdit2, FiAlertTriangle, FiUserCheck, FiTruck } from 'react-icons/fi';
import toast from 'react-hot-toast';

// Define options based on CandidatePassport.jsx
const statusOptions = ['Received', 'Dispatched'];
const sourceOptions = ['Direct Candidate', 'Agent Candidate'];

/**
 * Modal to edit an existing passport movement entry.
 * Assumes entry prop contains all fields (e.g., received_date, dispatch_date, passport_status).
 */
function PassportEditModal({ user, entry, onClose, onSave }) {
    // Initialize form state with the data from the entry prop
    const [formData, setFormData] = useState(entry);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');
    };

    const validate = () => {
        if (formData.passport_status === 'Received' && !formData.received_date) {
            setError('Received Date is required when status is "Received".');
            return false;
        }
        if (formData.passport_status === 'Dispatched' && !formData.dispatch_date) {
            setError('Dispatch Date is required when status is "Dispatched".');
            return false;
        }
        return true;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setIsSaving(true);
        setError('');

        try {
            // Pass the original ID and the updated data to the backend
            const res = await window.electronAPI.updatePassportEntry({
                user,
                id: entry.id,
                data: { ...formData, candidate_id: entry.candidate_id } // Ensure candidate_id is included
            });

            if (res.success) {
                // Pass the UPDATED data (from the database) back to the parent
                onSave(res.data);
                toast.success('Passport entry updated successfully!');
                // onClose is called by onSave's parent, but we call it here too for safety
                onClose(); 
            } else {
                setError(res.error || 'Failed to update passport entry.');
            }
        } catch (err) {
            setError('An unexpected error occurred during save.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const getIcon = (status) => {
        if (status === 'Received') return <FiUserCheck />;
        if (status === 'Dispatched') return <FiTruck />;
        return <FiEdit2 />;
    };


    return (
        <div className="viewer-modal-backdrop" onClick={onClose}>
            <div className="viewer-modal-content payment-modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '500px', height: 'fit-content'}}>
                <button className="viewer-close-btn" onClick={onClose}><FiX /></button>
                <div className="viewer-header">
                    <h3>{getIcon(formData.passport_status)} Edit Movement: {entry.id}</h3>
                </div>
                <div className="payment-modal-body" style={{padding: '2rem'}}>
                    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        
                        {error && <div className="form-message error"><FiAlertTriangle /> {error}</div>}

                        <div className="form-group">
                            <label>Action Type</label>
                            <select name="passport_status" value={formData.passport_status} onChange={handleFormChange}>
                                {statusOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Source / Handled By</label>
                            <select name="source_type" value={formData.source_type} onChange={handleFormChange}>
                                {sourceOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                            </select>
                        </div>
                        {formData.source_type === 'Agent Candidate' && (
                             <div className="form-group">
                                <label>Agent Details</label>
                                <input type="text" name="agent_contact" value={formData.agent_contact || ''} onChange={handleFormChange} placeholder="Name / Phone" />
                            </div>
                        )}
                        
                        {formData.passport_status === 'Received' ? (
                            <>
                                <div className="form-group">
                                    <label>Date Received *</label>
                                    <input type="date" name="received_date" value={formData.received_date || ''} onChange={handleFormChange} />
                                </div>
                                <div className="form-group">
                                    <label>Notes</label>
                                    <textarea name="received_notes" value={formData.received_notes || ''} onChange={handleFormChange} rows="2"></textarea>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="form-group">
                                    <label>Date Dispatched *</label>
                                    <input type="date" name="dispatch_date" value={formData.dispatch_date || ''} onChange={handleFormChange} />
                                </div>
                                <div className="form-group">
                                    <label>Docket / Tracking No.</label>
                                    <input type="text" name="docket_number" value={formData.docket_number || ''} onChange={handleFormChange} />
                                </div>
                                <div className="form-group">
                                    <label>Dispatch Notes</label>
                                    <textarea name="dispatch_notes" value={formData.dispatch_notes || ''} onChange={handleFormChange} rows="2"></textarea>
                                </div>
                            </>
                        )}

                        <button type="submit" className="btn btn-full-width" disabled={isSaving} style={{ marginTop: '10px' }}>
                            {isSaving ? 'Updating...' : 'Save Changes'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default PassportEditModal;