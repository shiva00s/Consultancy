import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiSend, FiPlus, FiTrash2, FiDownload, FiMapPin, FiEdit2, FiSave, FiX } from 'react-icons/fi';
import { readFileAsBuffer } from '../../utils/file';
import toast from 'react-hot-toast';
import ConfirmDialog from '../common/ConfirmDialog';
import '../../css/CandidateTravel.css';

const initialTravelForm = {
  pnr: '',
  travel_date: '',
  ticket_file: null,
  departure_city: '',
  arrival_city: '',
  notes: '',
};

function CandidateTravel({ user, candidateId, candidateName }) {
  const [travelEntries, setTravelEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [travelForm, setTravelForm] = useState(initialTravelForm);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, travelId: null });
  const fileInputRef = useRef(null);

  const fetchTravelTracking = useCallback(async () => {
    setLoading(true);
    const res = await window.electronAPI.getTravelTracking({ candidateId });
    if (res.success) setTravelEntries(res.data || []);
    setLoading(false);
  }, [candidateId]);

  useEffect(() => {
    fetchTravelTracking();
  }, [candidateId, fetchTravelTracking]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setTravelForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setTravelForm((prev) => ({
      ...prev,
      ticket_file: e.target.files[0] || null,
    }));
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!travelForm.travel_date || !travelForm.departure_city || !travelForm.arrival_city) {
      toast.error('⚠️ Travel Date, Departure, and Arrival cities are required.');
      return;
    }

    setIsSaving(true);
    let ticket_file_path = '';
    const toastId = toast.loading('⏳ Saving travel entry...');

    try {
      if (travelForm.ticket_file) {
        toast.loading('📤 Uploading ticket file...', { id: toastId });
        const buffer = await readFileAsBuffer(travelForm.ticket_file);
        const fileData = {
          name: travelForm.ticket_file.name,
          type: travelForm.ticket_file.type,
          buffer: buffer,
          category: 'Travel',
        };
        const docRes = await window.electronAPI.addDocuments({
          user,
          candidateId,
          files: [fileData],
        });
        if (docRes.success && docRes.newDocs.length > 0) {
          ticket_file_path = docRes.newDocs[0].filePath;
        } else {
          throw new Error(docRes.error || 'Failed to upload ticket file.');
        }
      }

      const data = {
        ...travelForm,
        candidate_id: candidateId,
        ticket_file_path: ticket_file_path,
      };

      const res = await window.electronAPI.addTravelEntry({ user, data });
      if (res.success) {
        setTravelEntries((prev) => [res.data, ...prev]);
        setTravelForm(initialTravelForm);
        if (fileInputRef.current) fileInputRef.current.value = null;
        toast.success('✅ Travel entry saved successfully!', { id: toastId });

        try {
          await window.electronAPI.createReminder({
            userId: user.id,
            candidateId,
            module: 'travel',
            title: '🧳 Travel scheduled',
            message: `${candidateName || 'Candidate'} traveling from ${travelForm.departure_city} to ${travelForm.arrival_city} on ${travelForm.travel_date}`,
            remindAt: new Date(travelForm.travel_date).toISOString(),
          });
        } catch (err) {
          console.error('createReminder (travel) failed:', err);
        }
      } else {
        toast.error('❌ ' + (res.error || 'Failed to save travel entry'), { id: toastId });
      }
    } catch (err) {
      console.error('addTravelEntry error:', err);
      toast.error(`❌ Error: ${err.message}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  // ===== INLINE EDIT FUNCTIONS =====
  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditData({
      pnr: entry.pnr || '',
      travel_date: entry.travel_date || '',
      departure_city: entry.departure_city || '',
      arrival_city: entry.arrival_city || '',
      notes: entry.notes || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const saveEdit = async (id) => {
    if (!editData.travel_date || !editData.departure_city || !editData.arrival_city) {
      toast.error('⚠️ Travel Date, Departure, and Arrival are required.');
      return;
    }

    const toastId = toast.loading('💾 Updating travel entry...');
    const res = await window.electronAPI.updateTravelEntry({
      user,
      id,
      data: editData,
    });

    if (res.success) {
      setTravelEntries((prev) => prev.map((t) => (t.id === id ? res.data : t)));
      setEditingId(null);
      setEditData({});
      toast.success('✅ Travel entry updated!', { id: toastId });
    } else {
      toast.error('❌ ' + (res.error || 'Update failed'), { id: toastId });
    }
  };

  // ===== DELETE WITH CONFIRM DIALOG =====
  const handleDeleteClick = (id) => {
    setConfirmDialog({ isOpen: true, travelId: id });
  };

  const confirmDelete = async () => {
    const id = confirmDialog.travelId;
    setConfirmDialog({ isOpen: false, travelId: null });

    const res = await window.electronAPI.deleteTravelEntry({ user, id });
    if (res.success) {
      setTravelEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success('✅ Travel entry moved to Recycle Bin.');
    } else {
      toast.error('❌ ' + (res.error || 'Failed to delete travel entry'));
    }
  };

  const cancelDelete = () => {
    setConfirmDialog({ isOpen: false, travelId: null });
  };

  const openFile = (filePath) => {
    window.electronAPI.openFileExternally({ path: filePath });
  };

  if (loading) return <div className="loading-state">⏳ Loading travel tracking...</div>;

  return (
    <div className="travel-tracking-content">
      {/* ===== ADD FORM ===== */}
      <div className="form-container">
        <h3>✈️ Add Travel Entry</h3>
        <form onSubmit={handleAddEntry} className="travel-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="pnr">🎫 PNR Number</label>
              <input
                type="text"
                id="pnr"
                name="pnr"
                placeholder="Enter PNR"
                value={travelForm.pnr}
                onChange={handleFormChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="travel_date">📅 Travel Date *</label>
              <input
                type="date"
                id="travel_date"
                name="travel_date"
                value={travelForm.travel_date}
                onChange={handleFormChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="departure_city">🛫 Departure City *</label>
              <input
                type="text"
                id="departure_city"
                name="departure_city"
                placeholder="From"
                value={travelForm.departure_city}
                onChange={handleFormChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="arrival_city">🛬 Arrival City *</label>
              <input
                type="text"
                id="arrival_city"
                name="arrival_city"
                placeholder="To"
                value={travelForm.arrival_city}
                onChange={handleFormChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="ticket_file">📎 Ticket File</label>
            <input
              type="file"
              id="ticket_file"
              name="ticket_file"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="notes">📝 Notes</label>
            <textarea
              id="notes"
              name="notes"
              placeholder="Additional notes"
              rows="3"
              value={travelForm.notes}
              onChange={handleFormChange}
            />
          </div>

          <button type="submit" className="btn-full-width" disabled={isSaving}>
            <FiPlus /> {isSaving ? 'Saving...' : 'Add Travel Entry'}
          </button>
        </form>
      </div>

      {/* ===== TRAVEL LIST ===== */}
      <div className="list-container">
        <h3>🗂️ Travel History</h3>
        {travelEntries.length === 0 ? (
          <p className="empty-state">ℹ️ No travel records found.</p>
        ) : (
          <div className="travel-list">
            {travelEntries.map((entry) => (
              <div key={entry.id} className="travel-item">
                <div className="item-icon">
                  <FiMapPin />
                </div>

                {editingId === entry.id ? (
                  // ===== INLINE EDIT MODE =====
                  <div className="item-details edit-mode">
                    <div className="edit-row">
                      <div className="edit-field">
                        <label>🎫 PNR</label>
                        <input
                          type="text"
                          name="pnr"
                          value={editData.pnr}
                          onChange={handleEditChange}
                          placeholder="PNR"
                        />
                      </div>
                      <div className="edit-field">
                        <label>📅 Travel Date *</label>
                        <input
                          type="date"
                          name="travel_date"
                          value={editData.travel_date}
                          onChange={handleEditChange}
                          required
                        />
                      </div>
                    </div>

                    <div className="edit-row">
                      <div className="edit-field">
                        <label>🛫 Departure *</label>
                        <input
                          type="text"
                          name="departure_city"
                          value={editData.departure_city}
                          onChange={handleEditChange}
                          placeholder="From"
                          required
                        />
                      </div>
                      <div className="edit-field">
                        <label>🛬 Arrival *</label>
                        <input
                          type="text"
                          name="arrival_city"
                          value={editData.arrival_city}
                          onChange={handleEditChange}
                          placeholder="To"
                          required
                        />
                      </div>
                    </div>

                    <div className="edit-field-full">
                      <label>📝 Notes</label>
                      <textarea
                        name="notes"
                        value={editData.notes}
                        onChange={handleEditChange}
                        placeholder="Notes"
                        rows="2"
                      />
                    </div>
                  </div>
                ) : (
                  // ===== VIEW MODE =====
                  <div className="item-details">
                    <strong>
                      {entry.departure_city} → {entry.arrival_city}
                    </strong>
                    <p>📅 Date: {entry.travel_date} | 🎫 PNR: {entry.pnr || 'N/A'}</p>
                    {entry.notes && <p>📝 Notes: {entry.notes}</p>}
                    {entry.ticket_file_path && (
                      <small>
                        📎{' '}
                        <span
                          className="file-link"
                          onClick={() => openFile(entry.ticket_file_path)}
                        >
                          View Ticket
                        </span>
                      </small>
                    )}
                  </div>
                )}

                <div className="item-actions">
                  {editingId === entry.id ? (
                    <>
                      <button
                        className="btn-save"
                        onClick={() => saveEdit(entry.id)}
                        title="Save"
                      >
                        <FiSave /> Save
                      </button>
                      <button
                        className="btn-cancel"
                        onClick={cancelEdit}
                        title="Cancel"
                      >
                        <FiX /> Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(entry)} title="Edit">
                        <FiEdit2 />
                      </button>
                      <button onClick={() => handleDeleteClick(entry.id)} title="Delete">
                        <FiTrash2 />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== CONFIRM DIALOG ===== */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="🗑️ Delete Travel Entry"
        message="Are you sure you want to move this travel entry to the Recycle Bin?"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}

export default CandidateTravel;
