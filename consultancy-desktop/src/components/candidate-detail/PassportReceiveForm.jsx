import React, { useState } from 'react';
import { 
  FiUserCheck, FiTruck, FiPackage, FiCalendar, 
  FiFileText, FiImage, FiX 
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import StaffSelector from './StaffSelector';
import '../../css/passport-tracking/PassportForms.css';

function PassportReceiveForm({ candidateId, user, staffList, onSuccess }) {
  const [formData, setFormData] = useState({
    received_from: 'Candidate',
    method: 'By Hand',
    courier_number: '',
    date: new Date().toISOString().split('T')[0],
    received_by: user?.fullName || '',
    notes: '',
    photos: [],
    photoPreviews: [],
    useCustomReceivedBy: false,
  });

  const [isSaving, setIsSaving] = useState(false);

  // Handle photo selection
  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const oversized = files.filter(f => f.size > 5 * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error('Some files exceed 5MB limit');
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

  // Remove photo
  const removePhoto = (index) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
      photoPreviews: prev.photoPreviews.filter((_, i) => i !== index)
    }));
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.date || !formData.received_by) {
      toast.error('Please fill all required fields');
      return;
    }

    if (formData.method === 'By Courier' && !formData.courier_number) {
      toast.error('Courier number is required');
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
        // Upload photos if any
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
        
        // Reset form
        setFormData({
          received_from: 'Candidate',
          method: 'By Hand',
          courier_number: '',
          date: new Date().toISOString().split('T')[0],
          received_by: user?.fullName || '',
          notes: '',
          photos: [],
          photoPreviews: [],
          useCustomReceivedBy: false,
        });
        
        onSuccess(res.data);
      } else {
        toast.error(res.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred');
    }

    setIsSaving(false);
  };

  return (
    <div className="tab-panel">
      
      <form onSubmit={handleSubmit} className="movement-form">
        <div className="form-grid">
          <div className="form-group">
            <label><FiUserCheck /> RECEIVED FROM *</label>
            <select 
              value={formData.received_from}
              onChange={(e) => setFormData(prev => ({ ...prev, received_from: e.target.value }))}
              required
            >
              <option value="Candidate">👤 Candidate</option>
              <option value="Agent">🏢 Agent</option>
              <option value="Embassy">🏛️ Embassy</option>
              <option value="Other">📦 Other</option>
            </select>
          </div>

          <div className="form-group">
            <label><FiTruck /> DELIVERY METHOD *</label>
            <select 
              value={formData.method}
              onChange={(e) => setFormData(prev => ({ ...prev, method: e.target.value }))}
              required
            >
              <option value="By Hand">✋ By Hand</option>
              <option value="By Courier">📮 By Courier</option>
            </select>
          </div>

          {formData.method === 'By Courier' && (
            <div className="form-group">
              <label><FiPackage /> COURIER NUMBER *</label>
              <input 
                type="text"
                value={formData.courier_number}
                onChange={(e) => setFormData(prev => ({ ...prev, courier_number: e.target.value }))}
                placeholder="Tracking number"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label><FiCalendar /> DATE RECEIVED *</label>
            <input 
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              required
            />
          </div>

          {/* Staff Selector */}
          <StaffSelector
            value={formData.received_by}
            onChange={(value) => setFormData(prev => ({ ...prev, received_by: value }))}
            staffList={staffList}
            currentUser={user}
            useCustom={formData.useCustomReceivedBy}
            onToggleCustom={() => setFormData(prev => ({ 
              ...prev, 
              useCustomReceivedBy: !prev.useCustomReceivedBy 
            }))}
            label="RECEIVED BY (STAFF)"
          />

          <div className="form-group full-width">
            <label><FiFileText /> NOTES</label>
            <textarea 
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows="3"
              placeholder="Additional remarks..."
            />
          </div>
        </div>

        {/* Photo Upload Section */}
        <div className="photo-section">
          <label><FiImage /> ATTACH PHOTOS (OPTIONAL - MULTIPLE ALLOWED)</label>
          {formData.photoPreviews.length === 0 ? (
            <div className="photo-upload-area">
              <input 
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                id="receivePhoto"
                multiple
                style={{ display: 'none' }}
              />
              <label htmlFor="receivePhoto" className="upload-label">
                <FiImage />
                <span>📷 Click to upload photos (multiple)</span>
                <small>Max 5MB each</small>
              </label>
            </div>
          ) : (
            <div className="photo-gallery">
              {formData.photoPreviews.map((preview, index) => (
                <div key={index} className="photo-thumbnail">
                  <img src={preview} alt={`Preview ${index + 1}`} />
                  <button 
                    type="button"
                    className="remove-thumbnail-btn"
                    onClick={() => removePhoto(index)}
                  >
                    <FiX />
                  </button>
                </div>
              ))}
              <div className="add-more-photos">
                <input 
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  id="receivePhotoMore"
                  multiple
                  style={{ display: 'none' }}
                />
                <label htmlFor="receivePhotoMore" className="add-more-label">
                  <FiImage />
                  <span>+ Add More</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <button type="submit" className="submit-btn" disabled={isSaving}>
          {isSaving ? '⏳ Saving...' : '✅ Save Receipt Record'}
        </button>
      </form>
    </div>
  );
}

export default PassportReceiveForm;
