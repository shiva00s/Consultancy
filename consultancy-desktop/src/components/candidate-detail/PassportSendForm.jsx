import React, { useState } from 'react';
import { 
  FiMapPin, FiUser, FiPhone, FiTruck, FiPackage, 
  FiCalendar, FiFileText, FiImage, FiX 
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import StaffSelector from './StaffSelector';
import '../../css/passport-tracking/PassportForms.css';

function PassportSendForm({ candidateId, user, staffList, onSuccess }) {
  const [formData, setFormData] = useState({
    send_to: 'Candidate',
    send_to_name: '',
    send_to_contact: '',
    method: 'By Hand',
    courier_number: '',
    date: new Date().toISOString().split('T')[0],
    sent_by: user?.fullName || '',
    notes: '',
    photos: [],
    photoPreviews: [],
    useCustomSentBy: false,
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

    if (!formData.date || !formData.sent_by) {
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
        type: 'SEND',
        candidate_id: candidateId,
        send_to: formData.send_to,
        send_to_name: formData.send_to_name || null,
        send_to_contact: formData.send_to_contact || null,
        method: formData.method,
        courier_number: formData.courier_number || null,
        date: formData.date,
        sent_by: formData.sent_by,
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

        toast.success('✅ Passport sent recorded!');
        
        // Reset form
        setFormData({
          send_to: 'Candidate',
          send_to_name: '',
          send_to_contact: '',
          method: 'By Hand',
          courier_number: '',
          date: new Date().toISOString().split('T')[0],
          sent_by: user?.fullName || '',
          notes: '',
          photos: [],
          photoPreviews: [],
          useCustomSentBy: false,
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
            <label><FiMapPin /> SEND TO *</label>
            <select 
              value={formData.send_to}
              onChange={(e) => setFormData(prev => ({ ...prev, send_to: e.target.value }))}
              required
            >
              <option value="Candidate">👤 Candidate</option>
              <option value="Agent">🏢 Agent</option>
              <option value="Embassy">🏛️ Embassy</option>
              <option value="Employer">🏭 Employer</option>
              <option value="Other">📦 Other</option>
            </select>
          </div>

          <div className="form-group">
            <label><FiUser /> RECIPIENT NAME</label>
            <input 
              type="text"
              value={formData.send_to_name}
              onChange={(e) => setFormData(prev => ({ ...prev, send_to_name: e.target.value }))}
              placeholder="Person/Organization name"
            />
          </div>

          <div className="form-group">
            <label><FiPhone /> RECIPIENT CONTACT</label>
            <input 
              type="text"
              value={formData.send_to_contact}
              onChange={(e) => setFormData(prev => ({ ...prev, send_to_contact: e.target.value }))}
              placeholder="Phone/Email"
            />
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

          <div className="form-group">
            <label><FiCalendar /> DATE SENT *</label>
            <input 
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              required
            />
          </div>

          {formData.method === 'By Courier' && (
            <div className="form-group full-width">
              <label><FiPackage /> COURIER TRACKING NUMBER *</label>
              <input 
                type="text"
                value={formData.courier_number}
                onChange={(e) => setFormData(prev => ({ ...prev, courier_number: e.target.value }))}
                placeholder="Enter tracking/docket number"
                required
              />
            </div>
          )}

          {/* Staff Selector */}
          <StaffSelector
            value={formData.sent_by}
            onChange={(value) => setFormData(prev => ({ ...prev, sent_by: value }))}
            staffList={staffList}
            currentUser={user}
            useCustom={formData.useCustomSentBy}
            onToggleCustom={() => setFormData(prev => ({ 
              ...prev, 
              useCustomSentBy: !prev.useCustomSentBy 
            }))}
            label="SENT BY (STAFF)"
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
                id="sendPhoto"
                multiple
                style={{ display: 'none' }}
              />
              <label htmlFor="sendPhoto" className="upload-label">
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
                  id="sendPhotoMore"
                  multiple
                  style={{ display: 'none' }}
                />
                <label htmlFor="sendPhotoMore" className="add-more-label">
                  <FiImage />
                  <span>+ Add More</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <button type="submit" className="submit-btn" disabled={isSaving}>
          {isSaving ? '⏳ Saving...' : '✅ Save Dispatch Record'}
        </button>
      </form>
    </div>
  );
}

export default PassportSendForm;
