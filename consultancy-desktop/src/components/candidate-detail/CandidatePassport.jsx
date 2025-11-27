import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiServer, FiUserCheck, FiTruck, FiCalendar, FiMapPin, FiClock, FiEye, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import '../../css/CandidatePassport.css';
import DocumentViewer from '../DocumentViewer';

const initialForm = {
    passport_status: 'Received',
    received_date: '',
    received_notes: '',
    dispatch_date: '',
    docket_number: '',
    dispatch_notes: '',
    source_type: 'Direct Candidate',
    agent_contact: '',
};

const statusOptions = ['Received', 'Dispatched'];
const sourceOptions = ['Direct Candidate', 'Agent Candidate'];

function CandidatePassport({ candidateId, documents }) {
    const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(initialForm);
    const [isSaving, setIsSaving] = useState(false);
    const [viewingDoc, setViewingDoc] = useState(null);

    // --- NEW: Edit Mode State ---
    const [editingId, setEditingId] = useState(null);

    // Find passport document
    const passportDoc = documents?.find(doc => 
        (doc.category && doc.category.toLowerCase() === 'passport') || 
        (doc.fileName && doc.fileName.toLowerCase().includes('passport'))
    );

    const fetchTracking = useCallback(async () => {
        setLoading(true);
        const res = await window.electronAPI.getPassportTracking({ candidateId });
        if (res.success) setEntries(res.data);
        else toast.error(res.error || 'Failed to fetch passport tracking.');
        setLoading(false);
    }, [candidateId]);

    useEffect(() => {
        fetchTracking();
    }, [fetchTracking]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    // --- CRUD: Create or Update ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Basic Validation
        if (form.passport_status === 'Received' && !form.received_date) {
            toast.error('Received Date is required.'); return;
        }
        if (form.passport_status === 'Dispatched' && !form.dispatch_date) {
            toast.error('Dispatch Date is required.'); return;
        }

        setIsSaving(true);
        const data = { ...form, candidate_id: candidateId };
        
        let res;
        if (editingId) {
            // UPDATE EXISTING
            res = await window.electronAPI.updatePassportEntry({ user, id: editingId, data });
        } else {
            // CREATE NEW
            res = await window.electronAPI.addPassportEntry({ user, data });
        }

        if (res.success) {
            if (editingId) {
                setEntries(prev => prev.map(e => e.id === editingId ? res.data : e));
                toast.success('Entry updated successfully!');
            } else {
                setEntries(prev => [res.data, ...prev]);
                toast.success('Passport entry saved!');
            }
            handleCancelEdit(); // Reset form
        } else {
            toast.error(res.error || 'Operation failed.');
        }

        setIsSaving(false);
    };

    // --- CRUD: Delete ---
    const handleDelete = async (id) => {
        if(!window.confirm("Are you sure you want to delete this entry?")) return;
        
        const res = await window.electronAPI.deletePassportEntry({ user, id });
        if (res.success) {
            setEntries(prev => prev.filter(e => e.id !== id));
            toast.success("Entry deleted.");
            if (editingId === id) handleCancelEdit();
        } else {
            toast.error(res.error || "Failed to delete.");
        }
    };

    // --- CRUD: Prepare Edit ---
    const handleEdit = (entry) => {
        setEditingId(entry.id);
        setForm({
            passport_status: entry.passport_status,
            received_date: entry.received_date || '',
            received_notes: entry.received_notes || '',
            dispatch_date: entry.dispatch_date || '',
            docket_number: entry.docket_number || '',
            dispatch_notes: entry.dispatch_notes || '',
            source_type: entry.source_type || 'Direct Candidate',
            agent_contact: entry.agent_contact || '',
        });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setForm(initialForm);
    };
    
    const getStatusIcon = (status) => {
        if (status === 'Received') return <FiUserCheck style={{ color: 'var(--success-color)' }} />;
        if (status === 'Dispatched') return <FiTruck style={{ color: 'var(--primary-color)' }} />;
        return <FiServer />;
    };

    const handleViewPassport = () => {
        if (!passportDoc) return;
        const isViewable = passportDoc.fileType === 'application/pdf' || passportDoc.fileType?.startsWith('image/');
        if (isViewable) setViewingDoc(passportDoc);
        else window.electronAPI.openFileExternally({ path: passportDoc.filePath });
    };

    if (loading) return <p>Loading...</p>;

    return (
        <div className="passport-tracking-content">
            
            {viewingDoc && (
                <DocumentViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) 2fr', gap: '24px', alignItems: 'start' }}>

                {/* LEFT COLUMN: FORM */}
                <div className="module-form-card" style={{marginTop:0, borderColor: editingId ? 'var(--primary-color)' : ''}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid var(--border-color)'}}>
                        <h3 style={{margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px'}}>
                            {editingId ? <><FiEdit2 /> Edit Entry</> : <><FiPlus /> Record Movement</>}
                        </h3>
                        {passportDoc && (
                            <button type="button" className="btn btn-secondary" onClick={handleViewPassport} title={`View ${passportDoc.fileName}`} style={{padding: '0 12px', fontSize: '0.75rem', height: '32px', display: 'flex', gap: '6px', alignItems: 'center'}}>
                                <FiEye /> View Doc
                            </button>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group">
                            <label>Action Type</label>
                            <select name="passport_status" value={form.passport_status} onChange={handleFormChange}>
                                {statusOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Source / Handled By</label>
                            <select name="source_type" value={form.source_type} onChange={handleFormChange}>
                                {sourceOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                            </select>
                        </div>
                        {form.source_type === 'Agent Candidate' && (
                             <div className="form-group">
                                <label>Agent Details</label>
                                <input type="text" name="agent_contact" value={form.agent_contact} onChange={handleFormChange} placeholder="Name / Phone" />
                            </div>
                        )}
                        
                        {form.passport_status === 'Received' ? (
                            <>
                                <div className="form-group">
                                    <label>Date Received *</label>
                                    <input type="date" name="received_date" value={form.received_date} onChange={handleFormChange} />
                                </div>
                                <div className="form-group">
                                    <label>Notes</label>
                                    <textarea name="received_notes" value={form.received_notes} onChange={handleFormChange} rows="2"></textarea>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="form-group">
                                    <label>Date Dispatched *</label>
                                    <input type="date" name="dispatch_date" value={form.dispatch_date} onChange={handleFormChange} />
                                </div>
                                <div className="form-group">
                                    <label>Docket / Tracking No.</label>
                                    <input type="text" name="docket_number" value={form.docket_number} onChange={handleFormChange} />
                                </div>
                                <div className="form-group">
                                    <label>Dispatch Notes</label>
                                    <textarea name="dispatch_notes" value={form.dispatch_notes} onChange={handleFormChange} rows="2"></textarea>
                                </div>
                            </>
                        )}

                        <div style={{display:'flex', gap:'10px'}}>
                            <button type="submit" className="btn btn-full-width" disabled={isSaving} style={{ marginTop: '10px', flexGrow: 1 }}>
                                {isSaving ? 'Saving...' : (editingId ? 'Update Entry' : 'Save Entry')}
                            </button>
                            {editingId && (
                                <button type="button" className="btn btn-secondary" onClick={handleCancelEdit} style={{marginTop:'10px'}}>
                                    <FiX />
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* RIGHT COLUMN: HISTORY LIST */}
                <div className="module-list-card" style={{marginTop:0, height: '100%', display: 'flex', flexDirection: 'column'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid var(--border-color)'}}>
                        <h3 style={{margin: 0, fontSize: '1.1rem'}}><FiClock /> Movement History</h3>
                        <span className="badge neutral">{entries.length} Records</span>
                    </div>
                    
                    <div className="module-list passport-list" style={{flexGrow: 1, overflowY: 'auto', maxHeight: '600px'}}>
                        {entries.length === 0 ? (
                            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', opacity: 0.7}}>
                                <FiMapPin style={{fontSize: '3rem', marginBottom: '1rem'}} />
                                <p>No movement history recorded yet.</p>
                            </div>
                        ) : (
                            entries.map((entry) => (
                                <div className={`passport-item module-list-item ${editingId === entry.id ? 'highlight-edit' : ''}`} key={entry.id} style={{alignItems: 'flex-start'}}>
                                    <div className="item-icon" style={{marginTop: '4px'}}>
                                        {getStatusIcon(entry.passport_status)}
                                    </div>
                                    <div className="item-details" style={{flex: 1}}>
                                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                            <strong style={{fontSize: '0.95rem', color: 'var(--text-primary)'}}>
                                                {entry.passport_status === 'Received' ? 'PASSPORT RECEIVED' : 'PASSPORT DISPATCHED'}
                                            </strong>
                                            <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>
                                                {entry.passport_status === 'Received' ? entry.received_date : entry.dispatch_date}
                                            </span>
                                        </div>
                                        <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px'}}>
                                            Source: {entry.source_type}
                                            {entry.agent_contact && <span style={{fontWeight: 600}}> • {entry.agent_contact}</span>}
                                        </div>
                                        {entry.passport_status === 'Dispatched' && entry.docket_number && (
                                            <div style={{marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-color)', fontWeight: 500, fontSize: '0.85rem'}}>
                                                <FiTruck /> Tracking: {entry.docket_number}
                                            </div>
                                        )}
                                        {(entry.received_notes || entry.dispatch_notes) && (
                                            <div style={{marginTop: '8px', padding: '8px 12px', background: 'var(--bg-body)', borderRadius: '6px', fontSize: '0.85rem', borderLeft: '3px solid var(--border-color)'}}>
                                                {entry.received_notes || entry.dispatch_notes}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* CRUD ACTIONS */}
                                    <div className="item-actions" style={{flexDirection:'column', gap:'5px', marginLeft:'10px'}}>
                                        <button className="icon-btn" onClick={() => handleEdit(entry)} title="Edit">
                                            <FiEdit2 />
                                        </button>
                                        <button className="icon-btn" onClick={() => handleDelete(entry.id)} title="Delete">
                                            <FiTrash2 />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CandidatePassport;