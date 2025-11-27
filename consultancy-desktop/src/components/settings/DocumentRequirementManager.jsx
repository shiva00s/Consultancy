import React, { useState, useEffect, useCallback } from 'react';
import { FiFileText, FiPlus, FiTrash2, FiAlertTriangle } from 'react-icons/fi';
import toast from 'react-hot-toast';

// --- Hardcoded list of frequently used documents ---
const STANDARD_DOCUMENTS = [
    'Passport', 
    'Resume', 
    'Photograph', 
    'Education Certificate', 
    'Experience Letter', 
    'Offer Letter', 
    'Visa',
    'Aadhar Card',
    'Pan Card',
    'Medical Certificate',
    'Driving License'
];
// ---------------------------------------------------

function DocumentRequirementManager({ user }) {
    const [requiredDocs, setRequiredDocs] = useState([]);
    const [newDocName, setNewDocName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedStandardDoc, setSelectedStandardDoc] = useState('');

    const fetchDocs = useCallback(async () => {
        setLoading(true);
        const res = await window.electronAPI.getRequiredDocuments();
        if (res.success) {
            setRequiredDocs(res.data);
        } else {
            toast.error(res.error || 'Failed to fetch required documents.');
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchDocs();
    }, [fetchDocs]);

    const handleAddDoc = async (e) => {
        e.preventDefault();
        const name = newDocName.trim();
        if (!name) {
            toast.error('Document name cannot be empty.');
            return;
        }

        setIsSaving(true);
        const res = await window.electronAPI.addRequiredDocument({ user, name });
        
        if (res.success) {
            setRequiredDocs(prev => [...prev, res.data]);
            setNewDocName('');
            setSelectedStandardDoc('');
            toast.success(`Document "${name}" added.`);
        } else {
            toast.error(res.error || 'Failed to add document.');
        }
        setIsSaving(false);
    };

    const handleDeleteDoc = async (id, name) => {
        if (!window.confirm(`Are you sure you want to remove the required document "${name}"?`)) return;

        const res = await window.electronAPI.deleteRequiredDocument({ user, id });
        
        if (res.success) {
            setRequiredDocs(prev => prev.filter(doc => doc.id !== id));
            toast.success(`Document "${name}" removed from required list.`);
        } else {
            toast.error(res.error || 'Failed to delete document.');
        }
    };
    
    const handleStandardDocSelect = (e) => {
        const value = e.target.value;
        setSelectedStandardDoc(value);
        if (value) {
            setNewDocName(value); // Fill the input box
        }
    };

    return (
        <div className="document-manager-section" style={{marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)'}}>
            <h3><FiFileText /> Manage Required Documents</h3>
            <p style={{fontSize: '0.9rem', color: 'var(--text-secondary)'}}>
                Define a master list of mandatory documents. Candidates lacking these will be flagged in the Document Checker. (Current count: {requiredDocs.length})
            </p>

            {/* --- ADD FORM (Fixed Alignment) --- */}
            <form onSubmit={handleAddDoc} style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr auto', // Flexible columns + button
                gap: '16px', 
                alignItems: 'end', // Bottom alignment
                margin: '1rem 0' 
            }}>
                
                <div className="form-group" style={{marginBottom: 0}}>
                    <label>Select Frequent Document</label>
                    <select 
                        value={selectedStandardDoc} 
                        onChange={handleStandardDocSelect}
                    >
                        <option value="">-- Select or Type Below --</option>
                        {STANDARD_DOCUMENTS.map(doc => (<option key={doc} value={doc}>{doc}</option>))}
                    </select>
                </div>

                <div className="form-group" style={{marginBottom: 0}}>
                    <label>Custom Document Name</label>
                    <input
                        type="text"
                        value={newDocName}
                        onChange={(e) => setNewDocName(e.target.value)}
                        placeholder="Enter Category Name"
                    />
                </div>
                
                {/* Button with Spacer Label */}
                <div className="form-group" style={{marginBottom: 0}}>
                    <label style={{visibility: 'hidden'}}>Action</label>
                    <button type="submit" className="btn" disabled={isSaving || !newDocName.trim()} style={{minWidth: '140px'}}>
                        <FiPlus /> Add
                    </button>
                </div>
            </form>

            {/* --- LIST --- */}
            <div className="required-doc-list" style={{marginTop: '1rem'}}>
                {loading ? (
                    <p>Loading...</p>
                ) : requiredDocs.length === 0 ? (
                    <p style={{color: 'var(--danger-color)'}}>No required documents defined yet.</p>
                ) : (
                    <ul className="user-list"> 
                        {requiredDocs.map(doc => (
                            <li key={doc.id} className="user-item">
                                <div className="user-item-info">
                                    <strong>{doc.name}</strong>
                                    <span style={{marginLeft: '10px'}}>(Category Must Match Upload)</span>
                                </div>
                                <div className="user-item-actions">
                                    <button
                                        className="doc-btn delete"
                                        title="Remove from Required List (Soft Delete)"
                                        onClick={() => handleDeleteDoc(doc.id, doc.name)}
                                    >
                                        <FiTrash2 />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default DocumentRequirementManager;