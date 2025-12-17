import React, { useEffect, useState } from 'react';
import { FiBriefcase, FiPlus, FiEdit2, FiTrash2, FiX, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../css/JobOrderListPage.css';
import '../css/EmployerListPage.css';
import useDataStore from '../store/dataStore';
import { useShallow } from 'zustand/react/shallow';
import useAuthStore from '../store/useAuthStore';
import ConfirmDialog from '../components/ConfirmDialog';

function EmployerListPage() {
  const initialForm = {
    companyName: '',
    country: '',
    contactPerson: '',
    position: '',
    contactEmail: '',
    notes: '',
  };

  const {
    employers,
    isLoaded,
    addEmployer,
    updateEmployer,
    deleteEmployer,
  } = useDataStore(
    useShallow((state) => ({
      employers: state.employers,
      isLoaded: state.isLoaded,
      addEmployer: state.addEmployer,
      updateEmployer: state.updateEmployer,
      deleteEmployer: state.deleteEmployer,
    })),
  );

  const { user } = useAuthStore(
    useShallow((state) => ({ user: state.user })),
  );

  const [activeTab, setActiveTab] = useState('add');

  // ADD TAB
  const [addForm, setAddForm] = useState(initialForm);
  const [addErrors, setAddErrors] = useState({});
  const [addSaving, setAddSaving] = useState(false);

  // VIEW TAB
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewForm, setViewForm] = useState(initialForm);
  const [viewErrors, setViewErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [viewSaving, setViewSaving] = useState(false);

  const selectedEmployer = employers[selectedIndex] || null;
  const employerCount = employers.length;

  // confirm delete dialog state
  const [confirmDeleteState, setConfirmDeleteState] = useState({
    open: false,
    employerId: null,
    employerName: '',
  });

  const validate = (data, setErr) => {
    const errs = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!data.companyName || data.companyName.trim() === '') {
      errs.companyName = 'Company Name is required.';
    }
    if (data.contactEmail && !emailRegex.test(data.contactEmail)) {
      errs.contactEmail = 'Enter a valid email.';
    }
    setErr(errs);
    return Object.keys(errs).length === 0;
  };

  const syncSelectedToForm = (idx) => {
    const emp = employers[idx];
    if (!emp) {
      setViewForm(initialForm);
      return;
    }
    setViewForm({
      companyName: emp.companyName || '',
      country: emp.country || '',
      contactPerson: emp.contactPerson || '',
      position: emp.position || '',
      contactEmail: emp.contactEmail || '',
      notes: emp.notes || '',
    });
  };

  // keep viewForm in sync when employers change (e.g. after add/delete)
  useEffect(() => {
    if (activeTab === 'list') {
      if (employers.length === 0) {
        setSelectedIndex(0);
        setViewForm(initialForm);
        setIsEditing(false);
      } else if (selectedIndex >= employers.length) {
        setSelectedIndex(0);
        syncSelectedToForm(0);
      } else {
        syncSelectedToForm(selectedIndex);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employers, activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'list') {
      setViewErrors({});
      setIsEditing(false);
      if (employers.length > 0) {
        syncSelectedToForm(selectedIndex);
      } else {
        setViewForm(initialForm);
      }
    }
  };

  // ADD handlers
  const onAddChange = (e) => {
    const { name, value } = e.target;
    setAddForm((p) => ({ ...p, [name]: value }));
    if (addErrors[name]) setAddErrors((p) => ({ ...p, [name]: null }));
  };

  const onAddSubmit = async (e) => {
    e.preventDefault();
    if (!validate(addForm, setAddErrors)) {
      toast.error('Fix errors before saving.');
      return;
    }
    setAddSaving(true);
    const res = await window.electronAPI.addEmployer({ user, data: addForm });
    if (res.success) {
      addEmployer(res.data);
      setAddForm(initialForm);
      setAddErrors({});
      toast.success('Employer added successfully!');
    } else {
      toast.error(res.error || 'Add failed.');
    }
    setAddSaving(false);
  };

  // VIEW handlers
  const onViewChange = (e) => {
    const { name, value } = e.target;
    setViewForm((p) => ({ ...p, [name]: value }));
    if (viewErrors[name]) setViewErrors((p) => ({ ...p, [name]: null }));
  };

  const onEmployerSelect = (e) => {
    const idx = Number(e.target.value);
    setSelectedIndex(idx);
    syncSelectedToForm(idx);
    setViewErrors({});
    setIsEditing(false);
  };

  const startEdit = () => {
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    syncSelectedToForm(selectedIndex);
    setViewErrors({});
  };

  const saveEdit = async (e) => {
  e.preventDefault();
  if (!selectedEmployer) return;
  if (!validate(viewForm, setViewErrors)) {
    toast.error('Fix errors before saving.');
    return;
  }
  setViewSaving(true);
  const res = await window.electronAPI.updateEmployer({
    user,
    id: selectedEmployer.id,
    data: viewForm,
  });
  if (res.success) {
    updateEmployer(res.data); // Update the global store

    // SYNC local form immediately with database response
    setViewForm({
      companyName: res.data.companyName || '',
      country: res.data.country || '',
      contactPerson: res.data.contactPerson || '',
      position: res.data.position || '',
      contactEmail: res.data.contactEmail || '',
      notes: res.data.notes || '',
    });
    
    toast.success(`Employer "${res.data.companyName}" updated successfully.`);
    setIsEditing(false);
    setViewErrors({});
  } else {
    toast.error(res.error || 'Update failed.');
  }
  setViewSaving(false);
};


  // open confirm dialog
  const onDeleteClick = () => {
    if (!selectedEmployer) return;
    setConfirmDeleteState({
      open: true,
      employerId: selectedEmployer.id,
      employerName: selectedEmployer.companyName,
    });
  };

  // confirm delete from dialog
  const handleConfirmDelete = async () => {
    const { employerId, employerName } = confirmDeleteState;
    setConfirmDeleteState({ open: false, employerId: null, employerName: '' });

    if (!employerId) return;

    const res = await window.electronAPI.deleteEmployer({
      user,
      id: employerId,
    });
    if (res.success) {
      deleteEmployer(employerId);
      toast.success(`Employer "${employerName}" moved to Recycle Bin.`);
    } else {
      toast.error(res.error || 'Delete failed.');
    }
  };

  const handleCancelDelete = () => {
    setConfirmDeleteState({ open: false, employerId: null, employerName: '' });
  };

  if (!isLoaded) {
    return (
      <div className="job-page-container">
        <p className="empty-text">
          <span className="emoji-inline">⏳</span> Loading employers...
        </p>
      </div>
    );
  }

  return (
    <div className="job-page-container fade-in">
      <header className="job-page-header">
        <h1>
          <span className="emoji-inline">🏢</span> Employer Management
        </h1>
      </header>

      <div className="job-tabs">
        <button
          type="button"
          className={`job-tab ${activeTab === 'add' ? 'job-tab-active' : ''}`}
          onClick={() => handleTabChange('add')}
        >
          <FiPlus /> <span className="emoji-inline">✨</span> Add New
        </button>
        <button
          type="button"
          className={`job-tab ${
            activeTab === 'list' ? 'job-tab-active' : ''
          }`}
          onClick={() => handleTabChange('list')}
        >
          <FiBriefcase /> <span className="emoji-inline">📊</span> View/Edit
          <span className="tab-count-pill">
            <span className="emoji-inline">👥</span> {employerCount}
          </span>
        </button>
      </div>

      {/* TAB 1: ADD NEW */}
      {activeTab === 'add' && (
        <section className="job-card-wide job-card-elevated slide-up">
          <div className="job-card-header">
            <div className="job-title-block">
              <div className="job-title">
                <span className="emoji-inline">🏗️</span> New Employer Setup
              </div>
              <div className="job-subtitle">
                <span className="emoji-inline">💡</span> Create a company profile that can be linked to job orders
              </div>
            </div>
          </div>

          <div className="job-card-body">
            <form onSubmit={onAddSubmit}>
              <div className="job-grid-4">
                <div className={`form-group form-group-full ${addErrors.companyName ? 'error' : ''}`}>
                  <label>
                    <span className="emoji-inline">🏢</span> Company Name *
                  </label>
                  <input
                    name="companyName"
                    value={addForm.companyName}
                    onChange={onAddChange}
                    placeholder="🏙️ ACME International"
                    style={addErrors.companyName ? { borderColor: 'red' } : {}}
                  />
                  {addErrors.companyName && (
                    <p className="error-text">{addErrors.companyName}</p>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    <span className="emoji-inline">🌍</span> Country
                  </label>
                  <input
                    name="country"
                    value={addForm.country}
                    onChange={onAddChange}
                    placeholder="🌎 Dubai / Japan / Qatar"
                  />
                </div>

                <div className="form-group">
                  <label>
                    <span className="emoji-inline">🧑‍💼</span> Contact Person
                  </label>
                  <input
                    name="contactPerson"
                    value={addForm.contactPerson}
                    onChange={onAddChange}
                    placeholder="👔 Main decision maker"
                  />
                </div>

                <div className="form-group">
                  <label>
                    <span className="emoji-inline">🏷️</span> Position
                  </label>
                  <input
                    name="position"
                    value={addForm.position}
                    onChange={onAddChange}
                    placeholder="Manager / HR"
                  />
                </div>

                <div className={`form-group ${addErrors.contactEmail ? 'error' : ''}`}>
                  <label>
                    <span className="emoji-inline">📧</span> Contact Email
                  </label>
                  <input
                    name="contactEmail"
                    value={addForm.contactEmail}
                    onChange={onAddChange}
                    placeholder="📨 name@company.com"
                    style={addErrors.contactEmail ? { borderColor: 'red' } : {}}
                  />
                  {addErrors.contactEmail && (
                    <p className="error-text">{addErrors.contactEmail}</p>
                  )}
                </div>

                <div className="form-group form-group-full">
                  <label>
                    <span className="emoji-inline">📝</span> Notes
                  </label>
                  <textarea
                    name="notes"
                    rows={3}
                    value={addForm.notes}
                    onChange={onAddChange}
                    placeholder="💡 Payment terms, VIP handling, reminders..."
                  />
                </div>
              </div>

              <div className="form-footer">
                <button
                  type="submit"
                  className="btn-primary-lg"
                  disabled={addSaving}
                >
                  {addSaving ? (
                    <>
                      <span className="emoji-inline">⏳</span> Saving…
                    </>
                  ) : (
                    <>
                      <span className="emoji-inline">💾</span> Save Employer
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* TAB 2: VIEW / MANAGE */}
      {activeTab === 'list' && (
        <>
          {employerCount === 0 ? (
            <p className="empty-text">
              <span className="emoji-inline">📭</span> No employers available. Create one from the Add New tab.
            </p>
          ) : (
            <section className="job-card-wide job-card-elevated job-card-editing slide-up">
              <div className="job-card-header">
                <div className="job-title-block">
                  <div className="job-title">
                    <span className="emoji-inline">🏢</span>{' '}
                    {viewForm.companyName || 'No Employer Selected'}
                  </div>
                  <div className="job-subtitle">
                    {(viewForm.country || viewForm.contactPerson) && (
                      <>
                        <span className="emoji-inline">🌍</span> {viewForm.country || 'N/A'} •{' '}
                        <span className="emoji-inline">🧑‍💼</span> {viewForm.contactPerson || 'No contact'}
                      </>
                    )}
                  </div>
                </div>

                <div className="job-header-actions">
                  <span className="job-count-chip">
                    <span className="emoji-inline">👥</span> {employerCount} Employers
                  </span>

                  <select
                    className="job-picker-select"
                    value={selectedIndex}
                    onChange={onEmployerSelect}
                    disabled={employers.length === 0}
                  >
                    {employers.length === 0 ? (
                      <option>No employers found</option>
                    ) : (
                      employers.map((e, i) => (
                        <option key={e.id} value={i}>
                          {i + 1}. {e.companyName}
                        </option>
                      ))
                    )}
                  </select>

                  {!isEditing ? (
                    <>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Edit employer"
                        onClick={startEdit}
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        title="Move employer to Recycle Bin"
                        onClick={onDeleteClick}
                        disabled={!selectedEmployer}
                      >
                        <FiTrash2 />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="icon-btn success"
                        title="Save changes"
                        onClick={saveEdit}
                        disabled={viewSaving}
                      >
                        <FiSave />
                      </button>
                      <button
                        type="button"
                        className="icon-btn muted"
                        title="Cancel editing"
                        onClick={cancelEdit}
                        disabled={viewSaving}
                      >
                        <FiX />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="job-card-body">
                {selectedEmployer ? (
                  <form onSubmit={saveEdit} className={isEditing ? 'job-grid-4' : 'read-grid'}>
                    <div className={isEditing ? 'form-group form-group-full' : 'detail-full'}>
                      <label className={isEditing ? '' : 'detail-label'}>
                        <span className="emoji-inline">🏢</span> Company Name
                      </label>
                      {isEditing ? (
                        <>
                          <input
                            name="companyName"
                            value={viewForm.companyName}
                            onChange={onViewChange}
                            placeholder="🏙️ Company name"
                            style={viewErrors.companyName ? { borderColor: 'red' } : {}}
                          />
                          {viewErrors.companyName && (
                            <p className="error-text">{viewErrors.companyName}</p>
                          )}
                        </>
                      ) : (
                        <div className="detail-value">{viewForm.companyName || 'N/A'}</div>
                      )}
                    </div>

                    <div className={isEditing ? 'form-group' : 'detail-item'}>
                      <label className={isEditing ? '' : 'detail-label'}>
                        <span className="emoji-inline">🌍</span> Country
                      </label>
                      {isEditing ? (
                        <input
                          name="country"
                          value={viewForm.country}
                          onChange={onViewChange}
                          placeholder="🌎 Country"
                        />
                      ) : (
                        <div className="detail-value">{viewForm.country || 'N/A'}</div>
                      )}
                    </div>

                    <div className={isEditing ? 'form-group' : 'detail-item'}>
                      <label className={isEditing ? '' : 'detail-label'}>
                        <span className="emoji-inline">🧑‍💼</span> Contact Person
                      </label>
                      {isEditing ? (
                        <input
                          name="contactPerson"
                          value={viewForm.contactPerson}
                          onChange={onViewChange}
                          placeholder="👔 Person in charge"
                        />
                      ) : (
                        <div className="detail-value">{viewForm.contactPerson || 'N/A'}</div>
                      )}
                    </div>

                    <div className={isEditing ? 'form-group' : 'detail-item'}>
                      <label className={isEditing ? '' : 'detail-label'}>
                        <span className="emoji-inline">🏷️</span> Position
                      </label>
                      {isEditing ? (
                        <input
                          name="position"
                          value={viewForm.position}
                          onChange={onViewChange}
                          placeholder="Manager / HR"
                        />
                      ) : (
                        <div className="detail-value">{viewForm.position || 'N/A'}</div>
                      )}
                    </div>

                    <div className={isEditing ? 'form-group' : 'detail-item'}>
                      <label className={isEditing ? '' : 'detail-label'}>
                        <span className="emoji-inline">📧</span> Contact Email
                      </label>
                      {isEditing ? (
                        <>
                          <input
                            name="contactEmail"
                            value={viewForm.contactEmail}
                            onChange={onViewChange}
                            placeholder="📨 Email address"
                            style={viewErrors.contactEmail ? { borderColor: 'red' } : {}}
                          />
                          {viewErrors.contactEmail && (
                            <p className="error-text">{viewErrors.contactEmail}</p>
                          )}
                        </>
                      ) : (
                        <div className="detail-value">{viewForm.contactEmail || 'N/A'}</div>
                      )}
                    </div>

                    <div className={isEditing ? 'form-group form-group-full' : 'detail-full'}>
                      <label className={isEditing ? '' : 'detail-label'}>
                        <span className="emoji-inline">📝</span> Notes
                      </label>
                      {isEditing ? (
                        <textarea
                          name="notes"
                          rows={3}
                          value={viewForm.notes}
                          onChange={onViewChange}
                          placeholder="💡 Any special conditions, communication notes, etc."
                        />
                      ) : (
                        <div className="detail-value">{viewForm.notes || 'N/A'}</div>
                      )}
                    </div>
                  </form>
                ) : (
                  <p className="empty-text">
                    <span className="emoji-inline">📭</span> No employers available. Create one from the Add New tab.
                  </p>
                )}
              </div>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmDeleteState.open}
        title="Move employer to Recycle Bin?"
        message={`"${confirmDeleteState.employerName}" and all linked job orders will be soft-deleted.`}
        confirmLabel="Yes, delete"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}

export default EmployerListPage;