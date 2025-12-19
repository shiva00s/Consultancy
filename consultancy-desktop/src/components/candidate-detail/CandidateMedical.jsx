import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiPlus, FiTrash2, FiFileText, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { readFileAsBuffer } from '../../utils/file';
import toast from 'react-hot-toast';
import '../../css/CandidateMedical.css';
import ConfirmDialog from '../common/ConfirmDialog';

const medicalStatusOptions = ['Pending', 'Fit', 'Unfit', 'Cancelled'];

const initialMedicalForm = {
  test_date: '',
  certificate_file: null,
  status: 'Pending',
  notes: '',
};

function CandidateMedical({ user, candidateId, candidateName }) {
  const [medicalEntries, setMedicalEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [medicalForm, setMedicalForm] = useState(initialMedicalForm);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  const fileInputRef = useRef(null);
  const editFileInputRefs = useRef({});

  const fetchMedicalTracking = useCallback(async () => {
    setLoading(true);
    const res = await window.electronAPI.getMedicalTracking({ candidateId });
    if (res.success) setMedicalEntries(res.data || []);
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
    setMedicalForm((prev) => ({
      ...prev,
      certificate_file: e.target.files[0] || null,
    }));
  };

  // === INLINE EDIT HANDLERS ===
  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditForm({
      test_date: entry.test_date,
      status: entry.status,
      notes: entry.notes || '',
      certificate_file: null,
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

  const handleEditFileChange = (entryId, e) => {
    setEditForm((prev) => ({
      ...prev,
      certificate_file: e.target.files[0] || null,
    }));
  };

  const saveEdit = async (entryId) => {
    if (!editForm.test_date) {
      toast.error('⚠️ Test Date is required.');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('⏳ Updating medical entry...');

    try {
      let certificate_path = '';

      if (editForm.certificate_file) {
        toast.loading('📤 Uploading new certificate...', { id: toastId });
        const buffer = await readFileAsBuffer(editForm.certificate_file);
        const fileData = {
          name: editForm.certificate_file.name,
          type: editForm.certificate_file.type,
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
          throw new Error(docRes.error || 'Failed to upload certificate file.');
        }
      }

      const updateData = {
        test_date: editForm.test_date,
        status: editForm.status,
        notes: editForm.notes,
        ...(certificate_path && { certificate_path }),
      };

      const res = await window.electronAPI.updateMedicalEntry({
        user,
        id: entryId,
        data: updateData,
      });

      if (res.success) {
        setMedicalEntries((prev) =>
          prev.map((m) => (m.id === entryId ? res.data : m))
        );
        setEditingId(null);
        setEditForm({});
        toast.success('✅ Medical entry updated successfully!', { id: toastId });
      } else {
        toast.error('❌ ' + (res.error || 'Failed to update medical entry'), {
          id: toastId,
        });
      }
    } catch (err) {
      console.error('updateMedicalEntry error:', err);
      toast.error(`❌ Error: ${err.message}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!medicalForm.test_date) {
      toast.error('⚠️ Test Date is required.');
      return;
    }

    setIsSaving(true);
    let toastId = toast.loading('⏳ Saving medical entry...');

    try {
      let certificate_path = '';

      if (medicalForm.certificate_file) {
        toast.loading('📤 Uploading certificate...', { id: toastId });
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
          throw new Error(docRes.error || 'Failed to upload certificate file.');
        }
      }

      const data = {
        ...medicalForm,
        candidate_id: candidateId,
        certificate_path: certificate_path,
      };

      const res = await window.electronAPI.addMedicalEntry({ user, data });

      if (res.success) {
        setMedicalEntries((prev) => [res.data, ...prev]);
        setMedicalForm(initialMedicalForm);
        if (fileInputRef.current) fileInputRef.current.value = null;
        toast.success('✅ Medical entry saved successfully!', { id: toastId });

        try {
          await window.electronAPI.createReminder({
            userId: user.id,
            candidateId,
            module: 'medical',
            title: '🏥 Medical test scheduled',
            message: `${candidateName || 'Candidate'} medical test on ${medicalForm.test_date}`,
            remindAt: new Date(medicalForm.test_date).toISOString(),
          });
        } catch (err) {
          console.error('createReminder (medical) failed:', err);
        }
      } else {
        toast.error('❌ ' + (res.error || 'Failed to save medical entry'), {
          id: toastId,
        });
      }
    } catch (err) {
      console.error('addMedicalEntry error:', err);
      toast.error(`❌ Error: ${err.message}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEntry = (id, test_date) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Medical Entry',
      message: `Are you sure you want to move the medical entry from ${test_date} to the Recycle Bin?`,
      onConfirm: async () => {
        const res = await window.electronAPI.deleteMedicalEntry({ user, id });
        if (res.success) {
          setMedicalEntries((prev) => prev.filter((e) => e.id !== id));
          toast.success('✅ Medical entry moved to Recycle Bin.');
        } else {
          toast.error('❌ ' + (res.error || 'Failed to delete medical entry'));
        }
      },
    });
  };

  const openFile = async (certificatePath) => {
    if (!certificatePath) {
      toast.error('❌ No certificate file available.');
      return;
    }

    try {
      await window.electronAPI.openFileExternally({ path: certificatePath });
    } catch (err) {
      console.error('Error opening file:', err);
      toast.error('❌ Failed to open certificate file.');
    }
  };

  // FORMAT DATE FUNCTION
  const formatDate = (dateString) => {
    if (!dateString) return 'Invalid Date';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Fit':
        return 'badge-green';
      case 'Unfit':
        return 'badge-red';
      case 'Pending':
        return 'badge-yellow';
      case 'Cancelled':
        return 'badge-grey';
      default:
        return 'badge-grey';
    }
  };

  if (loading)
    return (
      <div className="loading">
        <p>⏳ Loading medical tracking...</p>
      </div>
    );

  return (
    <div className="medical-tracking-content">
      {/* Add Medical Form */}
      <div className="form-container">
        <h3>
          <FiPlus /> Add New Medical Entry
        </h3>
        <form onSubmit={handleAddEntry}>
          <div className="form-row">
            <div className="form-group">
              <label>Test Date *</label>
              <input
                type="date"
                name="test_date"
                value={medicalForm.test_date}
                onChange={handleFormChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                name="status"
                value={medicalForm.status}
                onChange={handleFormChange}
              >
                {medicalStatusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
  <label>Medical Certificate (Optional)</label>
  <div className="file-input-wrapper">
    <input
      ref={fileInputRef}
      type="file"
      id="certificate_file"
      accept=".pdf,.jpg,.jpeg,.png"
      onChange={handleFileChange}
    />
    <label htmlFor="certificate_file" className="file-input-label">
      <FiFileText />
      Choose File
    </label>
    {medicalForm.certificate_file && (
      <div className="file-name-display">
        <FiFileText />
        <span className="file-name-text">
          {medicalForm.certificate_file.name}
        </span>
      </div>
    )}
  </div>
</div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              name="notes"
              value={medicalForm.notes}
              onChange={handleFormChange}
              placeholder="Add any additional notes..."
              rows="3"
            />
          </div>

          <button type="submit" className="btn-full-width" disabled={isSaving}>
            <FiPlus /> {isSaving ? 'Saving...' : 'Add Medical Entry'}
          </button>
        </form>
      </div>

      {/* Medical History List */}
      <div className="list-container">
        <h3>
          <FiFileText /> Medical History
        </h3>
        <div className="medical-list">
          {medicalEntries.length === 0 ? (
            <div className="empty-state">ℹ️ No medical records found.</div>
          ) : (
            medicalEntries.map((entry) => {
              const isEditing = editingId === entry.id;

              return (
                <div
                  key={entry.id}
                  className={`medical-item ${isEditing ? 'editing-mode' : ''}`}
                >
                  <div className="item-icon">
                    <FiFileText />
                  </div>

                  <div className="item-details">
                    {isEditing ? (
                      // === INLINE EDIT MODE ===
                      <div className="inline-edit-container">
                        <div className="edit-form-grid">
                          <div className="edit-field">
                            <label>Test Date *</label>
                            <input
                              type="date"
                              name="test_date"
                              value={editForm.test_date}
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
                              {medicalStatusOptions.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="edit-field edit-field-full">
  <label>Upload New Certificate (optional)</label>
  <div className="file-input-wrapper">
    <input
      type="file"
      id={`edit_certificate_${entry.id}`}
      ref={(el) => (editFileInputRefs.current[entry.id] = el)}
      onChange={(e) => handleEditFileChange(entry.id, e)}
      accept=".pdf,.jpg,.jpeg,.png"
      style={{ display: 'none' }}
    />
    <label htmlFor={`edit_certificate_${entry.id}`} className="file-input-label">
      <FiFileText />
      Choose New Certificate
    </label>
    {editForm.certificate_file && (
      <div className="file-name-display">
        <FiFileText />
        <span className="file-name-text">
          {editForm.certificate_file.name}
        </span>
      </div>
    )}
  </div>
</div>


                          <div className="edit-field edit-field-full">
                            <label>Notes</label>
                            <textarea
                              name="notes"
                              value={editForm.notes}
                              onChange={handleEditFormChange}
                              className="edit-input"
                              rows="2"
                              placeholder="Additional notes..."
                            />
                          </div>
                        </div>

                        <div className="edit-actions">
                          <button
                            onClick={() => saveEdit(entry.id)}
                            className="btn-save"
                            disabled={isSaving}
                          >
                            <FiCheck /> Save
                          </button>
                          <button onClick={cancelEdit} className="btn-cancel">
                            <FiX /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // === VIEW MODE ===
                      <>
                        <strong>Medical Certificate - {formatDate(entry.test_date)}</strong>
                        <p>
                          📄{' '}
                          {entry.certificate_path ? (
                            <span
                              onClick={() => openFile(entry.certificate_path)}
                              style={{
                                cursor: 'pointer',
                                color: '#4CAF50',
                                textDecoration: 'underline',
                                fontWeight: 600,
                              }}
                            >
                              View Certificate
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>
                              No certificate uploaded
                            </span>
                          )}
                        </p>
                        {entry.notes && (
                          <small>
                            <span role="img" aria-label="notes">
                              📝
                            </span>{' '}
                            Notes: {entry.notes}
                          </small>
                        )}
                      </>
                    )}
                  </div>

                  {!isEditing && (
                    <>
                      <div className="item-status">
                        <span
                          className={`status-badge ${getStatusBadgeClass(entry.status)}`}
                        >
                          {entry.status}
                        </span>
                      </div>

                      <div className="item-actions">
                        <button onClick={() => startEdit(entry)} title="Edit">
                          <FiEdit2 />
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id, formatDate(entry.test_date))}
                          title="Delete"
                        >
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

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  );
}

export default CandidateMedical;
