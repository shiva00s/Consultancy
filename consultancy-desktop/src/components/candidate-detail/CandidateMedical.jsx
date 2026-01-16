import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiPlus, FiTrash2, FiFileText, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { readFileAsBuffer } from '../../utils/file';
import toast from 'react-hot-toast';
import '../../css/CandidateMedical.css';
import ConfirmDialog from '../common/ConfirmDialog';
import useNotificationStore from '../../store/useNotificationStore';

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
  const [certificatePreview, setCertificatePreview] = useState(null);
  const [certificatePreviews, setCertificatePreviews] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });
  const createNotification = useNotificationStore((s) => s.createNotification);

  const [medUploadId, setMedUploadId] = useState(null);
  const [medFileProgress, setMedFileProgress] = useState(null);

  const fileInputRef = useRef(null);
  const editFileInputRefs = useRef({});
  const [editPreviews, setEditPreviews] = useState({});

  const fetchMedicalTracking = useCallback(async () => {
    setLoading(true);
    const res = await window.electronAPI.getMedicalTracking({ candidateId });
    if (res.success) setMedicalEntries(res.data || []);
    setLoading(false);
  }, [candidateId]);

  useEffect(() => {
    fetchMedicalTracking();
  }, [candidateId, fetchMedicalTracking]);


  // Load previews for certificate files for history thumbnails
  useEffect(() => {
    const load = async () => {
      if (!medicalEntries || medicalEntries.length === 0) return;
      for (const entry of medicalEntries) {
        if (!entry.certificate_path) continue;
        if (certificatePreviews[entry.id]) continue;
        try {
          const path = entry.certificate_path;
          const isImage = /\.(jpe?g|png|gif|webp)$/i.test(path);
          if (isImage) {
            const res = await window.electronAPI.getImageBase64({ filePath: path });
            if (res && res.success) setCertificatePreviews((p) => ({ ...p, [entry.id]: { data: res.data, type: 'image' } }));
          } else if (/\.pdf$/i.test(path)) {
            // only create embedded preview for PDFs — other document types should not be embedded
            const res = await window.electronAPI.getDocumentBase64({ filePath: path });
            if (res && res.success) {
              const data = res.data || '';
              const hasPrefix = data.startsWith('data:');
              const url = hasPrefix ? data : `data:application/pdf;base64,${data}`;
              setCertificatePreviews((p) => ({ ...p, [entry.id]: { data: url, type: 'pdf' } }));
            }
          } else {
            // for other file types (docx, xlsx, etc.) don't attempt to embed — mark as 'other'
            setCertificatePreviews((p) => ({ ...p, [entry.id]: { data: null, type: 'other', path } }));
          }
        } catch (err) {
          console.error('load certificate preview failed', err);
        }
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicalEntries]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setMedicalForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0] || null;
    setMedicalForm((prev) => ({ ...prev, certificate_file: file }));

    // create object URL preview
    if (file) {
      try {
        const url = URL.createObjectURL(file);
        let normalizedType = 'other';
        if (file.type && file.type.startsWith('image/')) normalizedType = 'image';
        else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) normalizedType = 'pdf';
        // for non-previewable types mark as 'other' (no embed)
        setCertificatePreview(normalizedType === 'other' ? { url: null, type: 'other' } : { url, type: normalizedType });
      } catch (err) {
        console.error('preview create failed', err);
        setCertificatePreview(null);
      }
    } else {
      setCertificatePreview(null);
    }
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
    // cleanup preview for current editing id (if any)
    if (editingId && editPreviews[editingId] && editPreviews[editingId].url) {
      try {
        URL.revokeObjectURL(editPreviews[editingId].url);
      } catch {}
    }
    setEditPreviews((prev) => {
      const copy = { ...prev };
      if (editingId) delete copy[editingId];
      return copy;
    });
    setEditingId(null);
    setEditForm({});
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditFileChange = (entryId, e) => {
    const file = e.target.files[0] || null;
    setEditForm((prev) => ({ ...prev, certificate_file: file }));

    // create object URL preview for this entry
    setEditPreviews((prev) => {
      // revoke previous if exists
      if (prev[entryId] && prev[entryId].url) {
        try {
          URL.revokeObjectURL(prev[entryId].url);
        } catch {}
      }
      if (file) {
        try {
          const url = URL.createObjectURL(file);
          let normalizedType = 'other';
          if (file.type && file.type.startsWith('image/')) normalizedType = 'image';
          else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) normalizedType = 'pdf';
          return { ...prev, [entryId]: normalizedType === 'other' ? { url: null, type: 'other' } : { url, type: normalizedType } };
        } catch (err) {
          console.error('edit preview create failed', err);
          return { ...prev, [entryId]: null };
        }
      }
      const copy = { ...prev };
      delete copy[entryId];
      return copy;
    });
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

        const docRes = await window.electronAPI.addDocuments({ user, candidateId, files: [fileData] });
        if (docRes && Array.isArray(docRes.uploadIds) && docRes.uploadIds[0]) {
          setMedUploadId(docRes.uploadIds[0]);
          setMedFileProgress({ transferred: 0, total: buffer.length, status: 'progress', fileName: fileData.name });
        }
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
        // cleanup any transient preview for this entry
        if (editPreviews[entryId] && editPreviews[entryId].url) {
          try {
            URL.revokeObjectURL(editPreviews[entryId].url);
          } catch {}
        }
        setEditPreviews((prev) => {
          const copy = { ...prev };
          delete copy[entryId];
          return copy;
        });
        setEditingId(null);
        setEditForm({});
        toast.success('✅ Medical entry updated successfully!', { id: toastId });
        try {
          createNotification({
            title: '🏥 Medical entry updated',
            message: `${candidateName || 'Candidate'} medical entry updated for ${editForm.test_date}`,
            type: 'info',
            priority: 'normal',
            link: `/candidate/${candidateId}?tab=medical`,
            actor: { id: user?.id, name: user?.name || user?.username },
            target: { type: 'medical', id: entryId },
            meta: { candidateId },
          });
        } catch (e) {}
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

  // cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (certificatePreview && certificatePreview.url) {
        try {
          URL.revokeObjectURL(certificatePreview.url);
        } catch {}
      }
      Object.values(editPreviews).forEach((p) => {
        if (p && p.url) {
          try {
            URL.revokeObjectURL(p.url);
          } catch {}
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to upload progress for medical file uploads
  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.onUploadProgress) return;
    const unsub = window.electronAPI.onUploadProgress((payload) => {
      const { uploadId, transferred = 0, total = 0, status, data } = payload || {};
      if (!uploadId) return;
      if (medUploadId && uploadId === medUploadId) {
        setMedFileProgress({ transferred, total, status, data });
        if (status === 'completed' || status === 'done') {
          setTimeout(() => setMedUploadId(null), 1200);
        }
      }
      // also allow matching by filename on completed event
      if (!medUploadId && data && data.fileName && medicalForm.certificate_file && data.fileName === medicalForm.certificate_file.name) {
        setMedFileProgress({ transferred: total || transferred, total, status: 'completed', data });
        setTimeout(() => setMedFileProgress(null), 1500);
      }
    });
    return () => unsub && unsub();
  }, [medUploadId, medicalForm.certificate_file]);

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

        const docRes = await window.electronAPI.addDocuments({ user, candidateId, files: [fileData] });
        if (docRes && Array.isArray(docRes.uploadIds) && docRes.uploadIds[0]) {
          setMedUploadId(docRes.uploadIds[0]);
          setMedFileProgress({ transferred: 0, total: buffer.length, status: 'progress', fileName: fileData.name });
        }
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
        // revoke any transient preview URL
        if (certificatePreview && certificatePreview.url) {
          try {
            URL.revokeObjectURL(certificatePreview.url);
          } catch {}
        }
        setCertificatePreview(null);
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

        try {
          createNotification({
            title: '🏥 Medical entry added',
            message: `${candidateName || 'Candidate'} medical entry added for ${medicalForm.test_date}`,
            type: 'info',
            priority: 'normal',
            link: `/candidate/${candidateId}?tab=medical`,
            actor: { id: user?.id, name: user?.name || user?.username },
            target: { type: 'medical', id: res.data?.id },
            meta: { candidateId },
          });
        } catch (e) {}
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
          try {
            createNotification({
              title: '🗑️ Medical entry deleted',
              message: `Medical entry moved to Recycle Bin for candidate ${candidateName || candidateId}`,
              type: 'warning',
              priority: 'high',
              link: `/candidate/${candidateId}?tab=medical`,
              actor: { id: user?.id, name: user?.name || user?.username },
              target: { type: 'medical', id },
              meta: { candidateId },
            });
          } catch (e) {}
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

            <div className="form-group notes-group">
              <label>Notes</label>
              <textarea
                name="notes"
                value={medicalForm.notes}
                onChange={handleFormChange}
                placeholder="Add any additional notes..."
                rows={2}
                className="notes-textarea auto-resize compact-textarea"
              />
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
      className="hidden-input"
    />
    <label htmlFor="certificate_file" className="file-input-label">
      <FiFileText />
      Choose File
    </label>
    {medicalForm.certificate_file && (
      <div className="file-preview-row" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        {certificatePreview ? (
          (certificatePreview.type === 'image' || (certificatePreview.type && certificatePreview.type.startsWith && certificatePreview.type.startsWith('image')))
            ? (
              <div className="du-file-thumb">
                <img src={certificatePreview.url} alt="certificate preview" />
              </div>
            ) : (certificatePreview.type === 'pdf' || (certificatePreview.type && certificatePreview.type.toLowerCase && certificatePreview.type.toLowerCase().includes('pdf')))
            ? (
              <div className="doclist-pdf-thumb">
                <embed src={certificatePreview.url} type="application/pdf" />
              </div>
            ) : null
        ) : null}

        <div className="file-name-display">
          <FiFileText />
          <span className="file-name-text">{medicalForm.certificate_file.name}</span>
        </div>
        {/* Inline progress for certificate upload */}
        {medFileProgress && (medFileProgress.fileName === medicalForm.certificate_file.name || medUploadId) && (
          <div style={{ flex: 1, marginLeft: 12 }}>
            <div style={{ height: 8, background: '#1f2937', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${medFileProgress.total ? Math.round((medFileProgress.transferred / medFileProgress.total) * 100) : 0}%`, height: '100%', background: '#10b981' }} />
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{medFileProgress.total ? `${Math.round((medFileProgress.transferred / medFileProgress.total) * 100)}%` : ''} {medFileProgress.status === 'error' ? ' • Error' : medFileProgress.status === 'completed' ? ' • Done' : ''}</div>
          </div>
        )}
        {/* Cancel button for certificate upload */}
        {medUploadId && medFileProgress && medFileProgress.status === 'progress' && (
          <button
            type="button"
            className="du-upload-cancel-btn"
            onClick={async () => {
              try {
                if (window.electronAPI && window.electronAPI.cancelUpload) {
                  await window.electronAPI.cancelUpload({ uploadId: medUploadId });
                }
              } catch (err) {
                console.error('Cancel med upload error', err);
              }
              setMedFileProgress((p) => p ? { ...p, status: 'cancelled' } : p);
              setMedUploadId(null);
            }}
            title="Cancel upload"
          >
            Cancel
          </button>
        )}
      </div>
    )}
  </div>
</div>

          {/* Notes moved into the top row (notes-group) */}

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
      <div className="file-preview-row" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        {editPreviews[entry.id] ? (
          ((editPreviews[entry.id].type === 'image') || (editPreviews[entry.id].type && editPreviews[entry.id].type.startsWith && editPreviews[entry.id].type.startsWith('image')))
            ? (
              <div className="du-file-thumb">
                <img src={editPreviews[entry.id].url} alt="edit certificate preview" />
              </div>
            ) : ((editPreviews[entry.id].type === 'pdf') || (editPreviews[entry.id].type && editPreviews[entry.id].type.toLowerCase && editPreviews[entry.id].type.toLowerCase().includes('pdf'))) 
            ? (
              <div className="doclist-pdf-thumb">
                <embed src={editPreviews[entry.id].url} type="application/pdf" />
              </div>
            ) : null
        ) : null}

        <div className="file-name-display">
          <FiFileText />
          <span className="file-name-text">{editForm.certificate_file.name}</span>
        </div>
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
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                          {entry.certificate_path && certificatePreviews[entry.id] ? (
                            certificatePreviews[entry.id].type === 'image' ? (
                              <div className="du-file-thumb">
                                <img src={certificatePreviews[entry.id].data} alt="certificate" />
                              </div>
                            ) : (
                              <div className="doclist-pdf-thumb">
                                <embed src={certificatePreviews[entry.id].data} type="application/pdf" />
                              </div>
                            )
                          ) : null}

                          <p style={{ margin: 0 }}>
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
                        </div>
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
