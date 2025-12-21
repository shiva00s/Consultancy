import React, { useState, useEffect, useCallback } from 'react';
import { FiPackage, FiTrash2, FiPlus, FiEdit2, FiCheck, FiX, FiGlobe, FiCalendar, FiUser, FiMapPin, FiInfo } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../../css/CandidateVisa.css';

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

// 🎯 Enhanced Confirm Dialog Component
const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText, type = 'danger' }) => {
  if (!isOpen) return null;

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-icon ${type}`}>
          {type === 'danger' ? '🗑️' : type === 'warning' ? '⚠️' : 'ℹ️'}
        </div>
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="btn-confirm-cancel" onClick={onClose}>
            <FiX /> Cancel
          </button>
          <button className={`btn-confirm-${type}`} onClick={onConfirm}>
            <FiCheck /> {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

function CandidateVisa({ user, candidateId }) {
  const [visaEntries, setVisaEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visaForm, setVisaForm] = useState(initialVisaForm);
  const [isSavingVisa, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [autoFillData, setAutoFillData] = useState(null);
  const [isLoadingAutoFill, setIsLoadingAutoFill] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, visaId: null });

  // Fetch auto-fill data from candidate profile and job placements
  const fetchAutoFillData = useCallback(async () => {
    setIsLoadingAutoFill(true);
    try {
      const candidateRes = await window.electronAPI.getCandidateById({ candidateId });
      if (!candidateRes.success) {
        console.error('Failed to fetch candidate data:', candidateRes.error);
        setIsLoadingAutoFill(false);
        return;
      }

      const candidateData = candidateRes.data;
      const jobPlacementsRes = await window.electronAPI.getCandidateJobPlacements({ candidateId });
      let jobData = null;

      if (jobPlacementsRes.success && jobPlacementsRes.data?.length > 0) {
        const activeJob = jobPlacementsRes.data.find((j) => j.placementStatus === 'Assigned') || jobPlacementsRes.data[0];
        if (activeJob && activeJob.jobId) {
          const jobOrderRes = await window.electronAPI.getJobOrderById({ jobId: activeJob.jobId });
          if (jobOrderRes.success) {
            jobData = jobOrderRes.data;
          }
        }
      }

      const profilePosition = candidateData.position_applying_for || '';
      const jobPosition = jobData?.positionTitle || '';
      let positionCombined = '';
      if (profilePosition && jobPosition) {
        positionCombined = `${profilePosition}, ${jobPosition}`;
      } else {
        positionCombined = profilePosition || jobPosition || '';
      }

      setAutoFillData({
        position: positionCombined,
        country: jobData?.country || '',
        passport_number: candidateData.passport_number || '',
      });
    } catch (error) {
      console.error('Error fetching auto-fill data:', error);
    } finally {
      setIsLoadingAutoFill(false);
    }
  }, [candidateId]);

  useEffect(() => {
    fetchAutoFillData();
  }, [fetchAutoFillData]);

  useEffect(() => {
    if (autoFillData && !isLoadingAutoFill) {
      setVisaForm((prev) => ({
        ...prev,
        position: autoFillData.position,
        country: autoFillData.country,
        passport_number: autoFillData.passport_number,
      }));
    }
  }, [autoFillData, isLoadingAutoFill]);

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

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditForm({
      country: entry.country,
      visa_type: entry.visa_type || '',
      application_date: entry.application_date,
      status: entry.status,
      notes: entry.notes || '',
      position: entry.position || '',
      passport_number: entry.passport_number || '',
      travel_date: entry.travel_date || '',
      contact_type: entry.contact_type || 'Direct Candidate',
      agent_contact: entry.agent_contact || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveEdit = async (entryId) => {
    if (!editForm.country || !editForm.application_date) {
      toast.error('⚠️ Country and Application Date are required.');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('⏳ Updating visa entry...');

    try {
      const res = await window.electronAPI.updateVisaEntry({
        user,
        id: entryId,
        data: editForm,
      });

      if (res.success) {
        setVisaEntries((prev) => prev.map((v) => (v.id === entryId ? res.data : v)));
        setEditingId(null);
        setEditForm({});
        toast.success('✅ Visa entry updated successfully!', { id: toastId });
      } else {
        const errorMessage =
          res.errors && Object.values(res.errors).join(', ')
            ? `❌ Validation failed: ${Object.values(res.errors).join(', ')}`
            : res.error || '❌ Failed to update visa entry.';
        toast.error(errorMessage, { id: toastId });
      }
    } catch (error) {
      toast.error('❌ An unexpected error occurred.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddVisaEntry = async (e) => {
    e.preventDefault();
    if (!visaForm.country || !visaForm.application_date) {
      toast.error('⚠️ Country and Application Date are required.');
      return;
    }

    setIsSaving(true);
    let toastId = toast.loading('⏳ Adding visa entry...');

    try {
      const res = await window.electronAPI.addVisaEntry({
        user,
        data: { ...visaForm, candidate_id: candidateId },
      });

      if (res.success) {
        setVisaEntries((prev) => [res.data, ...prev]);
        setVisaForm({
          ...initialVisaForm,
          position: autoFillData?.position || '',
          country: autoFillData?.country || '',
          passport_number: autoFillData?.passport_number || '',
        });
        toast.success('✅ Visa entry added successfully!', { id: toastId });
      } else {
        const errorMessage =
          res.errors && Object.values(res.errors).join(', ')
            ? `❌ Validation failed: ${Object.values(res.errors).join(', ')}`
            : res.error || '❌ Failed to add visa entry.';
        toast.error(errorMessage, { id: toastId });
      }
    } catch (error) {
      toast.error('❌ An unexpected submission error occurred.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVisaEntry = async (visaId) => {
    setConfirmDialog({ isOpen: true, visaId });
  };

  const confirmDelete = async () => {
    const { visaId } = confirmDialog;
    setConfirmDialog({ isOpen: false, visaId: null });

    const res = await window.electronAPI.deleteVisaEntry({ user, id: visaId });
    if (res.success) {
      setVisaEntries((prev) => prev.filter((v) => v.id !== visaId));
      toast.success('✅ Visa entry moved to Recycle Bin.');
    } else {
      toast.error('❌ ' + res.error);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Approved': return 'badge-green';
      case 'Rejected': return 'badge-red';
      case 'Cancelled': return 'badge-grey';
      case 'Submitted': return 'badge-cyan';
      case 'In Progress': return 'badge-blue';
      default: return 'badge-yellow';
    }
  };

  const getStatusEmoji = (status) => {
    switch (status) {
      case 'Approved': return '✅';
      case 'Rejected': return '❌';
      case 'Cancelled': return '🚫';
      case 'Submitted': return '📤';
      case 'Biometrics Done': return '👆';
      case 'In Progress': return '⏳';
      default: return '📋';
    }
  };

  if (loading) return (
    <div className="visa-tracking-content">
      <div className="loading-state">⏳ Loading visa tracking...</div>
    </div>
  );

  return (
    <div className="visa-tracking-content">
      {/* 🎨 Add New Visa Entry Form */}
      <div className="detail-card visa-form-container">
        <h3>
          <FiPlus /> ✈️ Add New Visa Entry
        </h3>
        <form onSubmit={handleAddVisaEntry} className="visa-form form-grid">
          <div className="form-field">
            <label>🌍 Country *</label>
            <input
              type="text"
              name="country"
              value={visaForm.country}
              onChange={handleVisaFormChange}
              placeholder="e.g., USA, Canada, UAE"
              required
              style={{
                backgroundColor: autoFillData?.country ? 'rgba(var(--primary-rgb), 0.05)' : undefined,
              }}
            />
          </div>

          <div className="form-field">
            <label>📄 Visa Type</label>
            <input
              type="text"
              name="visa_type"
              value={visaForm.visa_type}
              onChange={handleVisaFormChange}
              placeholder="e.g., Work Visa, Tourist"
            />
          </div>

          <div className="form-field">
            <label>📅 Application Date *</label>
            <input
              type="date"
              name="application_date"
              value={visaForm.application_date}
              onChange={handleVisaFormChange}
              required
            />
          </div>

          <div className="form-field">
            <label>📊 Status</label>
            <select name="status" value={visaForm.status} onChange={handleVisaFormChange}>
              {visaStatusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {getStatusEmoji(opt)} {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>💼 Position</label>
            <input
              type="text"
              name="position"
              value={visaForm.position}
              onChange={handleVisaFormChange}
              placeholder="Job position"
              style={{
                backgroundColor: autoFillData?.position ? 'rgba(var(--primary-rgb), 0.05)' : undefined,
              }}
            />
          </div>

          <div className="form-field">
            <label>🛂 Passport Number</label>
            <input
              type="text"
              name="passport_number"
              value={visaForm.passport_number}
              onChange={handleVisaFormChange}
              placeholder="Passport number"
              style={{
                backgroundColor: autoFillData?.passport_number ? 'rgba(var(--primary-rgb), 0.05)' : undefined,
              }}
            />
          </div>

          <div className="form-field">
            <label>✈️ Travel Date</label>
            <input
              type="date"
              name="travel_date"
              value={visaForm.travel_date}
              onChange={handleVisaFormChange}
            />
          </div>

          <div className="form-field">
            <label>👤 Contact Type</label>
            <select name="contact_type" value={visaForm.contact_type} onChange={handleVisaFormChange}>
              <option value="Direct Candidate">📱 Direct Candidate</option>
              <option value="Agency">🏢 Agency</option>
              <option value="Referral">🤝 Referral</option>
            </select>
          </div>

          <div className="form-field">
            <label>📞 Agent Contact</label>
            <input
              type="text"
              name="agent_contact"
              value={visaForm.agent_contact}
              onChange={handleVisaFormChange}
              placeholder="Agent name or contact details"
              className="compact-input"
            />
          </div>

          <div className="form-field full-width">
            <label>📝 Notes</label>
            <textarea
              name="notes"
              value={visaForm.notes}
              onChange={handleVisaFormChange}
              placeholder="Additional notes or comments..."
              rows={2}
              className="compact-textarea"
            />
          </div>

          <button type="submit" disabled={isSavingVisa} className="btn-full-width">
            <FiPlus /> {isSavingVisa ? '⏳ Adding...' : '✨ Add Visa Entry'}
          </button>
        </form>
      </div>

      {/* 📋 Visa Tracking History */}
      <div className="visa-list-container">
        <h3>
          <FiPackage /> 📋 Visa Tracking History
        </h3>
        <div className="visa-list">
          {visaEntries.length === 0 ? (
            <div className="empty-state">
              <FiInfo size={48} />
              <p>ℹ️ No visa tracking entries found.</p>
            </div>
          ) : (
            visaEntries.map((entry) => {
              const isEditing = editingId === entry.id;

              return (
                <div key={entry.id} className={`module-list-item ${isEditing ? 'editing-mode' : ''}`}>
                  {isEditing ? (
                    // 🎯 INLINE EDIT MODE
                    <div className="inline-edit-container">
                      <div className="edit-form-grid">
                        <div className="edit-field">
                          <label>🌍 Country *</label>
                          <input
                            type="text"
                            name="country"
                            value={editForm.country}
                            onChange={handleEditFormChange}
                            className="edit-input"
                            required
                          />
                        </div>

                        <div className="edit-field">
                          <label>📄 Visa Type</label>
                          <input
                            type="text"
                            name="visa_type"
                            value={editForm.visa_type}
                            onChange={handleEditFormChange}
                            className="edit-input"
                          />
                        </div>

                        <div className="edit-field">
                          <label>📅 Application Date *</label>
                          <input
                            type="date"
                            name="application_date"
                            value={editForm.application_date}
                            onChange={handleEditFormChange}
                            className="edit-input"
                            required
                          />
                        </div>

                        <div className="edit-field">
                          <label>📊 Status</label>
                          <select
                            name="status"
                            value={editForm.status}
                            onChange={handleEditFormChange}
                            className="edit-input"
                          >
                            {visaStatusOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {getStatusEmoji(opt)} {opt}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="edit-field">
                          <label>💼 Position</label>
                          <input
                            type="text"
                            name="position"
                            value={editForm.position}
                            onChange={handleEditFormChange}
                            className="edit-input"
                          />
                        </div>

                        <div className="edit-field">
                          <label>🛂 Passport Number</label>
                          <input
                            type="text"
                            name="passport_number"
                            value={editForm.passport_number}
                            onChange={handleEditFormChange}
                            className="edit-input"
                          />
                        </div>

                        <div className="edit-field">
                          <label>✈️ Travel Date</label>
                          <input
                            type="date"
                            name="travel_date"
                            value={editForm.travel_date}
                            onChange={handleEditFormChange}
                            className="edit-input"
                          />
                        </div>

                        <div className="edit-field">
                          <label>👤 Contact Type</label>
                          <select
                            name="contact_type"
                            value={editForm.contact_type}
                            onChange={handleEditFormChange}
                            className="edit-input"
                          >
                            <option value="Direct Candidate">📱 Direct Candidate</option>
                            <option value="Agency">🏢 Agency</option>
                            <option value="Referral">🤝 Referral</option>
                          </select>
                        </div>

                        <div className="edit-field">
                          <label>📞 Agent Contact</label>
                          <input
                            type="text"
                            name="agent_contact"
                            value={editForm.agent_contact}
                            onChange={handleEditFormChange}
                            className="edit-input compact-input"
                          />
                        </div>

                        <div className="edit-field">
                          <label>📝 Notes</label>
                          <textarea
                            name="notes"
                            value={editForm.notes}
                            onChange={handleEditFormChange}
                            className="edit-input compact-textarea"
                            rows={2}
                          />
                        </div>
                      </div>

                      <div className="edit-actions">
                        <button
                          className="btn-save"
                          onClick={() => saveEdit(entry.id)}
                          disabled={isSavingVisa}
                        >
                          <FiCheck /> {isSavingVisa ? '⏳ Saving...' : '💾 Save Changes'}
                        </button>
                        <button className="btn-cancel" onClick={cancelEdit}>
                          <FiX /> ❌ Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // 🎯 DISPLAY MODE
                    <>
                      <div className="item-icon">
                        <FiGlobe />
                      </div>
                      <div className="item-details">
                        <strong>
                          🌍 {entry.country} {entry.visa_type && `• 📄 ${entry.visa_type}`}
                        </strong>
                        <p>
                          📅 Applied: {new Date(entry.application_date).toLocaleDateString()} 
                          {entry.travel_date && ` • ✈️ Travel: ${new Date(entry.travel_date).toLocaleDateString()}`}
                        </p>
                        <p>
                          💼 Position: {entry.position || 'N/A'} | 🛂 Passport: {entry.passport_number || 'N/A'}
                        </p>
                        {entry.agent_contact && (
                          <p style={{ color: 'var(--primary-color)', fontWeight: '600' }}>
                            📞 Agent: {entry.agent_contact}
                          </p>
                        )}
                        {entry.notes && (
                          <p>
                            <small>📝 Notes: {entry.notes}</small>
                          </p>
                        )}
                      </div>
                      <div className="item-status">
                        <span className={`status-badge ${getStatusBadgeClass(entry.status)}`}>
                          {getStatusEmoji(entry.status)} {entry.status}
                        </span>
                      </div>
                      <div className="item-actions">
                        <button onClick={() => startEdit(entry)} title="Edit Entry">
                          <FiEdit2 />
                        </button>
                        <button onClick={() => handleDeleteVisaEntry(entry.id)} title="Delete Entry">
                          <FiTrash2 />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 🎯 Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, visaId: null })}
        onConfirm={confirmDelete}
        title="🗑️ Delete Visa Entry"
        message="Are you sure you want to move this visa entry to the Recycle Bin? You can restore it later if needed."
        confirmText="Yes, Delete"
        type="danger"
      />
    </div>
  );
}

export default CandidateVisa;
