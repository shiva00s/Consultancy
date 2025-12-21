import React, { useState, useEffect } from 'react';
import { FiUser, FiEdit } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../css/ProfilePhotoDisplay.css';

function ProfilePhotoDisplay({ candidateId, candidateName, editable = false }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadPhoto();
  }, [candidateId]);

  const loadPhoto = async () => {
    if (!candidateId) return;
    
    setLoading(true);
    try {
      const res = await window.electronAPI.getCandidateById({ candidateId });
      if (res && res.success && res.data) {
        const photoPath = res.data.photo_path || res.data.photoPath || res.data.photo || null;
        if (photoPath) {
          // request base64 for safe display (handles both absolute paths and stored filenames)
          const imgRes = await window.electronAPI.getImageBase64({ filePath: photoPath });
          if (imgRes && imgRes.success) setPhotoUrl(imgRes.data);
          else setPhotoUrl(photoPath);
        }
      }
    } catch (error) {
      console.error('Error loading photo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
          const result = await window.electronAPI.uploadPhoto({
            candidateId,
            fileBuffer: Array.from(new Uint8Array(reader.result)),
            fileName: file.name
          });

          if (result && result.success) {
            // request base64 preview from returned path
            const imgRes = await window.electronAPI.getImageBase64({ filePath: result.photoPath || result.photoPath });
            if (imgRes && imgRes.success) setPhotoUrl(imgRes.data);
            else setPhotoUrl(result.photoPath || null);
            toast.success('Photo updated successfully');
          } else {
            toast.error(result?.error || 'Failed to upload photo');
          }
        setUploading(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload photo');
      setUploading(false);
    }
  };

  return (
    <div className="profile-photo-container">
      <div className="photo-wrapper">
        {loading ? (
          <div className="photo-skeleton">
            <div className="skeleton-shimmer"></div>
          </div>
        ) : photoUrl ? (
          <img src={photoUrl} alt={candidateName} className="profile-photo" />
        ) : (
          <div className="photo-placeholder">
            <FiUser />
            <span>No Photo</span>
          </div>
        )}
        
        {editable && !uploading && (
          <label className="photo-edit-overlay" htmlFor="photo-upload-input">
            <FiEdit />
            <span>Change Photo</span>
          </label>
        )}
        
        {uploading && (
          <div className="photo-uploading">
            <div className="spinner"></div>
            <span>Uploading...</span>
          </div>
        )}
      </div>
      
      {editable && (
        <input
          id="photo-upload-input"
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
}

export default ProfilePhotoDisplay;
