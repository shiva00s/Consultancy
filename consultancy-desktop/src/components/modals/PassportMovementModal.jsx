// FILE: src/components/modals/PassportMovementModal.jsx
// ✅ MODAL FOR ADDING/EDITING PASSPORT MOVEMENTS

import React, { useState, useEffect } from 'react';
import { FiX, FiUpload, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';

const initialForm = {
  type: 'RECEIVE',
  method: 'By Hand',
  courier_number: '',
  date: new Date().toISOString().split('T')[0],
  notes: '',
  received_from: 'Candidate',
  received_by: '',
  send_to: 'Candidate',
  send_to_name: '',
  send_to_contact: '',
  sent_by: '',
};

function PassportMovementModal({ user, candidateId, candidateData, editingMovement, onClose, onSave }) {
  const [form, setForm] = useState(initialForm);
  const [staffList, setStaffList] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load editing data
  useEffect(() => {
    if (editingMovement) {
      setForm({
        type: editingMovement.type,
        method: editingMovement.method,
        courier_number: editingMovement.courier_number || '',
        date: editingMovement.date,
        notes: editingMovement.notes || '',
        received_from: editingMovement.received_from || 'Candidate',
        received_by: editingMovement.received_by || '',
        send_to: editingMovement.send_to || 'Candidate',
        send_to_name: editingMovement.send_to_name || '',
        send_to_contact: editingMovement.send_to_contact || '',
        sent_by: editingMovement.sent_by || '',
      });
    } else {
      // Pre-fill staff name for new entry
      if (user?.fullName) {
        setForm(prev => ({
          ...prev,
          received_by: user.fullName,
          sent_by: user.fullName,
        }));
      }
    }
  }, [editingMovement, user]);

  // Fetch staff list
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        if (window.electronAPI && window.electronAPI.getUsers) {
          const result = await window.electronAPI.getUsers({ user });
          if (result.success && result.data) {
            const names = result.data.map(u => u.fullName).filter(Boolean);
            setStaffList(names);
          }
        } else {
          // Fallback: Use logged-in user's name
          if (user?.fullName) {
            setStaffList([user.fullName]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch staff:', error);
        if (user?.fullName) {
          setStaffList([user.fullName]);
        }
      }
    };
    fetchStaff();
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setSelectedPhoto(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setSelectedPhoto(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!form.date) {
      toast.error('Date is required');
      return;
    }

    if (form.type === 'RECEIVE' && !form.received_by) {
      toast.error('Received By is required');
      return;
    }

    if (form.type === 'SEND') {
      if (!form.sent_by) {
        toast.error('Sent By is required');
        return;
      }
    }

    if (form.method === 'By Courier' && !form.courier_number) {
      toast.error('Courier number is required');
      return;
    }

    setIsSaving(true);

    try {
      const data = { ...form, candidate_id: candidateId };

      let res;
      if (editingMovement) {
        // Update
        res = await window.electronAPI.updatePassportMovement({ 
          id: editingMovement.id, 
          data, 
          user 
        });
      } else {
        // Create
        res = await window.electronAPI.addPassportMovement({ data, user });
      }

      if (res.success) {
        // Upload photo if selected
        if (selectedPhoto && res.data?.id) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const photoData = {
              movement_id: res.data.id,
              file_name: selectedPhoto.name,
              file_type: selectedPhoto.type,
              file_data: reader.result.split(',')[1], // Base64 without prefix
            };

            const photoRes = await window.electronAPI.addPassportMovementPhoto({ 
              data: photoData, 
              user 
            });

            if (photoRes.success) {
              res.data.has_photos = true;
            }
          };
          reader.readAsDataURL(selectedPhoto);
        }

        toast.success(editingMovement ? 'Movement updated!' : 'Movement recorded!');
        onSave(res.data);
      } else {
        toast.error(res.error || 'Failed to save movement');
      }
    } catch (error) {
      console.error('Error saving movement:', error);
      toast.error('An error occurred');
    }

    setIsSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editingMovement ? 'Edit Movement' : 'Record Passport Movement'}</h3>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Candidate Info (Read-only) */}
            <div className="info-box">
              <div className="info-row">
                <strong>Candidate:</strong> {candidateData?.name}
              </div>
              <div className="info-row">
                <strong>Passport:</strong> {candidateData?.passportNo || 'N/A'}
              </div>
              {candidateData?.Position && (
                <div className="info-row">
                  <strong>Position:</strong> {candidateData.Position}
                </div>
              )}
            </div>

            {/* Movement Type */}
            <div className="form-group">
              <label>Action Type *</label>
              <select name="type" value={form.type} onChange={handleChange} required>
                <option value="RECEIVE">Received</option>
                <option value="SEND">Sent</option>
              </select>
            </div>

            {/* RECEIVE FIELDS */}
            {form.type === 'RECEIVE' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Received From *</label>
                    <select name="received_from" value={form.received_from} onChange={handleChange} required>
                      <option value="Candidate">Candidate</option>
                      <option value="Agent">Agent</option>
                      <option value="Embassy">Embassy</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Received By (Staff) *</label>
                    {staffList.length > 0 ? (
                      <select name="received_by" value={form.received_by} onChange={handleChange} required>
                        <option value="">Select Staff</option>
                        {staffList.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        name="received_by" 
                        value={form.received_by} 
                        onChange={handleChange}
                        placeholder="Staff name"
                        required
                      />
                    )}
                  </div>
                </div>
              </>
            )}

            {/* SEND FIELDS */}
            {form.type === 'SEND' && (
              <>
                <div className="form-group">
                  <label>Send To *</label>
                  <select name="send_to" value={form.send_to} onChange={handleChange} required>
                    <option value="Candidate">Candidate</option>
                    <option value="Agent">Agent</option>
                    <option value="Embassy">Embassy</option>
                    <option value="Employer">Employer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Recipient Name</label>
                    <input 
                      type="text" 
                      name="send_to_name" 
                      value={form.send_to_name} 
                      onChange={handleChange}
                      placeholder="Person/Organization name"
                    />
                  </div>

                  <div className="form-group">
                    <label>Recipient Contact</label>
                    <input 
                      type="text" 
                      name="send_to_contact" 
                      value={form.send_to_contact} 
                      onChange={handleChange}
                      placeholder="Phone/Email"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Sent By (Staff) *</label>
                  {staffList.length > 0 ? (
                    <select name="sent_by" value={form.sent_by} onChange={handleChange} required>
                      <option value="">Select Staff</option>
                      {staffList.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      name="sent_by" 
                      value={form.sent_by} 
                      onChange={handleChange}
                      placeholder="Staff name"
                      required
                    />
                  )}
                </div>
              </>
            )}

            {/* Common Fields */}
            <div className="form-row">
              <div className="form-group">
                <label>Method *</label>
                <select name="method" value={form.method} onChange={handleChange} required>
                  <option value="By Hand">By Hand</option>
                  <option value="By Courier">By Courier</option>
                </select>
              </div>

              <div className="form-group">
                <label>Date *</label>
                <input 
                  type="date" 
                  name="date" 
                  value={form.date} 
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {form.method === 'By Courier' && (
              <div className="form-group">
                <label>Courier Tracking Number *</label>
                <input 
                  type="text" 
                  name="courier_number" 
                  value={form.courier_number} 
                  onChange={handleChange}
                  placeholder="Enter tracking/docket number"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label>Notes</label>
              <textarea 
                name="notes" 
                value={form.notes} 
                onChange={handleChange}
                rows="3"
                placeholder="Additional remarks"
              />
            </div>

            {/* Photo Upload */}
            {!editingMovement && (
              <div className="form-group">
                <label>Attach Photo (Optional)</label>
                {!photoPreview ? (
                  <div className="photo-upload-area">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoSelect}
                      id="photoUpload"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="photoUpload" className="upload-label">
                      <FiUpload />
                      <span>Click to upload photo (Max 5MB)</span>
                    </label>
                  </div>
                ) : (
                  <div className="photo-preview">
                    <img src={photoPreview} alt="Preview" />
                    <button 
                      type="button" 
                      className="remove-photo-btn" 
                      onClick={handleRemovePhoto}
                    >
                      <FiTrash2 /> Remove
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : (editingMovement ? 'Update Movement' : 'Save Movement')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PassportMovementModal;
