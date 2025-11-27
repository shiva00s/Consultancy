import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiPlus, FiTrash2, FiFileText, FiDownload, FiEdit2 } from 'react-icons/fi'; // ADDED FiEdit2
import { readFileAsBuffer } from '../../utils/file';
import toast from 'react-hot-toast'; 
import '../../css/CandidateMedical.css'; 
import MedicalEditModal from "../modals/MedicalEditModal";

const medicalStatusOptions = ['Pending', 'Fit', 'Unfit', 'Cancelled'];

const initialMedicalForm = {
    test_date: '',
    certificate_file: null, // Stores the File object
    status: 'Pending',
    notes: '',
};



function CandidateMedical({user, candidateId }) {
    const [medicalEntries, setMedicalEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [medicalForm, setMedicalForm] = useState(initialMedicalForm);
    const [isSaving, setIsSaving] = useState(false);
    const [editingMedical, setEditingMedical] = useState(null); // <-- NEW STATE
    const fileInputRef = useRef(null);

    const fetchMedicalTracking = useCallback(async () => {
        setLoading(true);
        const res = await window.electronAPI.getMedicalTracking({ candidateId });
        if (res.success) setMedicalEntries(res.data);
        setLoading(false);
    }, [candidateId]);

    useEffect(() => {
        fetchMedicalTracking();
    }, [candidateId, fetchMedicalTracking]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setMedicalForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        setMedicalForm((prev) => ({ ...prev, certificate_file: e.target.files[0] || null }));
    };

    const handleAddEntry = async (e) => {
        e.preventDefault();

        if (!medicalForm.test_date) {
            toast.error('Test Date is required.'); 
            return;
        }

        setIsSaving(true);
        let toastId = toast.loading('Saving medical entry...');

        try {
            let certificate_path = '';
            
            if (medicalForm.certificate_file) {
                toast.loading('Uploading certificate...', { id: toastId }); 
                const buffer = await readFileAsBuffer(medicalForm.certificate_file);
                const fileData = {
                    name: medicalForm.certificate_file.name,
                    type: medicalForm.certificate_file.type,
                    buffer: buffer,
                    category: 'Medical', 
                };

                const docRes = await window.electronAPI.addDocuments({
                    user,
                    candidateId,
                    files: [fileData],
                });

                if (docRes.success && docRes.newDocs.length > 0) {
                    certificate_path = docRes.newDocs[0].filePath;
                } else {
                    throw new Error(docRes.error || "Failed to upload certificate file.");
                }
            }
            
            const data = {
                ...medicalForm,
                candidate_id: candidateId,
                certificate_path: certificate_path,
            };
            
            const res = await window.electronAPI.addMedicalEntry({user, data });

            if (res.success) {
                setMedicalEntries((prev) => [res.data, ...prev]);
                setMedicalForm(initialMedicalForm);
                if (fileInputRef.current) fileInputRef.current.value = null;
                toast.success('Medical entry saved successfully!', { id: toastId }); 
            } else {
                toast.error(res.error, { id: toastId }); 
            }

        } catch (err) {
            toast.error(`Error: ${err.message}`, { id: toastId }); 
        }

        setIsSaving(false);
    };

    // Handler for saving the updated entry from the modal (now receives database response)
    const handleUpdateMedical = (updatedMedicalData) => {
        // Update local state with the confirmed and updated row from the backend
        setMedicalEntries(prev => prev.map(m => 
            m.id === updatedMedicalData.id ? updatedMedicalData : m
        ));
        setEditingMedical(null);
        // Note: Toast is handled within the modal.
    };

    const handleDeleteEntry = async (id, test_date) => {
        if (window.confirm(`Are you sure you want to move the medical entry from ${test_date} to the Recycle Bin?`)) {
            const res = await window.electronAPI.deleteMedicalEntry({user, id });
            if (res.success) {
                setMedicalEntries((prev) => prev.filter((e) => e.id !== id));
                toast.success('Medical entry moved to Recycle Bin.'); 
            } else {
                toast.error(res.error); 
            }
        }
    };
    
   const openFile = async (documentId) => { // Now takes the ID, not the path
        const res = await window.electronAPI.getSecureFilePath({ documentId });
        if (res.success) {
            window.electronAPI.openFileExternally({ path: res.filePath });
        } else {
            toast.error(res.error || "File path lookup failed.");
        }
    };

    if (loading) return <p>Loading medical tracking...</p>;
    
    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Fit': return 'badge-green';
            case 'Unfit': return 'badge-red';
            case 'Cancelled': return 'badge-grey';
            case 'Pending': 
            default: return 'badge-yellow';
        }
    };


    return (
        <div className="medical-tracking-content module-vertical-stack">
            
            {editingMedical && ( // <-- RENDER MODAL
                <MedicalEditModal
                    user={user} 
                    medical={editingMedical}
                    onClose={() => setEditingMedical(null)}
                    onSave={handleUpdateMedical}
                />
            )}

            <div className="form-container module-form-card">
                <h3><FiPlus /> Add New Medical Record</h3>
             <form onSubmit={handleAddEntry} className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    
                    <div className="form-group">
                        <label>Test Date</label>
                        <input type="date" name="test_date" value={medicalForm.test_date} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                        <label>Status</label>
                        <select name="status" value={medicalForm.status} onChange={handleFormChange}>
                            {medicalStatusOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Upload Certificate (Optional)</label>
                        <div className="custom-file-input">
                            <input 
                                type="file" 
                                id="medical-file-input" 
                                name="certificate_file" 
                                onChange={handleFileChange} 
                                ref={fileInputRef} 
                            />
                            <label htmlFor="medical-file-input" className="file-input-label btn btn-no-hover">
                                Choose File
                            </label>
                            <span className="file-name-display">
                                {medicalForm.certificate_file
                                ? medicalForm.certificate_file.name
                                : "No file chosen"}
                            </span>
                        </div>
                    </div>
                    
                    <div className="form-group full-width">
                        <label>Notes</label>
                       <textarea name="notes" value={medicalForm.notes} onChange={handleFormChange} rows="3"></textarea>
                    </div>
                    
                    <button type="submit" className="btn btn-full-width" disabled={isSaving} style={{ gridColumn: '1 / -1' }}>
                        {isSaving ? 'Saving...' : 'Save Medical Entry'}
                    </button>
                </form>
            </div>
            
            <div className="list-container module-list-card">
                <h3>Medical Tracking History ({medicalEntries.length})</h3>
                <div className="module-list medical-list">
                    {medicalEntries.length === 0 ? (
                        <p style={{textAlign: 'center', color: 'var(--text-secondary)'}}>No medical records found.</p>
                    ) : (
                        medicalEntries.map((entry) => (
                            <div className="medical-item module-list-item" key={entry.id}>
                                <div className="item-icon">
                                    <FiFileText />
                                </div>
                                <div className="item-details">
                                    <strong>Test Date: {entry.test_date}</strong>
                                    {entry.notes && <p className="mt-1"><small>Notes: {entry.notes}</small></p>}
                                </div>
                                <div className="item-status">
                                    <span className={`status-badge ${getStatusBadgeClass(entry.status)}`}>
                                        {entry.status}
                                    </span>
                                </div>
                                <div className="item-actions">
                                    {/* --- EDIT BUTTON --- */}
                                    <button 
                                        type="button" 
                                        className="icon-btn"
                                        title="Edit Entry" 
                                        onClick={() => setEditingMedical(entry)}
                                    >
                                        <FiEdit2 />
                                    </button>
                                    {entry.certificate_path && (
                                        <button type="button" className="doc-btn view" title="View Certificate" onClick={() => openFile(entry.id)}>
                                            <FiDownload />
                                        </button>
                                    )}
                                    {/* --- DELETE BUTTON --- */}
                                    <button 
                                        type="button" 
                                       className="icon-btn"
                                        title="Move to Recycle Bin" 
                                        onClick={() => handleDeleteEntry(entry.id, entry.test_date)}
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

export default CandidateMedical;