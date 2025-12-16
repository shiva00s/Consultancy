import React, { useState } from 'react';
import { 
  FiUserCheck, FiPhone, FiTruck, FiPackage, FiCalendar, 
  FiFileText, FiImage, FiX, FiSave, FiUser, 
  FiBriefcase, FiGlobe, FiCreditCard, FiMapPin 
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAutoFillCandidateData } from '../../hooks/useAutoFillCandidateData';
import '../../css/passport-tracking/PassportForms.css';

function PassportReceiveForm({ candidateId, user, staffList, onSuccess }) {
  const { autoFillData, loading: autoFillLoading } = useAutoFillCandidateData(candidateId);
  
  const [formData, setFormData] = useState({
    received_from: 'Candidate',
    method: 'By Hand',
    courier_number: '',
    date: new Date().toISOString().split('T')[0],
    received_by: user?.fullName || '',
    notes: '',
    photos: [],
    photoPreviews: [],
  });

  const [isSaving, setIsSaving] = useState(false);

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const oversized = files.filter(f => f.size > 5 * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error('⚠️ Some files exceed 5MB limit');
      return;
    }

    const readers = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ file, preview: reader.result });
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then(results => {
      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, ...results.map(r => r.file)],
        photoPreviews: [...prev.photoPreviews, ...results.map(r => r.preview)]
      }));
    });
  };

  const removePhoto = (index) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
      photoPreviews: prev.photoPreviews.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.date || !formData.received_by) {
      toast.error('⚠️ Please fill all required fields');
      return;
    }

    if (formData.method === 'By Courier' && !formData.courier_number) {
      toast.error('⚠️ Courier number is required');
      return;
    }

    setIsSaving(true);

    try {
      const data = {
        type: 'RECEIVE',
        candidate_id: candidateId,
        received_from: formData.received_from,
        method: formData.method,
        courier_number: formData.courier_number || null,
        date: formData.date,
        received_by: formData.received_by,
        notes: formData.notes || null,
      };

      const res = await window.electronAPI.addPassportMovement({ data, user });

      if (res.success) {
        if (formData.photos.length > 0 && res.data?.id) {
          for (const photo of formData.photos) {
            const reader = new FileReader();
            await new Promise((resolve) => {
              reader.onloadend = async () => {
                const photoData = {
                  movement_id: res.data.id,
                  file_name: photo.name,
                  file_type: photo.type,
                  file_data: reader.result.split(',')[1],
                };
                await window.electronAPI.addPassportMovementPhoto({ data: photoData, user });
                resolve();
              };
              reader.readAsDataURL(photo);
            });
          }
          res.data.has_photos = true;
        }

        toast.success('✅ Passport received recorded!');
        setFormData({
          received_from: 'Candidate',
          method: 'By Hand',
          courier_number: '',
          date: new Date().toISOString().split('T')[0],
          received_by: user?.fullName || '',
          notes: '',
          photos: [],
          photoPreviews: [],
        });
        onSuccess(res.data);
      } else {
        toast.error(res.error || '❌ Failed to save');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('❌ An error occurred');
    }

    setIsSaving(false);
  };

  if (autoFillLoading) {
    return (
      <div className="passport-form-loading">
        <div className="spinner"></div>
        <p>Loading candidate data...</p>
      </div>
    );
  }

  return (
    <div className="passport-form-container">
      <div className="passport-form-header">
        <FiPackage className="form-icon" />
        <h3>📥 Receive Passport</h3>
      </div>

      <form onSubmit={handleSubmit} className="passport-form">
        {autoFillData && (
          <div className="candidate-info-section">
            {/* COLUMN HEADERS */}
            <div className="candidate-info-header">
              <div className="header-label">
                <FiUser /> Name
              </div>
              <div className="header-label">
                <FiBriefcase /> Position
              </div>
              <div className="header-label">
                <FiCreditCard /> Passport
              </div>
              <div className="header-label">
                <FiGlobe /> Country
              </div>
              <div className="header-label">
                <FiPhone /> Phone
              </div>
            </div>

            {/* INFO VALUES - ✅ INJECTED FROM HOOK */}
            <div className="candidate-info-bar">
              <div className="info-item">
                <span>{autoFillData.name || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span>{autoFillData.position || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span>{autoFillData.passport || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span>{autoFillData.country || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span>{autoFillData.phone || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>
              <FiUserCheck /> Received From *
            </label>
            <select
              value={formData.received_from}
              onChange={(e) => setFormData({ ...formData, received_from: e.target.value })}
              className="form-select"
              required
            >
              <option value="Candidate">👤 Candidate</option>
              <option value="Agent">🤝 Agent</option>
              <option value="Embassy">🏛️ Embassy</option>
              <option value="Other">📦 Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              <FiTruck /> Method *
            </label>
            <select
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value })}
              className="form-select"
              required
            >
              <option value="By Hand">✋ By Hand</option>
              <option value="By Courier">🚚 By Courier</option>
            </select>
          </div>

          {formData.method === 'By Courier' && (
            <div className="form-group">
              <label>
                <FiPackage /> Courier Number *
              </label>
              <input
                type="text"
                value={formData.courier_number}
                onChange={(e) => setFormData({ ...formData, courier_number: e.target.value })}
                placeholder="Tracking number"
                className="form-input"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>
              <FiCalendar /> Date *
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label>
              <FiUser /> Received By *
            </label>
            <select
              value={formData.received_by}
              onChange={(e) => setFormData({ ...formData, received_by: e.target.value })}
              className="form-select"
              required
            >
              <option value={user?.fullName || ''}>
                {user?.fullName || 'Current User'}
              </option>
              {staffList?.filter(s => s.fullName !== user?.fullName).map(staff => (
                <option key={staff.id} value={staff.fullName}>
                  {staff.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group full-width">
          <label>
            <FiFileText /> Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Optional notes..."
            className="form-textarea"
            rows="3"
          />
        </div>

        <div className="form-group full-width">
          <label>
            <FiImage /> Attach Photos
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoSelect}
            className="form-file-input"
            id="receive-photos"
          />
          <label htmlFor="receive-photos" className="file-input-label">
            <FiImage /> Choose Photos
          </label>

          {formData.photoPreviews.length > 0 && (
            <div className="photo-preview-grid">
              {formData.photoPreviews.map((preview, index) => (
                <div key={index} className="photo-preview-item">
                  <img src={preview} alt={`Preview ${index + 1}`} />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="remove-photo-btn"
                  >
                    <FiX />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-save" disabled={isSaving}>
            {isSaving ? (
              <>
                <div className="btn-spinner"></div>
                Saving...
              </>
            ) : (
              <>
                <FiSave /> Save
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PassportReceiveForm;
