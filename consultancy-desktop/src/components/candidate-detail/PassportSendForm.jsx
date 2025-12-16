import React, { useState } from 'react';
import { FiMapPin, FiUser, FiPhone, FiTruck, FiPackage, FiCalendar, FiFileText, FiImage, FiX, FiSave, FiBriefcase, FiGlobe, FiCreditCard } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../../css/passport-tracking/PassportForms.css';

function PassportSendForm({ candidateId, candidateName, position, toCountry, passportNo, user, staffList, onSuccess }) {
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
    if (!formData.date || !formData.sent_by) {
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

  return (
    <form className="passport-form" onSubmit={handleSubmit}>
      <div className="form-grid-5">
        {/* AUTO-FILLED INFO (5 COLUMNS) */}
        <div className="form-group">
          <label className="form-label">
            <FiUser /> 👤 CANDIDATE
          </label>
          <input 
            type="text"
            className="form-input readonly-input"
            value={candidateName || 'N/A'}
            readOnly
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            <FiBriefcase /> 💼 POSITION
          </label>
          <input 
            type="text"
            className="form-input readonly-input"
            value={position || 'N/A'}
            readOnly
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            <FiGlobe /> 🌍 COUNTRY
          </label>
          <input 
            type="text"
            className="form-input readonly-input"
            value={toCountry || 'N/A'}
            readOnly
          />
        </div>

        <div className="form-group col-span-2">
          <label className="form-label">
            <FiCreditCard /> 📕 PASSPORT NO
          </label>
          <input 
            type="text"
            className="form-input readonly-input"
            value={passportNo || 'N/A'}
            readOnly
          />
        </div>

        {/* DIVIDER */}
        <div className="form-divider col-span-5"></div>

        {/* ROW: SEND TO, NAME, CONTACT, METHOD, DATE */}
        <div className="form-group">
          <label className="form-label">
            <FiMapPin /> 📤 SEND TO <span className="required">*</span>
          </label>
          <select 
            className="form-input"
            value={formData.send_to}
            onChange={(e) => setFormData({...formData, send_to: e.target.value})}
            required
          >
            <option value="Candidate">👤 Candidate</option>
            <option value="Agent">🤝 Agent</option>
            <option value="Embassy">🏛️ Embassy</option>
            <option value="Employer">🏢 Employer</option>
            <option value="Other">📦 Other</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">
            <FiUser /> 👤 RECIPIENT NAME
          </label>
          <input 
            type="text"
            className="form-input"
            placeholder="Person/Org name"
            value={formData.send_to_name}
            onChange={(e) => setFormData({...formData, send_to_name: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            <FiPhone /> 📞 CONTACT
          </label>
          <input 
            type="text"
            className="form-input"
            placeholder="Phone/Email"
            value={formData.send_to_contact}
            onChange={(e) => setFormData({...formData, send_to_contact: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            <FiTruck /> 🚚 METHOD <span className="required">*</span>
          </label>
          <select 
            className="form-input"
            value={formData.method}
            onChange={(e) => setFormData({...formData, method: e.target.value})}
            required
          >
            <option value="By Hand">✋ By Hand</option>
            <option value="By Courier">🚚 Courier</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">
            <FiCalendar /> 📅 DATE <span className="required">*</span>
          </label>
          <input 
            type="date"
            className="form-input"
            value={formData.date}
            onChange={(e) => setFormData({...formData, date: e.target.value})}
            required
          />
        </div>

        {/* ROW: SENT BY, COURIER NUMBER (if courier), NOTES (3 COLUMNS) */}
        <div className="form-group">
          <label className="form-label">
            <FiUser /> 👨‍💼 SENT BY <span className="required">*</span>
          </label>
          <select 
            className="form-input"
            value={formData.sent_by}
            onChange={(e) => setFormData({...formData, sent_by: e.target.value})}
            required
          >
            <option value="">Select staff...</option>
            {staffList.map(staff => (
              <option key={staff.id} value={staff.fullName}>{staff.fullName}</option>
            ))}
          </select>
        </div>

        {/* COURIER NUMBER - ONLY IF BY COURIER */}
        {formData.method === 'By Courier' ? (
          <div className="form-group">
            <label className="form-label">
              <FiPackage /> 📦 COURIER # <span className="required">*</span>
            </label>
            <input 
              type="text"
              className="form-input"
              placeholder="Tracking number..."
              value={formData.courier_number}
              onChange={(e) => setFormData({...formData, courier_number: e.target.value})}
              required
            />
          </div>
        ) : null}

        {/* NOTES - TAKES 3 COLUMNS (or 4 if no courier) */}
        <div className={`form-group ${formData.method === 'By Courier' ? 'col-span-3' : 'col-span-4'}`}>
          <label className="form-label">
            <FiFileText /> 📝 NOTES
          </label>
          <textarea 
            className="form-textarea-compact"
            placeholder="Brief remarks..."
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            rows="2"
          />
        </div>

        {/* PHOTO UPLOAD - SMALLER PREVIEWS */}
        <div className="form-group col-span-5">
          <label className="form-label">
            <FiImage /> 📸 ATTACH PHOTOS (OPTIONAL)
          </label>
          <div className="photo-upload-area-compact">
            <input
              type="file"
              id="photo-upload-send"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              style={{ display: 'none' }}
            />
            <label htmlFor="photo-upload-send" className="photo-upload-button">
              <FiImage /> Choose Photos
            </label>
            {formData.photoPreviews.length > 0 && (
              <div className="photo-preview-grid-compact">
                {formData.photoPreviews.map((preview, index) => (
                  <div key={index} className="photo-preview-item-compact">
                    <img src={preview} alt={`${index + 1}`} />
                    <button
                      type="button"
                      className="photo-remove-btn-compact"
                      onClick={() => removePhoto(index)}
                    >
                      <FiX />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CENTERED SAVE BUTTON */}
        <div className="form-actions-center col-span-5">
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={isSaving}
          >
            <FiSave /> {isSaving ? '⏳ Saving...' : '✅ Save Send Record'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default PassportSendForm;
