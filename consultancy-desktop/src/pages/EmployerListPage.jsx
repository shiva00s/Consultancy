import React, { useEffect, useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';
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
      if (employers.length > 0) {
        setSelectedIndex(0);
        syncSelectedToForm(0);
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
      toast.success('Employer added.');
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

  const onViewSubmit = async (e) => {
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
      updateEmployer(res.data);
      toast.success('Employer updated.');
    } else {
      toast.error(res.error || 'Update failed.');
    }
    setViewSaving(false);
  };

  const onEmployerSelect = (e) => {
    const idx = Number(e.target.value);
    setSelectedIndex(idx);
    syncSelectedToForm(idx);
    setViewErrors({});
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
        <p className="empty-text">Loading employers...</p>
      </div>
    );
  }

  return (
    <div className="job-page-container">
      <header className="job-page-header">
        <h1>
          <span className="emoji-inline" aria-hidden="true">
            🏢
          </span>
          Employer Management
        </h1>
      </header>

      <div className="job-tabs">
        <button
          type="button"
          className={`job-tab ${activeTab === 'add' ? 'job-tab-active' : ''}`}
          onClick={() => handleTabChange('add')}
        >
          <span className="emoji-inline" aria-hidden="true">
            ✨
          </span>
          Add New
        </button>
        <button
          type="button"
          className={`job-tab ${
            activeTab === 'list' ? 'job-tab-active' : ''
          }`}
          onClick={() => handleTabChange('list')}
        >
          <span className="emoji-inline" aria-hidden="true">
            📋
          </span>
          View / Manage
          <span className="tab-count-pill">👥 {employerCount}</span>
        </button>
      </div>

      {/* TAB 1: ADD NEW */}
      {activeTab === 'add' && (
        <section className="job-card-wide job-card-elevated fade-in">
          <div className="job-card-header">
            <div className="job-title-block">
              <div className="job-title">
                <span className="emoji-inline" aria-hidden="true">
                  🏗️
                </span>
                New Employer Setup
              </div>
              <div className="job-subtitle">
                Create a company profile that can be linked to job orders.
              </div>
            </div>
          </div>

          <div className="job-card-body">
            <form onSubmit={onAddSubmit}>
              <div className="job-grid-4">
                <div
                  className={`form-group form-group-full ${
                    addErrors.companyName ? 'error' : ''
                  }`}
                >
                  <label>
                    <span className="emoji-inline" aria-hidden="true">
                      🏢
                    </span>
                    Company Name *
                  </label>
                  <input
                    name="companyName"
                    value={addForm.companyName}
                    onChange={onAddChange}
                    placeholder="🏙️ ACME International"
                  />
                  {addErrors.companyName && (
                    <p className="error-text">{addErrors.companyName}</p>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    <span className="emoji-inline" aria-hidden="true">
                      🌍
                    </span>
                    Country
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
                    <span className="emoji-inline" aria-hidden="true">
                      🧑‍💼
                    </span>
                    Contact Person
                  </label>
                  <input
                    name="contactPerson"
                    value={addForm.contactPerson}
                    onChange={onAddChange}
                    placeholder="👔 Main decision maker"
                  />
                </div>

                <div
                  className={`form-group ${
                    addErrors.contactEmail ? 'error' : ''
                  }`}
                >
                  <label>
                    <span className="emoji-inline" aria-hidden="true">
                      📧
                    </span>
                    Contact Email
                  </label>
                  <input
                    name="contactEmail"
                    value={addForm.contactEmail}
                    onChange={onAddChange}
                    placeholder="📨 name@company.com"
                  />
                  {addErrors.contactEmail && (
                    <p className="error-text">{addErrors.contactEmail}</p>
                  )}
                </div>

                <div className="form-group form-group-full">
                  <label>
                    <span className="emoji-inline" aria-hidden="true">
                      📝
                    </span>
                    Notes
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
                  {addSaving ? 'Saving…' : 'Save Employer'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* TAB 2: VIEW / MANAGE */}
      {activeTab === 'list' && (
        <section className="job-card-wide job-card-elevated job-card-editing fade-in">
          <div className="job-card-header">
            <div className="job-title-block">
              <div className="job-title">
                <span className="emoji-inline" aria-hidden="true">
                  🧾
                </span>
                {selectedEmployer
                  ? selectedEmployer.companyName
                  : 'No Employer Selected'}
                <span className="emoji-inline" aria-hidden="true">
                  👥
                </span>
              </div>
              <div className="job-subtitle">
                Inline edit employer master data. Changes apply to all linked
                job orders.
              </div>
            </div>

            <div className="job-header-actions">
              <span className="employer-count-chip">
                👥 {employerCount} Employers
              </span>

              <select
                className="employer-picker-select"
                value={selectedIndex}
                onChange={onEmployerSelect}
                disabled={employers.length === 0}
              >
                {employers.length === 0 ? (
                  <option>No employers found</option>
                ) : (
                  employers.map((e, i) => (
                    <option key={e.id} value={i}>
                      🏢 {e.companyName}
                    </option>
                  ))
                )}
              </select>

              <button
                type="button"
                className="icon-btn danger"
                title="Move employer to Recycle Bin"
                onClick={onDeleteClick}
                disabled={!selectedEmployer}
              >
                <FiTrash2 />
              </button>
            </div>
          </div>

          <div className="job-card-body">
            {selectedEmployer ? (
              <form onSubmit={onViewSubmit}>
                <div className="job-grid-4">
                  <div
                    className={`form-group form-group-full ${
                      viewErrors.companyName ? 'error' : ''
                    }`}
                  >
                    <label>
                      <span className="emoji-inline" aria-hidden="true">
                        🏢
                      </span>
                      Company Name *
                    </label>
                    <input
                      name="companyName"
                      value={viewForm.companyName}
                      onChange={onViewChange}
                      placeholder="🏙️ Company name"
                    />
                    {viewErrors.companyName && (
                      <p className="error-text">{viewErrors.companyName}</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label>
                      <span className="emoji-inline" aria-hidden="true">
                        🌍
                      </span>
                      Country
                    </label>
                    <input
                      name="country"
                      value={viewForm.country}
                      onChange={onViewChange}
                      placeholder="🌎 Country"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <span className="emoji-inline" aria-hidden="true">
                        🧑‍💼
                      </span>
                      Contact Person
                    </label>
                    <input
                      name="contactPerson"
                      value={viewForm.contactPerson}
                      onChange={onViewChange}
                      placeholder="👔 Person in charge"
                    />
                  </div>

                  <div
                    className={`form-group ${
                      viewErrors.contactEmail ? 'error' : ''
                    }`}
                  >
                    <label>
                      <span className="emoji-inline" aria-hidden="true">
                        📧
                      </span>
                      Contact Email
                    </label>
                    <input
                      name="contactEmail"
                      value={viewForm.contactEmail}
                      onChange={onViewChange}
                      placeholder="📨 Email address"
                    />
                    {viewErrors.contactEmail && (
                      <p className="error-text">{viewErrors.contactEmail}</p>
                    )}
                  </div>

                  <div className="form-group form-group-full">
                    <label>
                      <span className="emoji-inline" aria-hidden="true">
                        📝
                      </span>
                      Notes
                    </label>
                    <textarea
                      name="notes"
                      rows={3}
                      value={viewForm.notes}
                      onChange={onViewChange}
                      placeholder="💡 Any special conditions, communication notes, etc."
                    />
                  </div>
                </div>

                <div className="form-footer">
                  <button
                    type="submit"
                    className="btn-primary-lg"
                    disabled={viewSaving}
                  >
                    {viewSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <p className="empty-text">
                No employers available. Create one from the Add New tab.
              </p>
            )}
          </div>
        </section>
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
