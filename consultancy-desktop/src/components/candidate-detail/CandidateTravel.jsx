import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiSend, FiPlus, FiTrash2, FiDownload, FiMapPin, FiEdit2 } from 'react-icons/fi'; // ADDED FiEdit2
import { readFileAsBuffer } from '../../utils/file';
import toast from 'react-hot-toast'; 
import '../../css/CandidateTravel.css'; 

import TravelEditModal from "../modals/TravelEditModal";

const initialTravelForm = {
    pnr: '',
    travel_date: '',
    ticket_file: null, // Stores the File object
    departure_city: '',
    arrival_city: '',
    notes: '',
};

function CandidateTravel({user, candidateId }) {
    const [travelEntries, setTravelEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [travelForm, setTravelForm] = useState(initialTravelForm);
    const [isSaving, setIsSaving] = useState(false);
    const [editingTravel, setEditingTravel] = useState(null); // <-- NEW STATE
    const fileInputRef = useRef(null);

    const fetchTravelTracking = useCallback(async () => {
        setLoading(true);
        const res = await window.electronAPI.getTravelTracking({ candidateId });
        if (res.success) setTravelEntries(res.data);
        setLoading(false);
    }, [candidateId]);

    useEffect(() => {
        fetchTravelTracking();
    }, [candidateId, fetchTravelTracking]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setTravelForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        setTravelForm((prev) => ({ ...prev, ticket_file: e.target.files[0] || null }));
    };
    
    const handleAddEntry = async (e) => {
        e.preventDefault();

        if (!travelForm.travel_date || !travelForm.departure_city || !travelForm.arrival_city) {
            toast.error('Travel Date, Departure, and Arrival cities are required.'); 
            return;
        }

        setIsSaving(true);
        let ticket_file_path = '';
        let toastId = toast.loading('Saving travel entry...');

        try {
            if (travelForm.ticket_file) {
                toast.loading('Uploading ticket file...', { id: toastId });
                const buffer = await readFileAsBuffer(travelForm.ticket_file);
                const fileData = {
                    name: travelForm.ticket_file.name,
                    type: travelForm.ticket_file.type,
                    buffer: buffer,
                    category: 'Travel', 
                };

                const docRes = await window.electronAPI.addDocuments({
                    user,   
                    candidateId,
                    files: [fileData],
                });

                if (docRes.success && docRes.newDocs.length > 0) {
                    ticket_file_path = docRes.newDocs[0].filePath;
                } else {
                    throw new Error(docRes.error || "Failed to upload ticket file.");
                }
            }
            
            const data = {
                ...travelForm,
                candidate_id: candidateId,
                ticket_file_path: ticket_file_path,
            };
            
            const res = await window.electronAPI.addTravelEntry({user, data });

            if (res.success) {
                setTravelEntries((prev) => [res.data, ...prev]);
                setTravelForm(initialTravelForm);
                if (fileInputRef.current) fileInputRef.current.value = null;
                toast.success('Travel entry saved successfully!', { id: toastId }); 
            } else {
                toast.error(res.error, { id: toastId }); 
            }

        } catch (err) {
            toast.error(`Error: ${err.message}`, { id: toastId }); 
        }

        setIsSaving(false);
    };

    // Handler for saving the updated entry from the modal (now receives database response)
    const handleUpdateTravel = (updatedTravelData) => {
        // Update local state with the confirmed and updated row from the backend
        setTravelEntries(prev => prev.map(t => 
            t.id === updatedTravelData.id ? updatedTravelData : t
        ));
        setEditingTravel(null);
        // Note: Toast is handled within the modal.
    };

    const handleDeleteEntry = async (id) => {
        if (window.confirm('Are you sure you want to move this travel entry to the Recycle Bin?')) {
            const res = await window.electronAPI.deleteTravelEntry({user, id });
            if (res.success) {
                setTravelEntries((prev) => prev.filter((e) => e.id !== id));
                toast.success('Travel entry moved to Recycle Bin.'); 
            } else {
                toast.error(res.error); 
            }
        }
    };
    
    const openFile = (filePath) => {
        window.electronAPI.openFileExternally({ path: filePath });
    };

    if (loading) return <p>Loading travel tracking...</p>;

    return (
        <div className="travel-tracking-content module-vertical-stack">
            
            {editingTravel && ( // <-- RENDER MODAL
                <TravelEditModal
                    user={user}
                    travel={editingTravel}
                    onClose={() => setEditingTravel(null)}
                    onSave={handleUpdateTravel}
                />
            )}

            <div className="form-container module-form-card">
                <h3><FiPlus /> Add New Travel/Ticket Record</h3>
                <form onSubmit={handleAddEntry} className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    
                    <div className="form-group">
                        <label>Travel Date (Required)</label>
                        <input type="date" name="travel_date" value={travelForm.travel_date} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                        <label>PNR / Ticket No. (Optional)</label>
                        <input type="text" name="pnr" value={travelForm.pnr} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                        <label>Upload Ticket Document (Optional)</label>
                        <div className="custom-file-input">
                            <input 
                                type="file" 
                                id="travel-file-input" 
                                name="ticket_file" 
                                onChange={handleFileChange} 
                                ref={fileInputRef} 
                            />
                            <label htmlFor="travel-file-input" className="file-input-label btn btn-no-hover">
                                Choose File
                            </label>
                            <span className="file-name-display">
                                {travelForm.ticket_file
                                ? travelForm.ticket_file.name
                                : "No file chosen"}
                            </span>
                        </div>
                    </div>
                    
                    <div className="form-group">
                        <label>Departure City (Required)</label>
                        <input type="text" name="departure_city" value={travelForm.departure_city} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                        <label>Arrival City (Required)</label>
                        <input type="text" name="arrival_city" value={travelForm.arrival_city} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                        <label>Notes</label>
                        <textarea name="notes" value={travelForm.notes} onChange={handleFormChange} rows="2"></textarea>
                    </div>

                    <button type="submit" className="btn btn-full-width" disabled={isSaving} style={{ gridColumn: '1 / -1' }}>
                        {isSaving ? 'Saving...' : 'Save Travel Entry'}
                    </button>
                </form>
            </div>
            
            <div className="list-container module-list-card">
                <h3><FiSend /> Scheduled Travel History ({travelEntries.length})</h3>
                <div className="module-list travel-list">
                    {travelEntries.length === 0 ? (
                        <p style={{textAlign: 'center', color: 'var(--text-secondary)'}}>No travel records found.</p>
                    ) : (
                        travelEntries.map((entry) => (
                            <div className="travel-item module-list-item" key={entry.id}>
                                <div className="item-icon">
                                    <FiMapPin />
                                </div>
                                <div className="item-details">
                                    <strong>{entry.departure_city} to {entry.arrival_city}</strong>
                                    <p className="mt-1">
                                        Date: {entry.travel_date} | PNR: {entry.pnr || 'N/A'}
                                    </p>
                                    {entry.notes && <p className="mt-1"><small>Notes: {entry.notes}</small></p>}
                                 </div>
                                <div className="item-actions">
                                    {/* --- EDIT BUTTON --- */}
                                    <button 
                                        type="button" 
                                        className="doc-btn view" 
                                        title="Edit Entry" 
                                        onClick={() => setEditingTravel(entry)}
                                    >
                                        <FiEdit2 />
                                    </button>
                                    {entry.ticket_file_path && (
                                        <button 
                                            type="button" 
                                            className="icon-btn"
                                            title="View Ticket Document" 
                                            onClick={() => openFile(entry.ticket_file_path)}
                                        >
                                            <FiDownload />
                                        </button>
                                    )}
                                    {/* --- DELETE BUTTON --- */}
                                    <button 
                                        type="button" 
                                       className="icon-btn"
                                        title="Move to Recycle Bin" 
                                        onClick={() => handleDeleteEntry(entry.id)}
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

export default CandidateTravel;