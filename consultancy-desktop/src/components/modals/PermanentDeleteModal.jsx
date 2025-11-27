import React, { useState } from 'react';
import { FiX, FiAlertTriangle, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';

function PermanentDeleteModal({user, item, targetType, onClose, onPermanentDelete }) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  const displayName = item.name || item.companyName || item.positionTitle;
  const displayType = targetType.replace('_', ' ').replace(/s$/, '');

  const handleDelete = async () => {
    setIsDeleting(true);
    
    const res = await window.electronAPI.deletePermanently({
      user,
        id: item.id,
        targetType: targetType
    });

    if (res.success) {
      onPermanentDelete(item.id); // Notify parent component to update list
      toast.success(`${displayType} "${displayName}" permanently deleted.`, { duration: 3000 });
      onClose();
    } else {
      toast.error(res.error || `Failed to permanently delete ${displayType}.`, { duration: 5000 });
    }
    setIsDeleting(false);
  };

  return (
    <div className="viewer-modal-backdrop" onClick={onClose}>
      <div 
        className="viewer-modal-content payment-modal" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '450px', height: 'fit-content', border: '1px solid var(--danger-color)' }}
      >
        <button className="viewer-close-btn" onClick={onClose}><FiX /></button>
        <div className="viewer-header" style={{background: 'var(--danger-color)', color: 'var(--text-on-primary)'}}>
          <h3><FiAlertTriangle /> PERMANENTLY Delete Item</h3>
        </div>
        <div className="payment-modal-body" style={{padding: '2rem', display: 'flex', flexDirection: 'column', gap: '15px'}}>
          
          <p style={{color: 'var(--danger-color)', fontWeight: 600}}>
              You are attempting to permanently delete the following record from the system. This action is **IRREVERSIBLE**.
          </p>
          
          <div style={{background: 'var(--bg-input)', padding: '10px', borderRadius: 'var(--border-radius)'}}>
             <strong>Type:</strong> {displayType}<br />
             <strong>Name:</strong> {displayName}
          </div>
            
          <button 
            type="button" 
            className="btn btn-danger btn-full-width" 
            onClick={handleDelete}
            disabled={isDeleting}
            style={{marginTop: '1rem'}}
          >
            {isDeleting ? 'Deleting...' : <><FiTrash2 /> Confirm Permanent Deletion</>}
          </button>
          
          <button 
            type="button" 
            className="btn btn-secondary btn-full-width" 
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>

        </div>
      </div>
    </div>
  );
}

export default PermanentDeleteModal;