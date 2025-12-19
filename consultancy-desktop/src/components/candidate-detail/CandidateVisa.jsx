import React, { useState, useEffect, useCallback } from 'react';
import { FiPackage, FiTrash2, FiPlus, FiEdit2, FiUser } from 'react-icons/fi';
import toast from 'react-hot-toast';
import VisaEditModal from '../modals/VisaEditModal';
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
  const [editingVisa, setEditingVisa] = useState(null);
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
        const activeJob = jobPlacementsRes.data.find((j) => j.placementStatus === 'Assigned') || jobPlacementsRes.data[0];
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

  const handleUpdateVisa = (updatedVisaData) => {
    setVisaEntries((prev) => prev.map((v) => (v.id === updatedVisaData.id ? updatedVisaData : v)));
    setEditingVisa(null);
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

  if (loading) return <div className="loading">⏳ Loading visa tracking...</div>;

  return (
    <div className="visa-tracking-content">
      <div className="visa-module-wrapper">
        {/* ✅ Add New Visa Entry Form */}
        <div className="detail-card">
          <h3>
            <FiPlus /> Add New Visa Entry
          </h3>
          <form className="visa-form form-grid" onSubmit={handleAddVisaEntry}>
            {/* Position Field */}
            <div className="form-group">
              <label>
                <FiUser /> Position
              </label>
              <input
                type="text"
                name="position"
                value={visaForm.position}
                onChange={handleVisaFormChange}
                placeholder="e.g., Welder, Electrician"
                disabled={isLoadingAutoFill}
                style={{
                  backgroundColor: autoFillData?.position ? 'rgba(var(--primary-rgb), 0.05)' : '',
                }}
              />
            </div>

            {/* Country Field */}
            <div className="form-group">
              <label>🌍 Country</label>
              <input
                type="text"
                name="country"
                value={visaForm.country}
                onChange={handleVisaFormChange}
                placeholder="e.g., Qatar, UAE"
                required
                disabled={isLoadingAutoFill}
                style={{
                  backgroundColor: autoFillData?.country ? 'rgba(var(--primary-rgb), 0.05)' : '',
                }}
              />
            </div>

            {/* Passport Number Field */}
            <div className="form-group">
              <label>🛂 Passport Number</label>
              <input
                type="text"
                name="passport_number"
                value={visaForm.passport_number}
                onChange={handleVisaFormChange}
                placeholder="M1234567"
                disabled={isLoadingAutoFill}
                style={{
                  backgroundColor: autoFillData?.passport_number ? 'rgba(var(--primary-rgb), 0.05)' : '',
                }}
              />
            </div>

            {/* Travel Date Field */}
            <div className="form-group">
              <label>🗓️ Travel Date</label>
              <input type="date" name="travel_date" value={visaForm.travel_date} onChange={handleVisaFormChange} />
            </div>

            {/* Application Date Field */}
            <div className="form-group">
              <label>📅 Application Date</label>
              <input
                type="date"
                name="application_date"
                value={visaForm.application_date}
                onChange={handleVisaFormChange}
                required
              />
            </div>

            {/* Visa Type Field */}
            <div className="form-group">
              <label>🛂 Visa Type</label>
              <input
                type="text"
                name="visa_type"
                value={visaForm.visa_type}
                onChange={handleVisaFormChange}
                placeholder="e.g., Work, Visit"
              />
            </div>

            {/* Contact Type Field */}
            <div className="form-group">
              <label>
                <FiUser /> Contact Type
              </label>
              <select name="contact_type" value={visaForm.contact_type} onChange={handleVisaFormChange}>
                <option value="Direct Candidate">👤 Direct Candidate</option>
                <option value="Through Agency">🏢 Through Agency</option>
                <option value="Through Referral">🤝 Through Referral</option>
              </select>
            </div>

            {/* Status Field */}
            <div className="form-group">
              <label>📊 Status</label>
              <select name="status" value={visaForm.status} onChange={handleVisaFormChange}>
                {visaStatusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Agent Contact Field */}
            {visaForm.contact_type !== 'Direct Candidate' && (
              <div className="form-group full-width">
                <label>
                  <FiUser /> Agent Contact
                </label>
                <input
                  type="text"
                  name="agent_contact"
                  value={visaForm.agent_contact}
                  onChange={handleVisaFormChange}
                  placeholder="Agent name, phone, or email"
                  style={{ borderColor: 'var(--primary-color)' }}
                />
              </div>
            )}

            {/* Notes Field */}
            <div className="form-group full-width">
              <label>📝 Notes</label>
              <textarea
                name="notes"
                value={visaForm.notes}
                onChange={handleVisaFormChange}
                placeholder="Additional notes..."
                rows="3"
              />
            </div>

            <button type="submit" className="btn-full-width" disabled={isSavingVisa}>
              <FiPlus /> {isSavingVisa ? 'Adding...' : 'Add Visa Entry'}
            </button>
          </form>
        </div>

        {/* ✅ Visa Tracking History */}
        <div className="visa-list-container">
          <h3>
            <FiPackage /> Visa Tracking History ({visaEntries.length})
          </h3>
          {visaEntries.length === 0 ? (
            <p className="empty-state">ℹ️ No visa tracking entries found.</p>
          ) : (
            <div className="visa-list">
              {visaEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`visa-entry-card ${
                    entry.contact_type === 'Direct Candidate'
                      ? 'direct'
                      : entry.contact_type === 'Through Agency'
                      ? 'agency'
                      : 'referral'
                  }`}
                >
                  <div className="visa-entry-header">
                    <div className="visa-entry-info">
                      <h4>
                        🌍 {entry.country} - {entry.visa_type || 'Work Visa'}
                      </h4>
                      <p className="visa-entry-meta">
                        <span>📅 Applied: {entry.application_date}</span>
                        {entry.travel_date && <span>✈️ Travel: {entry.travel_date}</span>}
                      </p>
                    </div>
                    <div className="visa-entry-actions">
                      <span className={`status-badge ${getStatusBadgeClass(entry.status)}`}>{entry.status}</span>
                      <button onClick={() => setEditingVisa(entry)} className="btn-icon" title="Edit">
                        <FiEdit2 />
                      </button>
                      <button
                        onClick={() => handleDeleteVisaEntry(entry.id)}
                        className="btn-icon btn-danger"
                        title="Delete"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>

                  <div className="visa-entry-details">
                    <p>
                      💼 Position: {entry.position || 'N/A'} | 🛂 Passport: {entry.passport_number || 'N/A'}
                    </p>
                    <p>
                      <FiUser style={{ marginRight: '4px' }} />
                      Contact: {entry.contact_type}
                      {entry.agent_contact && (
                        <span style={{ color: 'var(--primary-color)', marginLeft: '8px' }}>({entry.agent_contact})</span>
                      )}
                    </p>
                    {entry.notes && <p>📝 Notes: {entry.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingVisa && (
        <VisaEditModal
          user={user}
          visa={editingVisa}
          onClose={() => setEditingVisa(null)}
          onUpdate={handleUpdateVisa}
        />
      )}
    </div>
  );
}

export default CandidateVisa;
