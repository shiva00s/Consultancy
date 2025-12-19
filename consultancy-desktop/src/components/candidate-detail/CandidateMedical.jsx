import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiPlus, FiTrash2, FiFileText, FiDownload, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { readFileAsBuffer } from '../../utils/file';
import toast from 'react-hot-toast';
import '../../css/CandidateMedical.css';

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
  const [editingId, setEditingId] = useState(null); // Track which entry is being edited
  const [editForm, setEditForm] = useState({}); // Form data for editing
  
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
      certificate_file: null, // Don't include existing file
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
      
      // If a new file is selected, upload it
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

  const handleDeleteEntry = async (id, test_date) => {
    if (
      window.confirm(
        `⚠️ Are you sure you want to move the medical entry from ${test_date} to the Recycle Bin?`
      )
    ) {
      const res = await window.electronAPI.deleteMedicalEntry({ user, id });
      if (res.success) {
        setMedicalEntries((prev) => prev.filter((e) => e.id !== id));
        toast.success('✅ Medical entry moved to Recycle Bin.');
      } else {
        toast.error('❌ ' + (res.error || 'Failed to delete medical entry'));
      }
    }
  };

  const openFile = async (documentId) => {
    const res = await window.electronAPI.getSecureFilePath({ documentId });
    if (res.success) {
      window.electronAPI.openFileExternally({ path: res.filePath });
    } else {
      toast.error('❌ ' + (res.error || 'File path lookup failed.'));
    }
  };

  if (loading)
    return (
      <div className="medical-tracking-content">
        <p>⏳ Loading medical tracking...</p>
      </div>
    );

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Fit':
        return 'badge-green';
      case 'Unfit':
        return 'badge-red';
      case 'Cancelled':
        return 'badge-grey';
      case 'Pending':
      default:
        return 'badge-yellow';
    }
  };

  return (
    <div className="medical-tracking-content">
      {/* Add Form */}
      <div className="form-container">
        <h3>
          <FiPlus /> Add Medical Entry
        </h3>
        <form onSubmit={handleAddEntry} className="medical-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="test_date">Test Date *</label>
              <input
                type="date"
                id="test_date"
                name="test_date"
                value={medicalForm.test_date}
                onChange={handleFormChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={medicalForm.status}
                onChange={handleFormChange}
              >
                {medicalStatusOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={medicalForm.notes}
              onChange={handleFormChange}
              rows="2"
              placeholder="Optional notes..."
            />
          </div>
          <div className="form-group">
            <label htmlFor="certificate_file">Upload Certificate</label>
            <div className="custom-file-input">
              <label htmlFor="certificate_file" className="file-input-label">
                <FiFileText /> Choose File
              </label>
              <input
                type="file"
                id="certificate_file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png"
              />
              {medicalForm.certificate_file && (
                <span className="file-name-display">
                  {medicalForm.certificate_file.name}
                </span>
              )}
            </div>
          </div>
          <button
            type="submit"
            className="btn-full-width"
            disabled={isSaving}
          >
            {isSaving ? '⏳ Saving...' : <><FiPlus /> Add Medical Entry</>}
          </button>
        </form>
      </div>

      {/* Medical List */}
      <div className="list-container">
        <h3>
          <FiFileText /> Medical Records
        </h3>
        <div className="medical-list">
          {medicalEntries.length === 0 ? (
            <p className="empty-state">ℹ️ No medical records found.</p>
          ) : (
            medicalEntries.map((entry) => {
              const isEditing = editingId === entry.id;
              
              return (
                <div key={entry.id} className={`medical-item ${isEditing ? 'editing-mode' : ''}`}>
                  {!isEditing ? (
                    // VIEW MODE
                    <>
                      <div className="item-icon">
                        <FiFileText />
                      </div>
                      <div className="item-details">
  <strong>📅 Test Date: {entry.test_date}</strong>
  {entry.certificate_path && (
    <p className="mt-1">
      📄{' '}
      <span
        className="file-link"
        onClick={() => openFile(entry.certificate_path)}
        style={{ 
          cursor: 'pointer', 
          color: '#4CAF50', 
          textDecoration: 'underline',
          fontWeight: 600 
        }}
      >
        View Certificate
      </span>
    </p>
  )}
  {entry.notes && (
    <p className="mt-1">
      <small>📝 Notes: {entry.notes}</small>
    </p>
  )}
</div>

                      <div className="item-status">
                        <span className={`status-badge ${getStatusBadgeClass(entry.status)}`}>
                          {entry.status}
                        </span>
                      </div>
                      <div className="item-actions">
                        <button
                          onClick={() => startEdit(entry)}
                          title="Edit Entry"
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id, entry.test_date)}
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
                            {medicalStatusOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="edit-field edit-field-full">
                          <label>Notes</label>
                          <textarea
                            name="notes"
                            value={editForm.notes}
                            onChange={handleEditFormChange}
                            className="edit-input"
                            rows="2"
                            placeholder="Optional notes..."
                          />
                        </div>
                        <div className="edit-field edit-field-full">
                          <label>Replace Certificate (Optional)</label>
                          <div className="custom-file-input">
                            <label
                              htmlFor={`edit-file-${entry.id}`}
                              className="file-input-label-small"
                            >
                              <FiFileText /> Choose New File
                            </label>
                            <input
                              type="file"
                              id={`edit-file-${entry.id}`}
                              ref={(el) => (editFileInputRefs.current[entry.id] = el)}
                              onChange={(e) => handleEditFileChange(entry.id, e)}
                              accept=".pdf,.jpg,.jpeg,.png"
                            />
                            {editForm.certificate_file && (
                              <span className="file-name-display">
                                {editForm.certificate_file.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="edit-actions">
                        <button
                          onClick={() => saveEdit(entry.id)}
                          className="btn-save"
                          disabled={isSaving}
                        >
                          <FiCheck /> {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="btn-cancel"
                          disabled={isSaving}
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

export default CandidateMedical;
