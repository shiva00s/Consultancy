import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiDownload, FiUpload, FiClock, FiTrash2, FiImage, 
  FiX, FiPackage, FiTruck, FiUserCheck, FiCalendar, FiUser,
  FiMapPin, FiPhone, FiFileText, FiEye
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import '../../css/CandidatePassport.css';

function CandidatePassport({ candidateId, candidateData }) {
  const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));
  const [activeTab, setActiveTab] = useState('receive');
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);
  const [viewingPhotos, setViewingPhotos] = useState(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const [receiveForm, setReceiveForm] = useState({
  received_from: 'Candidate',
  method: 'By Hand',
  courier_number: '',
  date: new Date().toISOString().split('T')[0],
  received_by: '',
  notes: '',
  photos: [],
  photoPreviews: [],
  useCustomReceivedBy: false, // ✅ ADD THIS
});


  <div className="form-group">
  <label><FiUser /> RECEIVED BY (STAFF) *</label>
  <div className="staff-selection-wrapper">
    {/* Toggle Button */}
    <button
      type="button"
      onClick={() => setReceiveForm(prev => ({ 
        ...prev, 
        useCustomReceivedBy: !prev.useCustomReceivedBy 
      }))}
      className={`toggle-custom-btn ${receiveForm.useCustomReceivedBy ? 'active' : ''}`}
      title={receiveForm.useCustomReceivedBy ? 'Switch to dropdown' : 'Switch to custom input'}
    >
      ✏️ {receiveForm.useCustomReceivedBy ? 'Custom' : 'Dropdown'}
    </button>
    
    {/* Dropdown or Text Input */}
    {!receiveForm.useCustomReceivedBy ? (
      <select 
        value={receiveForm.received_by}
        onChange={(e) => setReceiveForm(prev => ({ ...prev, received_by: e.target.value }))}
        required
        className="staff-select"
      >
        <option value="">-- Select Staff --</option>
        {user?.fullName && (
          <option value={user.fullName}>
            👤 {user.fullName} (You)
          </option>
        )}
        {staffList
          .filter(name => name !== user?.fullName)
          .map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))
        }
      </select>
    ) : (
      <input 
        type="text"
        value={receiveForm.received_by}
        onChange={(e) => setReceiveForm(prev => ({ ...prev, received_by: e.target.value }))}
        placeholder="Enter staff name manually"
        required
        className="staff-custom-input"
      />
    )}
  </div>
</div>


  const [isSaving, setIsSaving] = useState(false);

  // Fetch staff list
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        if (window.electronAPI?.getUsers) {
          const result = await window.electronAPI.getUsers({ user });
          if (result.success && result.data) {
            const names = result.data.map(u => u.fullName).filter(Boolean);
            setStaffList(names);
            
            if (user?.fullName) {
              setReceiveForm(prev => ({ ...prev, received_by: user.fullName }));
              setSendForm(prev => ({ ...prev, sent_by: user.fullName }));
            }
          }
        } else {
          if (user?.fullName) {
            setStaffList([user.fullName]);
            setReceiveForm(prev => ({ ...prev, received_by: user.fullName }));
            setSendForm(prev => ({ ...prev, sent_by: user.fullName }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch staff:', error);
      }
    };
    fetchStaff();
  }, [user]);

  // Fetch movements
  const fetchMovements = useCallback(async () => {
    setLoading(true);
    const res = await window.electronAPI.getPassportMovements({ candidateId, user });
    if (res.success) {
      setMovements(res.data || []);
    } else {
      toast.error(res.error || 'Failed to fetch movements');
    }
    setLoading(false);
  }, [candidateId, user]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  // Handle multiple photo selection
  const handlePhotoSelect = (e, formType) => {
    const files = Array.from(e.target.files);
    
    if (files.length === 0) return;

    // Check file sizes
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
      if (formType === 'receive') {
        setReceiveForm(prev => ({
          ...prev,
          photos: [...prev.photos, ...results.map(r => r.file)],
          photoPreviews: [...prev.photoPreviews, ...results.map(r => r.preview)]
        }));
      } else {
        setSendForm(prev => ({
          ...prev,
          photos: [...prev.photos, ...results.map(r => r.file)],
          photoPreviews: [...prev.photoPreviews, ...results.map(r => r.preview)]
        }));
      }
    });
  };

  // Remove photo by index
  const removePhoto = (index, formType) => {
    if (formType === 'receive') {
      setReceiveForm(prev => ({
        ...prev,
        photos: prev.photos.filter((_, i) => i !== index),
        photoPreviews: prev.photoPreviews.filter((_, i) => i !== index)
      }));
    } else {
      setSendForm(prev => ({
        ...prev,
        photos: prev.photos.filter((_, i) => i !== index),
        photoPreviews: prev.photoPreviews.filter((_, i) => i !== index)
      }));
    }
  };

  // Handle receive submit
  const handleReceiveSubmit = async (e) => {
    e.preventDefault();

    if (!receiveForm.date || !receiveForm.received_by) {
      toast.error('Please fill all required fields');
      return;
    }

    if (receiveForm.method === 'By Courier' && !receiveForm.courier_number) {
      toast.error('Courier number is required');
      return;
    }

    setIsSaving(true);

    try {
      const data = {
        type: 'RECEIVE',
        candidate_id: candidateId,
        received_from: receiveForm.received_from,
        method: receiveForm.method,
        courier_number: receiveForm.courier_number || null,
        date: receiveForm.date,
        received_by: receiveForm.received_by,
        notes: receiveForm.notes || null,
      };

      const res = await window.electronAPI.addPassportMovement({ data, user });

      if (res.success) {
        // Upload photos if any
        if (receiveForm.photos.length > 0 && res.data?.id) {
          for (const photo of receiveForm.photos) {
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

        setMovements(prev => [res.data, ...prev]);
        toast.success('✅ Passport received recorded!');
        
        setReceiveForm({
          received_from: 'Candidate',
          method: 'By Hand',
          courier_number: '',
          date: new Date().toISOString().split('T')[0],
          received_by: user?.fullName || '',
          notes: '',
          photos: [],
          photoPreviews: [],
        });
        
        setActiveTab('history');
      } else {
        toast.error(res.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred');
    }

    setIsSaving(false);
  };

  // Handle send submit
  const handleSendSubmit = async (e) => {
    e.preventDefault();

    if (!sendForm.date || !sendForm.sent_by) {
      toast.error('Please fill all required fields');
      return;
    }

    if (sendForm.method === 'By Courier' && !sendForm.courier_number) {
      toast.error('Courier number is required');
      return;
    }

    setIsSaving(true);

    try {
      const data = {
        type: 'SEND',
        candidate_id: candidateId,
        send_to: sendForm.send_to,
        send_to_name: sendForm.send_to_name || null,
        send_to_contact: sendForm.send_to_contact || null,
        method: sendForm.method,
        courier_number: sendForm.courier_number || null,
        date: sendForm.date,
        sent_by: sendForm.sent_by,
        notes: sendForm.notes || null,
      };

      const res = await window.electronAPI.addPassportMovement({ data, user });

      if (res.success) {
        // Upload photos if any
        if (sendForm.photos.length > 0 && res.data?.id) {
          for (const photo of sendForm.photos) {
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

        setMovements(prev => [res.data, ...prev]);
        toast.success('✅ Passport sent recorded!');
        
        setSendForm({
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
        
        setActiveTab('history');
      } else {
        toast.error(res.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred');
    }

    setIsSaving(false);
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this movement record?')) return;

    const res = await window.electronAPI.deletePassportMovement({ id, user });
    if (res.success) {
      setMovements(prev => prev.filter(m => m.id !== id));
      toast.success('Movement deleted');
    } else {
      toast.error(res.error || 'Failed to delete');
    }
  };

  // View photos
  const handleViewPhotos = async (movementId) => {
    const res = await window.electronAPI.getPassportMovementPhotos({ movementId, user });
    if (res.success && res.data && res.data.length > 0) {
      setViewingPhotos(res.data);
      setCurrentPhotoIndex(0);
    } else {
      toast.error('No photos found');
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="passport-tracking-content">
      {/* Photo Gallery Viewer */}
      {viewingPhotos && (
        <div className="photo-viewer-overlay" onClick={() => setViewingPhotos(null)}>
          <div className="photo-viewer-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setViewingPhotos(null)}>
              <FiX />
            </button>
            <img 
              src={`data:${viewingPhotos[currentPhotoIndex].file_type};base64,${viewingPhotos[currentPhotoIndex].file_data}`} 
              alt={`Photo ${currentPhotoIndex + 1}`}
            />
            <p>{viewingPhotos[currentPhotoIndex].file_name}</p>
            {viewingPhotos.length > 1 && (
              <div className="photo-navigation">
                <button 
                  onClick={() => setCurrentPhotoIndex((currentPhotoIndex - 1 + viewingPhotos.length) % viewingPhotos.length)}
                  className="nav-btn"
                >
                  ← Previous
                </button>
                <span>{currentPhotoIndex + 1} / {viewingPhotos.length}</span>
                <button 
                  onClick={() => setCurrentPhotoIndex((currentPhotoIndex + 1) % viewingPhotos.length)}
                  className="nav-btn"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="passport-tabs">
        <button 
          className={`tab-btn ${activeTab === 'receive' ? 'active' : ''}`}
          onClick={() => setActiveTab('receive')}
        >
          <FiDownload />
          📥 Receive Passport
        </button>
        <button 
          className={`tab-btn ${activeTab === 'send' ? 'active' : ''}`}
          onClick={() => setActiveTab('send')}
        >
          <FiUpload />
          📤 Send Passport
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <FiClock />
          📜 Movement History
          {movements.length > 0 && <span className="badge">{movements.length}</span>}
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* RECEIVE TAB */}
        {activeTab === 'receive' && (
          <div className="tab-panel">
            <div className="panel-header">
              <h3>📥 Record Passport Receipt</h3>
              <p>Track when and how passport was received</p>
            </div>

            <form onSubmit={handleReceiveSubmit} className="movement-form">
              {/* 5-Column Grid */}
              <div className="form-grid">
                <div className="form-group">
                  <label><FiUserCheck /> RECEIVED FROM *</label>
                  <select 
                    value={receiveForm.received_from}
                    onChange={(e) => setReceiveForm(prev => ({ ...prev, received_from: e.target.value }))}
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
                    value={receiveForm.method}
                    onChange={(e) => setReceiveForm(prev => ({ ...prev, method: e.target.value }))}
                    required
                  >
                    <option value="By Hand">✋ By Hand</option>
                    <option value="By Courier">📮 By Courier</option>
                  </select>
                </div>

                {receiveForm.method === 'By Courier' && (
                  <div className="form-group">
                    <label><FiPackage /> COURIER NUMBER *</label>
                    <input 
                      type="text"
                      value={receiveForm.courier_number}
                      onChange={(e) => setReceiveForm(prev => ({ ...prev, courier_number: e.target.value }))}
                      placeholder="Tracking number"
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label><FiCalendar /> DATE RECEIVED *</label>
                  <input 
                    type="date"
                    value={receiveForm.date}
                    onChange={(e) => setReceiveForm(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
  <label><FiUser /> RECEIVED BY (STAFF) *</label>
  <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
    {/* Toggle Button */}
    <button
      type="button"
      onClick={() => setReceiveForm(prev => ({ 
        ...prev, 
        useCustomReceivedBy: !prev.useCustomReceivedBy 
      }))}
      style={{
        padding: '0 15px',
        background: receiveForm.useCustomReceivedBy ? '#00c9ff' : '#2a2a3e',
        border: '1px solid #00c9ff',
        borderRadius: '4px',
        color: 'white',
        cursor: 'pointer',
        fontSize: '0.85rem',
        whiteSpace: 'nowrap',
        transition: 'all 0.3s ease'
      }}
      title={receiveForm.useCustomReceivedBy ? 'Switch to dropdown' : 'Switch to custom input'}
    >
      {receiveForm.useCustomReceivedBy ? '📋 Dropdown' : '✏️ Custom'}
    </button>
    
    {/* Dropdown or Text Input */}
    {!receiveForm.useCustomReceivedBy ? (
      <select 
        value={receiveForm.received_by}
        onChange={(e) => setReceiveForm(prev => ({ ...prev, received_by: e.target.value }))}
        required
        style={{ flex: 1 }}
      >
        <option value="">-- Select Staff --</option>
        {user?.fullName && (
          <option value={user.fullName}>
            👤 {user.fullName} (You)
          </option>
        )}
        {staffList
          .filter(name => name !== user?.fullName)
          .map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))
        }
      </select>
    ) : (
      <input 
        type="text"
        value={receiveForm.received_by}
        onChange={(e) => setReceiveForm(prev => ({ ...prev, received_by: e.target.value }))}
        placeholder="Enter staff name manually"
        required
        style={{ flex: 1 }}
      />
    )}
  </div>
</div>


                {/* Full Width Notes */}
                <div className="form-group full-width">
                  <label><FiFileText /> NOTES</label>
                  <textarea 
                    value={receiveForm.notes}
                    onChange={(e) => setReceiveForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows="3"
                    placeholder="Additional remarks..."
                  />
                </div>
              </div>

              {/* Photo Upload Section - Multiple */}
              <div className="photo-section">
                <label><FiImage /> ATTACH PHOTOS (OPTIONAL - MULTIPLE ALLOWED)</label>
                {receiveForm.photoPreviews.length === 0 ? (
                  <div className="photo-upload-area">
                    <input 
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoSelect(e, 'receive')}
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
                    {receiveForm.photoPreviews.map((preview, index) => (
                      <div key={index} className="photo-thumbnail">
                        <img src={preview} alt={`Preview ${index + 1}`} />
                        <button 
                          type="button"
                          className="remove-thumbnail-btn"
                          onClick={() => removePhoto(index, 'receive')}
                        >
                          <FiX />
                        </button>
                      </div>
                    ))}
                    <div className="add-more-photos">
                      <input 
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoSelect(e, 'receive')}
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
        )}

        {/* SEND TAB */}
        {activeTab === 'send' && (
          <div className="tab-panel">
            <div className="panel-header">
              <h3>📤 Record Passport Dispatch</h3>
              <p>Track when and where passport was sent</p>
            </div>

            <form onSubmit={handleSendSubmit} className="movement-form">
              {/* 5-Column Grid */}
              <div className="form-grid">
                <div className="form-group">
                  <label><FiMapPin /> SEND TO *</label>
                  <select 
                    value={sendForm.send_to}
                    onChange={(e) => setSendForm(prev => ({ ...prev, send_to: e.target.value }))}
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
                    value={sendForm.send_to_name}
                    onChange={(e) => setSendForm(prev => ({ ...prev, send_to_name: e.target.value }))}
                    placeholder="Person/Organization name"
                  />
                </div>

                <div className="form-group">
                  <label><FiPhone /> RECIPIENT CONTACT</label>
                  <input 
                    type="text"
                    value={sendForm.send_to_contact}
                    onChange={(e) => setSendForm(prev => ({ ...prev, send_to_contact: e.target.value }))}
                    placeholder="Phone/Email"
                  />
                </div>

                <div className="form-group">
                  <label><FiTruck /> DELIVERY METHOD *</label>
                  <select 
                    value={sendForm.method}
                    onChange={(e) => setSendForm(prev => ({ ...prev, method: e.target.value }))}
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
                    value={sendForm.date}
                    onChange={(e) => setSendForm(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>

                {sendForm.method === 'By Courier' && (
                  <div className="form-group full-width">
                    <label><FiPackage /> COURIER TRACKING NUMBER *</label>
                    <input 
                      type="text"
                      value={sendForm.courier_number}
                      onChange={(e) => setSendForm(prev => ({ ...prev, courier_number: e.target.value }))}
                      placeholder="Enter tracking/docket number"
                      required
                    />
                  </div>
                )}

                <div className="form-group">
  <label><FiUser /> SENT BY (STAFF) *</label>
  <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
    {/* Toggle Button */}
    <button
      type="button"
      onClick={() => setSendForm(prev => ({ 
        ...prev, 
        useCustomSentBy: !prev.useCustomSentBy 
      }))}
      style={{
        padding: '0 15px',
        background: sendForm.useCustomSentBy ? '#00c9ff' : '#2a2a3e',
        border: '1px solid #00c9ff',
        borderRadius: '4px',
        color: 'white',
        cursor: 'pointer',
        fontSize: '0.85rem',
        whiteSpace: 'nowrap',
        transition: 'all 0.3s ease'
      }}
      title={sendForm.useCustomSentBy ? 'Switch to dropdown' : 'Switch to custom input'}
    >
      {sendForm.useCustomSentBy ? '📋 Dropdown' : '✏️ Custom'}
    </button>
    
    {/* Dropdown or Text Input */}
    {!sendForm.useCustomSentBy ? (
      <select 
        value={sendForm.sent_by}
        onChange={(e) => setSendForm(prev => ({ ...prev, sent_by: e.target.value }))}
        required
        style={{ flex: 1 }}
      >
        <option value="">-- Select Staff --</option>
        {user?.fullName && (
          <option value={user.fullName}>
            👤 {user.fullName} (You)
          </option>
        )}
        {staffList
          .filter(name => name !== user?.fullName)
          .map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))
        }
      </select>
    ) : (
      <input 
        type="text"
        value={sendForm.sent_by}
        onChange={(e) => setSendForm(prev => ({ ...prev, sent_by: e.target.value }))}
        placeholder="Enter staff name manually"
        required
        style={{ flex: 1 }}
      />
    )}
  </div>
</div>


                <div className="form-group full-width">
                  <label><FiFileText /> NOTES</label>
                  <textarea 
                    value={sendForm.notes}
                    onChange={(e) => setSendForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows="3"
                    placeholder="Additional remarks..."
                  />
                </div>
              </div>

              {/* Photo Upload - Multiple */}
              <div className="photo-section">
                <label><FiImage /> ATTACH PHOTOS (OPTIONAL - MULTIPLE ALLOWED)</label>
                {sendForm.photoPreviews.length === 0 ? (
                  <div className="photo-upload-area">
                    <input 
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoSelect(e, 'send')}
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
                    {sendForm.photoPreviews.map((preview, index) => (
                      <div key={index} className="photo-thumbnail">
                        <img src={preview} alt={`Preview ${index + 1}`} />
                        <button 
                          type="button"
                          className="remove-thumbnail-btn"
                          onClick={() => removePhoto(index, 'send')}
                        >
                          <FiX />
                        </button>
                      </div>
                    ))}
                    <div className="add-more-photos">
                      <input 
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoSelect(e, 'send')}
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
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="tab-panel">
            <div className="panel-header">
              <h3>📜 Movement History</h3>
              <p>Complete timeline of passport movements</p>
            </div>

            {movements.length === 0 ? (
              <div className="empty-state">
                <FiPackage style={{ fontSize: '4rem', opacity: 0.2 }} />
                <p>No movements recorded yet</p>
                <div className="empty-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => setActiveTab('receive')}
                  >
                    📥 Record Receipt
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setActiveTab('send')}
                  >
                    📤 Record Dispatch
                  </button>
                </div>
              </div>
            ) : (
              <div className="movements-timeline">
                {movements.map((movement) => (
                  <div 
                    key={movement.id} 
                    className={`timeline-item ${movement.type.toLowerCase()}`}
                  >
                    <div className="timeline-marker">
                      {movement.type === 'RECEIVE' ? '📥' : '📤'}
                    </div>

                    <div className="timeline-content">
                      <div className="timeline-header">
                        <div>
                          <h4>
                            {movement.type === 'RECEIVE' ? '📥 PASSPORT RECEIVED' : '📤 PASSPORT SENT'}
                          </h4>
                          <span className="timeline-date">
                            <FiCalendar />
                            {movement.date}
                          </span>
                        </div>
                        <div className="timeline-actions">
                          {movement.has_photos && (
                            <button 
                              className="icon-btn"
                              onClick={() => handleViewPhotos(movement.id)}
                              title="View Photos"
                            >
                              <FiEye />
                            </button>
                          )}
                          <button 
                            className="icon-btn danger"
                            onClick={() => handleDelete(movement.id)}
                            title="Delete"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>

                      <div className="timeline-details">
                        {movement.type === 'RECEIVE' ? (
                          <>
                            <div className="detail-item">
                              <strong>From:</strong>
                              <span>{movement.received_from}</span>
                            </div>
                            <div className="detail-item">
                              <strong>Received By:</strong>
                              <span>👤 {movement.received_by}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="detail-item">
                              <strong>To:</strong>
                              <span>{movement.send_to}</span>
                            </div>
                            {movement.send_to_name && (
                              <div className="detail-item">
                                <strong>Name:</strong>
                                <span>{movement.send_to_name}</span>
                              </div>
                            )}
                            {movement.send_to_contact && (
                              <div className="detail-item">
                                <strong>Contact:</strong>
                                <span>📞 {movement.send_to_contact}</span>
                              </div>
                            )}
                            <div className="detail-item">
                              <strong>Sent By:</strong>
                              <span>👤 {movement.sent_by}</span>
                            </div>
                          </>
                        )}

                        <div className="detail-item">
                          <strong>Method:</strong>
                          <span>
                            {movement.method === 'By Hand' ? '✋ By Hand' : '📮 By Courier'}
                            {movement.courier_number && ` • #${movement.courier_number}`}
                          </span>
                        </div>

                        {movement.notes && (
                          <div className="timeline-notes">
                            <strong>📝 Notes:</strong>
                            <p>{movement.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CandidatePassport;
