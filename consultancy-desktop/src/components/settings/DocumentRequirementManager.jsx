// DocumentRequirementManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiFileText, FiPlus, FiTrash2, FiEdit2, FiCheck, FiX, 
  FiAlertCircle, FiCheckCircle, FiLayers
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import ConfirmDialog from '../common/ConfirmDialog';
import '../../css/DocumentRequirementManager.css';
import useNotificationStore from '../../store/useNotificationStore';

// Standard documents list with emojis
const STANDARD_DOCUMENTS = [
  { name: 'Passport', emoji: '🛂' },
  { name: 'Resume', emoji: '📝' },
  { name: 'Photograph', emoji: '📸' },
  { name: 'Education Certificate', emoji: '🎓' },
  { name: 'Experience Letter', emoji: '💼' },
  { name: 'Offer Letter', emoji: '📋' },
  { name: 'Visa', emoji: '✈️' },
  { name: 'Aadhar Card', emoji: '🪪' },
  { name: 'Pan Card', emoji: '💳' },
  { name: 'Medical Certificate', emoji: '🏥' },
  { name: 'Driving License', emoji: '🚗' },
  { name: 'Police Clearance', emoji: '👮' },
  { name: 'Bank Statement', emoji: '🏦' },
  { name: 'Insurance', emoji: '🛡️' },
  { name: 'Reference Letter', emoji: '📨' }
];

function DocumentRequirementManager({ user }) {
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [newDocName, setNewDocName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedStandardDoc, setSelectedStandardDoc] = useState('');
  
  // Inline edit states
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  
  // Confirm dialog states
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const createNotification = useNotificationStore((s) => s.createNotification);

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
      existingDoc.name.toLowerCase() === doc.name.toLowerCase()
    )
  );

  const handleAddDoc = async (e) => {
    e.preventDefault();
    const name = newDocName.trim();

    if (!name) {
      toast.error('📄 Document name cannot be empty!');
      return;
    }

    // Check if already exists (case-insensitive)
    const alreadyExists = requiredDocs.some(doc =>
      doc.name.toLowerCase() === name.toLowerCase()
    );

    if (alreadyExists) {
      toast.error(`⚠️ "${name}" is already in the required documents list!`);
      return;
    }

    setIsSaving(true);
    const res = await window.electronAPI.addRequiredDocument({ user, name });

    if (res.success) {
      setRequiredDocs(prev => [...prev, res.data]);
      setNewDocName('');
      setSelectedStandardDoc('');
      toast.success(`✅ Document "${name}" added successfully!`);
      try {
        createNotification({
          title: '📚 Required document added',
          message: `Required document "${name}" added to master list`,
          type: 'info',
          priority: 'normal',
          actor: { id: user?.id, name: user?.name || user?.username },
          target: { type: 'document_requirement', id: res.data?.id },
          meta: { name },
        });
      } catch (e) {}
    } else {
      toast.error(res.error || 'Failed to add document.');
    }
    setIsSaving(false);
  };

  const handleDeleteClick = (doc) => {
    setDeleteTarget(doc);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    const res = await window.electronAPI.deleteRequiredDocument({ 
      user, 
      id: deleteTarget.id 
    });

    if (res.success) {
      setRequiredDocs(prev => prev.filter(doc => doc.id !== deleteTarget.id));
      toast.success(`🗑️ Document "${deleteTarget.name}" removed successfully!`);
      try {
        createNotification({
          title: '🗑️ Required document removed',
          message: `Required document "${deleteTarget.name}" was removed from master list`,
          type: 'warning',
          priority: 'high',
          actor: { id: user?.id, name: user?.name || user?.username },
          target: { type: 'document_requirement', id: deleteTarget.id },
          meta: { name: deleteTarget.name },
        });
      } catch (e) {}
    } else {
      toast.error(res.error || 'Failed to delete document.');
    }

    setShowConfirm(false);
    setDeleteTarget(null);
  };

  const handleStandardDocSelect = (e) => {
    const value = e.target.value;
    setSelectedStandardDoc(value);
    if (value) {
      setNewDocName(value);
    }
  };

  // Inline Edit Functions
  const startEdit = (doc) => {
    setEditingId(doc.id);
    setEditValue(doc.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEdit = async (doc) => {
    const trimmedValue = editValue.trim();
    
    if (!trimmedValue) {
      toast.error('📄 Document name cannot be empty!');
      return;
    }

    if (trimmedValue === doc.name) {
      cancelEdit();
      return;
    }

    // Check if new name already exists
    const alreadyExists = requiredDocs.some(d =>
      d.id !== doc.id && d.name.toLowerCase() === trimmedValue.toLowerCase()
    );

    if (alreadyExists) {
      toast.error(`⚠️ "${trimmedValue}" already exists!`);
      return;
    }

    const res = await window.electronAPI.updateRequiredDocument({
      user,
      id: doc.id,
      name: trimmedValue
    });

    if (res.success) {
      setRequiredDocs(prev =>
        prev.map(d => (d.id === doc.id ? { ...d, name: trimmedValue } : d))
      );
      toast.success(`✏️ Document updated to "${trimmedValue}"!`);
      cancelEdit();
      try {
        createNotification({
          title: '✏️ Required document updated',
          message: `Required document updated to "${trimmedValue}"`,
          type: 'info',
          priority: 'normal',
          actor: { id: user?.id, name: user?.name || user?.username },
          target: { type: 'document_requirement', id: doc.id },
          meta: { oldName: doc.name, newName: trimmedValue },
        });
      } catch (e) {}
    } else {
      toast.error(res.error || 'Failed to update document.');
    }
  };

  // Get emoji for document
  const getDocEmoji = (docName) => {
    const found = STANDARD_DOCUMENTS.find(
      d => d.name.toLowerCase() === docName.toLowerCase()
    );
    return found ? found.emoji : '📄';
  };

  return (
    <div className="doc-req-section">
      {/* HEADER WITH EMOJIS */}
      <div className="doc-req-header">
        <h3 className="doc-req-title">
          <FiLayers />
          <span>📚 Required Documents Manager</span>
        </h3>
        <p className="doc-req-description">
          ✨ Define a master list of <strong>mandatory documents</strong>. 
          Candidates lacking these will be 🚨 flagged in the Document Checker. 
          <br />
          📊 Current count: <strong className="doc-count-badge">{requiredDocs.length}</strong> documents
        </p>
      </div>

      {/* ADD DOCUMENT FORM */}
      <form className="doc-req-form" onSubmit={handleAddDoc}>
        <div className="form-group">
          <label htmlFor="standard-doc-select">
            🎯 Quick Select (Standard)
          </label>
          <select
            id="standard-doc-select"
            className="form-select"
            value={selectedStandardDoc}
            onChange={handleStandardDocSelect}
            disabled={isSaving}
          >
            <option value="">-- Choose a standard document --</option>
            {availableDocuments.map((doc, idx) => (
              <option key={idx} value={doc.name}>
                {doc.emoji} {doc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="doc-name-input">
            📝 Or Enter Custom Name
          </label>
          <input
            id="doc-name-input"
            type="text"
            className="form-input"
            placeholder="e.g., Custom Certificate"
            value={newDocName}
            onChange={(e) => setNewDocName(e.target.value)}
            disabled={isSaving}
          />
        </div>

        <button
          type="submit"
          className="btn-add"
          disabled={isSaving || !newDocName.trim()}
        >
          {isSaving ? (
            <>
              <div className="btn-spinner" />
              Adding...
            </>
          ) : (
            <>
              <FiPlus />
              Add Document
            </>
          )}
        </button>
      </form>

      {/* DOCUMENTS LIST */}
      <div className="doc-req-list">
        {loading ? (
          <div className="loading-text">
            <div className="loading-spinner" />
            ⏳ Loading documents...
          </div>
        ) : requiredDocs.length === 0 ? (
          <div className="empty-state">
            <FiAlertCircle className="empty-icon" />
            <p>📄 No required documents defined yet.</p>
            <p className="empty-hint">Add your first document above! ☝️</p>
          </div>
        ) : (
          <div className="doc-req-cards">
            {requiredDocs.map((doc) => (
              <div key={doc.id} className="doc-req-card">
                {editingId === doc.id ? (
                  // INLINE EDIT MODE
                  <div className="doc-edit-container">
                    <div className="doc-edit-input-wrapper">
                      <span className="doc-emoji">{getDocEmoji(doc.name)}</span>
                      <input
                        type="text"
                        className="doc-edit-input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(doc);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        autoFocus
                      />
                    </div>
                    <div className="doc-edit-actions">
                      <button
                        className="doc-btn-save"
                        onClick={() => saveEdit(doc)}
                        title="Save changes"
                      >
                        <FiCheck />
                      </button>
                      <button
                        className="doc-btn-cancel"
                        onClick={cancelEdit}
                        title="Cancel editing"
                      >
                        <FiX />
                      </button>
                    </div>
                  </div>
                ) : (
                  // NORMAL VIEW MODE
                  <>
                    <div className="doc-card-content">
                      <span className="doc-emoji">{getDocEmoji(doc.name)}</span>
                      <div className="doc-info">
                        <span className="doc-card-name">{doc.name}</span>
                        <span className="doc-card-note">
                          <FiCheckCircle className="required-icon" />
                          Required Document
                        </span>
                      </div>
                    </div>
                    <div className="doc-actions">
                      <button
                        className="doc-edit-btn"
                        onClick={() => startEdit(doc)}
                        title="Edit document name"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        className="doc-delete-btn"
                        onClick={() => handleDeleteClick(doc)}
                        title="Delete document"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CONFIRM DELETE DIALOG */}
      {showConfirm && (
        <ConfirmDialog
          isOpen={showConfirm}
          title="🗑️ Delete Required Document"
          message={`Are you sure you want to remove "${deleteTarget?.name}" from the required documents list? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => {
            setShowConfirm(false);
            setDeleteTarget(null);
          }}
          type="danger"
        />
      )}
    </div>
  );
}

export default DocumentRequirementManager;
