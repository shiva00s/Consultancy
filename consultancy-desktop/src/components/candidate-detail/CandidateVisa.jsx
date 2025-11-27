import React, { useState, useEffect, useCallback } from 'react';
import { FiPackage, FiTrash2, FiPlus, FiEdit2, FiUser } from 'react-icons/fi';
import toast from 'react-hot-toast'; 
import VisaEditModal from '../modals/VisaEditModal'; 

const visaStatusOptions = [
  'Pending',
  'Submitted',
  'Biometrics Done',    
  'In Progress',
  'Approved',
  'Rejected',
  'Cancelled',
];

const initialVisaForm = {
  country: '',
  visa_type: '',
  application_date: '',
  status: 'Pending',
  notes: '',
  position: '',
  passport_number: '',
  travel_date: '',
  contact_type: 'Direct Candidate', 
  agent_contact: '',
};

function CandidateVisa({user, candidateId }) {
  const [visaEntries, setVisaEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visaForm, setVisaForm] = useState(initialVisaForm);
  const [isSavingVisa, setIsSaving] = useState(false);
  const [editingVisa, setEditingVisa] = useState(null); 

  const fetchVisaTracking = useCallback(async () => {
    setLoading(true);
    const res = await window.electronAPI.getVisaTracking({ candidateId });
    if (res.success) setVisaEntries(res.data);
    setLoading(false);
  }, [candidateId]);

  useEffect(() => {
    fetchVisaTracking();
  }, [candidateId, fetchVisaTracking]);

  const handleVisaFormChange = (e) => {
    const { name, value } = e.target;
    setVisaForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddVisaEntry = async (e) => {
    e.preventDefault();
    
    if (!visaForm.country || !visaForm.application_date) {
      toast.error('Country and Application Date are required.'); 
      return;
    }
    
    setIsSaving(true);
    let toastId = toast.loading('Adding visa entry...');
    
    try {
        const res = await window.electronAPI.addVisaEntry({
            user,
            data: { ...visaForm, candidate_id: candidateId },
        });

        if (res.success) {
            setVisaEntries((prev) => [res.data, ...prev]);
            setVisaForm(initialVisaForm);
            toast.success('Visa entry added successfully.', { id: toastId }); 
        } else {
            const errorMessage = (res.errors && Object.values(res.errors).join(', ')) 
                ? `Validation failed: ${Object.values(res.errors).join(', ')}` 
                : res.error || 'Failed to add visa entry.';
            toast.error(errorMessage, { id: toastId }); 
        }
    } catch (error) {
        toast.error('An unexpected submission error occurred.', { id: toastId });
    } finally {
        setIsSaving(false);
    }
};
  
  const handleUpdateVisa = (updatedVisaData) => {
    setVisaEntries(prev => prev.map(v => 
        v.id === updatedVisaData.id ? updatedVisaData : v
    ));
    setEditingVisa(null);
  };

  const handleDeleteVisaEntry = async (visaId) => {
    if (window.confirm('Are you sure you want to move this visa entry to the Recycle Bin?')) {
      const res = await window.electronAPI.deleteVisaEntry({user, id: visaId });
      if (res.success) {
        setVisaEntries((prev) => prev.filter((v) => v.id !== visaId));
        toast.success('Visa entry moved to Recycle Bin.'); 
      } else {
        toast.error(res.error); 
      }
    }
  };
  
  const getStatusBadgeClass = (status) => {
    switch(status) {
        case 'Approved': return 'badge-green';
        case 'Rejected': return 'badge-red';
        case 'Cancelled': return 'badge-grey';
        case 'Submitted': return 'badge-cyan';
        case 'In Progress': return 'badge-blue';
        default: return 'badge-yellow'; 
    }
  };
  
  if (loading) return <p>Loading visa tracking...</p>;

  return (
    <div className="visa-tracking-content module-vertical-stack">
        
        {editingVisa && ( 
            <VisaEditModal
                user={user}
                visa={editingVisa}
                onClose={() => setEditingVisa(null)}
                onSave={handleUpdateVisa}
            />
        )}

        {/* --- ADD VISA ENTRY FORM --- */}
        <div className="visa-form-container module-form-card">
            <h3><FiPlus /> Add New Visa Entry</h3>
            <form onSubmit={handleAddVisaEntry} className="visa-form form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                
                {/* ROW 1 */}
                <div className="form-group">
                    <label>Position</label>
                    <input type="text" name="position" value={visaForm.position} onChange={handleVisaFormChange} />
                </div>
                <div className="form-group">
                    <label>Country</label>
                    <input type="text" name="country" value={visaForm.country} onChange={handleVisaFormChange} />
                </div>
                <div className="form-group">
                    <label>Passport Number</label>
                    <input type="text" name="passport_number" value={visaForm.passport_number} onChange={handleVisaFormChange} />
                </div>
                
                {/* ROW 2 */}
                <div className="form-group">
                    <label>Travel Date</label>
                    <input type="date" name="travel_date" value={visaForm.travel_date} onChange={handleVisaFormChange} />
                </div>
                <div className="form-group">
                    <label>Application Date</label>
                    <input type="date" name="application_date" value={visaForm.application_date} onChange={handleVisaFormChange} />
                </div>
                <div className="form-group">
                    <label>Visa Type</label>
                    <input type="text" name="visa_type" placeholder="e.g., Work, Visit" value={visaForm.visa_type} onChange={handleVisaFormChange} />
                </div>

                {/* ROW 3: Contact Type, Status, and Conditional Agent Contact */}
                <div className="form-group">
                    <label>Contact Type</label>
                    <select name="contact_type" value={visaForm.contact_type} onChange={handleVisaFormChange}>
                        <option value="Direct Candidate">Direct Candidate</option>
                        <option value="Agent Candidate">Agent Candidate</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Status</label>
                    <select name="status" value={visaForm.status} onChange={handleVisaFormChange}>
                        {visaStatusOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                    </select>
                </div>
                
                {/* CONDITIONAL: AGENT CONTACT (Moves here, takes 3rd slot) */}
                {visaForm.contact_type === 'Agent Candidate' ? (
                    <div className="form-group">
                        <label>Agent Details</label>
                        <input 
                            type="text" 
                            name="agent_contact" 
                            value={visaForm.agent_contact} 
                            onChange={handleVisaFormChange} 
                            placeholder="Name / Phone" 
                            style={{borderColor: 'var(--primary-color)'}}
                        />
                    </div>
                ) : (
                    // Empty placeholder div to keep grid alignment if needed, or let Notes take full width
                    <div className="form-group"></div>
                )}
                
                {/* ROW 4: Notes (Full Width) */}
                <div className="form-group full-width" style={{gridColumn: '1 / -1'}}>
                    <label>Notes</label>
                    <textarea name="notes" value={visaForm.notes} onChange={handleVisaFormChange} rows="3"></textarea>
                </div>
                
                <button
                    type="submit"
                    className="btn btn-full-width"
                    disabled={isSavingVisa}
                    style={{ gridColumn: '1 / -1' }}
                >
                    {isSavingVisa ? 'Saving...' : 'Add Visa Entry'}
                </button>
            </form>
        </div>
        
        {/* --- VISA TRACKING HISTORY LIST --- */}
        <div className="visa-list-container module-list-card">
            <h3><FiPackage /> Tracking History ({visaEntries.length})</h3>
            <div className="module-list visa-list">
                {visaEntries.length === 0 ? (
                    <p style={{textAlign: 'center', color: 'var(--text-secondary)'}}>No visa tracking entries found.</p>
                ) : (
                    visaEntries.map((entry) => (
                        <div className="module-list-item" key={entry.id}>
                            <div className="item-icon">
                                <FiPackage />
                            </div>
                            <div className="item-details">
                                <strong>{entry.country} ({entry.visa_type || 'N/A'})</strong>
                                
                                <p className="mt-1">
                                    Position: {entry.position || 'N/A'} | Passport: {entry.passport_number || 'N/A'}
                                </p>
                                
                                <div style={{display: 'flex', gap: '15px', marginTop: '5px', fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                                    <span>Applied: {entry.application_date}</span>
                                    {entry.travel_date && <span>Travel: {entry.travel_date}</span>}
                                </div>
                                
                                {/* Contextual Details: Agent Info */}
                                {entry.contact_type === 'Agent Candidate' && (
                                    <p className="mt-1" style={{color: 'var(--primary-color)', fontWeight: 500}}>
                                        <FiUser style={{verticalAlign: 'middle'}}/> Agent: {entry.agent_contact || 'Unknown'}
                                    </p>
                                )}

                                {entry.notes && (
                                    <p className="mt-1"><small>Notes: {entry.notes}</small></p>
                                )}
                            </div>
                            <div className="item-status">
                                <span className={`status-badge ${getStatusBadgeClass(entry.status)}`}>
                                    {entry.status}
                                </span>
                            </div>
                            <div className="item-actions">
                                <button
                                    type="button"
                                    className="icon-btn"
                                    title="Edit Entry"
                                    onClick={() => setEditingVisa(entry)}
                                >
                                    <FiEdit2 />
                                </button>
                                <button
                                    type="button"
                                    className="icon-btn"
                                    title="Move to Recycle Bin"
                                    onClick={() => handleDeleteVisaEntry(entry.id)}
                                >
                                    <FiTrash2 />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
);
}

export default CandidateVisa;