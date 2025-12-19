import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiPackage, FiTrash2, FiPlus, FiEdit2, FiUser, FiCheck, FiX } from 'react-icons/fi';
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

function CandidateVisa({ user, candidateId }) {
  const [visaEntries, setVisaEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visaForm, setVisaForm] = useState(initialVisaForm);
  const [isSavingVisa, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null); // Track which entry is being edited
  const [editForm, setEditForm] = useState({}); // Form data for editing
  const [autoFillData, setAutoFillData] = useState(null);
  const [isLoadingAutoFill, setIsLoadingAutoFill] = useState(false);

  // Fetch auto-fill data from candidate profile and job placements
  const fetchAutoFillData = useCallback(async () => {
    setIsLoadingAutoFill(true);
    try {
      // Get candidate profile data
      const candidateRes = await window.electronAPI.getCandidateById({ candidateId });
      if (!candidateRes.success) {
        console.error('Failed to fetch candidate data:', candidateRes.error);
        setIsLoadingAutoFill(false);
        return;
      }
      const candidateData = candidateRes.data;

      // Get active job placements for this candidate
      const jobPlacementsRes = await window.electronAPI.getCandidateJobPlacements({ candidateId });
      let jobData = null;
      if (jobPlacementsRes.success && jobPlacementsRes.data?.length > 0) {
        // Get the most recent active job placement
        const activeJob =
          jobPlacementsRes.data.find((j) => j.placementStatus === 'Assigned') ||
          jobPlacementsRes.data[0];
        if (activeJob && activeJob.jobId) {
          // Get detailed job order information
          const jobOrderRes = await window.electronAPI.getJobOrderById({ jobId: activeJob.jobId });
          if (jobOrderRes.success) {
            jobData = jobOrderRes.data;
          }
        }
      }

      // Prepare combined position field (Profile + Job Position)
      const profilePosition = candidateData.position_applying_for || '';
      const jobPosition = jobData?.positionTitle || '';
      let positionCombined = '';
      if (profilePosition && jobPosition) {
        positionCombined = `${profilePosition}, ${jobPosition}`;
      } else {
        positionCombined = profilePosition || jobPosition || '';
      }

      // Set auto-fill data
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

  // Fetch auto-fill data on component mount
  useEffect(() => {
    fetchAutoFillData();
  }, [fetchAutoFillData]);

  // Auto-fill form when autoFillData is loaded
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

  // === INLINE EDIT HANDLERS ===
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
        // Reset form but keep auto-filled data
        setVisaForm({
          ...initialVisaForm,
          position: autoFillData?.position || '',
          country: autoFillData?.country || '',
          passport_number: autoFillData?.passport_number || '',
        });
        toast.success('✅ Visa entry added successfully.', { id: toastId });
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
    if (window.confirm('⚠️ Are you sure you want to move this visa entry to the Recycle Bin?')) {
      const res = await window.electronAPI.deleteVisaEntry({ user, id: visaId });
      if (res.success) {
        setVisaEntries((prev) => prev.filter((v) => v.id !== visaId));
        toast.success('✅ Visa entry moved to Recycle Bin.');
      } else {
        toast.error('❌ ' + res.error);
      }
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Approved':
        return 'badge-green';
      case 'Rejected':
        return 'badge-red';
      case 'Cancelled':
        return 'badge-grey';
      case 'Submitted':
        return 'badge-cyan';
      case 'In Progress':
        return 'badge-blue';
      default:
        return 'badge-yellow';
    }
  };

  if (loading)
    return (
      <div className="visa-tracking-content">
        <p>⏳ Loading visa tracking...</p>
      </div>
    );

  return (
    <div className="visa-tracking-content">
      {/* Add Visa Entry Form */}
      <div className="detail-card visa-form-container">
        <h3>
          <FiPlus /> Add New Visa Entry
        </h3>
        <form onSubmit={handleAddVisaEntry} className="visa-form form-grid">
          <div className="form-group">
            <label htmlFor="country">Country *</label>
            <input
              type="text"
              id="country"
              name="country"
              value={visaForm.country}
              onChange={handleVisaFormChange}
              placeholder="e.g., Saudi Arabia"
              style={
                autoFillData?.country
                  ? { background: 'rgba(var(--primary-rgb), 0.08)' }
                  : {}
              }
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="visa_type">Visa Type</label>
            <input
              type="text"
              id="visa_type"
              name="visa_type"
              value={visaForm.visa_type}
              onChange={handleVisaFormChange}
              placeholder="e.g., Work Visa"
            />
          </div>
          <div className="form-group">
            <label htmlFor="application_date">Application Date *</label>
            <input
              type="date"
              id="application_date"
              name="application_date"
              value={visaForm.application_date}
              onChange={handleVisaFormChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="travel_date">Travel Date</label>
            <input
              type="date"
              id="travel_date"
              name="travel_date"
              value={visaForm.travel_date}
              onChange={handleVisaFormChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              name="status"
              value={visaForm.status}
              onChange={handleVisaFormChange}
            >
              {visaStatusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="position">Position</label>
            <input
              type="text"
              id="position"
              name="position"
              value={visaForm.position}
              onChange={handleVisaFormChange}
              placeholder="e.g., Software Engineer"
              style={
                autoFillData?.position
                  ? { background: 'rgba(var(--primary-rgb), 0.08)' }
                  : {}
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="passport_number">Passport Number</label>
            <input
              type="text"
              id="passport_number"
              name="passport_number"
              value={visaForm.passport_number}
              onChange={handleVisaFormChange}
              placeholder="e.g., P1234567"
              style={
                autoFillData?.passport_number
                  ? { background: 'rgba(var(--primary-rgb), 0.08)' }
                  : {}
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="contact_type">Contact Type</label>
            <select
              id="contact_type"
              name="contact_type"
              value={visaForm.contact_type}
              onChange={handleVisaFormChange}
            >
              <option value="Direct Candidate">Direct Candidate</option>
              <option value="Agency">Agency</option>
              <option value="Referral">Referral</option>
            </select>
          </div>
          <div className="form-group form-group-full">
            <label htmlFor="agent_contact">Agent Contact</label>
            <input
              type="text"
              id="agent_contact"
              name="agent_contact"
              value={visaForm.agent_contact}
              onChange={handleVisaFormChange}
              placeholder="Agent name/contact info"
            />
          </div>
          <div className="form-group form-group-full">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={visaForm.notes}
              onChange={handleVisaFormChange}
              rows="2"
              placeholder="Additional notes..."
            />
          </div>
          <button
            type="submit"
            className="btn-full-width"
            disabled={isSavingVisa}
            style={{ gridColumn: '1 / -1' }}
          >
            {isSavingVisa ? '⏳ Saving...' : <><FiPlus /> Add Visa Entry</>}
          </button>
        </form>
      </div>

      {/* Visa Tracking History */}
      <div className="visa-list-container">
        <h3>
          <FiPackage /> Visa Tracking History
        </h3>
        <div className="visa-list">
          {visaEntries.length === 0 ? (
            <p className="empty-state">ℹ️ No visa tracking entries found.</p>
          ) : (
            visaEntries.map((entry) => {
              const isEditing = editingId === entry.id;

              return (
                <div
                  key={entry.id}
                  className={`module-list-item ${isEditing ? 'editing-mode' : ''}`}
                >
                  {!isEditing ? (
                    // VIEW MODE
                    <>
                      <div className="item-icon">
                        <FiPackage />
                      </div>
                      <div className="item-details">
                        <strong>
                          {entry.country} - {entry.visa_type || 'Visa'}
                        </strong>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          <span>📅 Applied: {entry.application_date}</span>
                          {entry.travel_date && <span>✈️ Travel: {entry.travel_date}</span>}
                        </div>
                        <p>
                          💼 Position: {entry.position || 'N/A'} | 🛂 Passport:{' '}
                          {entry.passport_number || 'N/A'}
                        </p>
                        {entry.agent_contact && (
                          <p style={{ color: 'var(--primary-color)' }}>
                            <FiUser /> Agent: {entry.agent_contact}
                          </p>
                        )}
                        {entry.notes && <p>📝 Notes: {entry.notes}</p>}
                      </div>
                      <div className="item-status">
                        <span className={`status-badge ${getStatusBadgeClass(entry.status)}`}>
                          {entry.status}
                        </span>
                      </div>
                      <div className="item-actions">
                        <button onClick={() => startEdit(entry)} title="Edit Entry">
                          <FiEdit2 />
                        </button>
                        <button
                          onClick={() => handleDeleteVisaEntry(entry.id)}
                          title="Delete Entry"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </>
                  ) : (
                    // EDIT MODE
                    <div className="inline-edit-container">
                      <div className="edit-form-grid">
                        <div className="edit-field">
                          <label>Country *</label>
                          <input
                            type="text"
                            name="country"
                            value={editForm.country}
                            onChange={handleEditFormChange}
                            className="edit-input"
                            placeholder="e.g., Saudi Arabia"
                          />
                        </div>
                        <div className="edit-field">
                          <label>Visa Type</label>
                          <input
                            type="text"
                            name="visa_type"
                            value={editForm.visa_type}
                            onChange={handleEditFormChange}
                            className="edit-input"
                            placeholder="e.g., Work Visa"
                          />
                        </div>
                        <div className="edit-field">
                          <label>Application Date *</label>
                          <input
                            type="date"
                            name="application_date"
                            value={editForm.application_date}
                            onChange={handleEditFormChange}
                            className="edit-input"
                          />
                        </div>
                        <div className="edit-field">
                          <label>Travel Date</label>
                          <input
                            type="date"
                            name="travel_date"
                            value={editForm.travel_date}
                            onChange={handleEditFormChange}
                            className="edit-input"
                          />
                        </div>
                        <div className="edit-field">
                          <label>Status</label>
                          <select
                            name="status"
                            value={editForm.status}
                            onChange={handleEditFormChange}
                            className="edit-input"
                          >
                            {visaStatusOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="edit-field">
                          <label>Position</label>
                          <input
                            type="text"
                            name="position"
                            value={editForm.position}
                            onChange={handleEditFormChange}
                            className="edit-input"
                            placeholder="e.g., Software Engineer"
                          />
                        </div>
                        <div className="edit-field">
                          <label>Passport Number</label>
                          <input
                            type="text"
                            name="passport_number"
                            value={editForm.passport_number}
                            onChange={handleEditFormChange}
                            className="edit-input"
                            placeholder="e.g., P1234567"
                          />
                        </div>
                        <div className="edit-field">
                          <label>Contact Type</label>
                          <select
                            name="contact_type"
                            value={editForm.contact_type}
                            onChange={handleEditFormChange}
                            className="edit-input"
                          >
                            <option value="Direct Candidate">Direct Candidate</option>
                            <option value="Agency">Agency</option>
                            <option value="Referral">Referral</option>
                          </select>
                        </div>
                        <div className="edit-field edit-field-full">
                          <label>Agent Contact</label>
                          <input
                            type="text"
                            name="agent_contact"
                            value={editForm.agent_contact}
                            onChange={handleEditFormChange}
                            className="edit-input"
                            placeholder="Agent name/contact info"
                          />
                        </div>
                        <div className="edit-field edit-field-full">
                          <label>Notes</label>
                          <textarea
                            name="notes"
                            value={editForm.notes}
                            onChange={handleEditFormChange}
                            className="edit-input"
                            rows="3"
                            placeholder="Additional notes..."
                          />
                        </div>
                      </div>
                      <div className="edit-actions">
                        <button
                          onClick={() => saveEdit(entry.id)}
                          className="btn-save"
                          disabled={isSavingVisa}
                        >
                          <FiCheck /> {isSavingVisa ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="btn-cancel"
                          disabled={isSavingVisa}
                        >
                          <FiX /> Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default CandidateVisa;
