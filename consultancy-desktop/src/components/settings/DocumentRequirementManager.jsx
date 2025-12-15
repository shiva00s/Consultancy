import React, { useState, useEffect, useCallback } from 'react';
import { FiFileText, FiPlus, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../../css/DocumentRequirementManager.css';

// Standard documents list
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

    // ✅ FILTER: Hide already added documents from dropdown
    const availableDocuments = STANDARD_DOCUMENTS.filter(doc => 
        !requiredDocs.some(existingDoc => 
            existingDoc.name.toLowerCase() === doc.toLowerCase()
        )
    );

    const handleAddDoc = async (e) => {
        e.preventDefault();
        const name = newDocName.trim();
        if (!name) {
            toast.error('Document name cannot be empty.');
            return;
        }

        // Check if already exists (case-insensitive)
        const alreadyExists = requiredDocs.some(doc => 
            doc.name.toLowerCase() === name.toLowerCase()
        );
        
        if (alreadyExists) {
            toast.error(`"${name}" is already in the required documents list.`);
            return;
        }

        setIsSaving(true);
        const res = await window.electronAPI.addRequiredDocument({ user, name });
        
        if (res.success) {
            setRequiredDocs(prev => [...prev, res.data]);
            setNewDocName('');
            setSelectedStandardDoc('');
            toast.success(`✅ Document "${name}" added.`);
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
            toast.success(`🗑️ Document "${name}" removed from required list.`);
        } else {
            toast.error(res.error || 'Failed to delete document.');
        }
    };
    
    const handleStandardDocSelect = (e) => {
        const value = e.target.value;
        setSelectedStandardDoc(value);
        if (value) {
            setNewDocName(value);
        }
    };

    return (
        <div className="doc-req-section">
            {/* Header */}
            <div className="doc-req-header">
                <h3 className="doc-req-title">
                    <FiFileText /> Manage Required Documents
                </h3>
                <p className="doc-req-description">
                    Define a master list of mandatory documents. Candidates lacking these will be flagged in the Document Checker. (Current count: <strong>{requiredDocs.length}</strong>)
                </p>
            </div>

            {/* Add Form - 3 Column Pattern */}
            <form onSubmit={handleAddDoc} className="doc-req-form">
                <div className="form-group">
                    <label>Select Frequent Document</label>
                    <select 
                        className="form-select"
                        value={selectedStandardDoc} 
                        onChange={handleStandardDocSelect}
                        disabled={availableDocuments.length === 0}
                    >
                        <option value="">
                            {availableDocuments.length === 0 
                                ? '-- All documents added --' 
                                : '-- Select or Type Below --'
                            }
                        </option>
                        {availableDocuments.map(doc => (
                            <option key={doc} value={doc}>{doc}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>Custom Document Name</label>
                    <input
                        type="text"
                        className="form-input"
                        value={newDocName}
                        onChange={(e) => setNewDocName(e.target.value)}
                        placeholder="Enter Category Name"
                    />
                </div>
                
                <div className="form-group">
                    <label style={{visibility: 'hidden'}}>Action</label>
                    <button 
                        type="submit" 
                        className="btn btn-add" 
                        disabled={isSaving || !newDocName.trim()}
                    >
                        <FiPlus /> Add
                    </button>
                </div>
            </form>

            {/* Document Cards Grid */}
            <div className="doc-req-list">
                {loading ? (
                    <p className="loading-text">⏳ Loading documents...</p>
                ) : requiredDocs.length === 0 ? (
                    <div className="empty-state">
                        <p>📄 No required documents defined yet. Add your first document above.</p>
                    </div>
                ) : (
                    <div className="doc-req-cards">
                        {requiredDocs.map(doc => (
                            <div key={doc.id} className="doc-req-card">
                                <div className="doc-card-content">
                                    <span className="doc-card-name">{doc.name}</span>
                                    <span className="doc-card-note">(CATEGORY MUST MATCH UPLOAD)</span>
                                </div>
                                <button
                                    className="doc-delete-btn"
                                    title="Remove from Required List"
                                    onClick={() => handleDeleteDoc(doc.id, doc.name)}
                                >
                                    <FiTrash2 />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default DocumentRequirementManager;
