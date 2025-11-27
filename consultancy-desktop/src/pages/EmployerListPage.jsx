import React, { useState } from 'react';
import {
  FiServer,
  FiPlus,
  FiEdit2, 
  FiTrash2, 
} from 'react-icons/fi';
import EmployerEditModal from "../components/modals/EmployerEditModal";
import toast from 'react-hot-toast'; 
import '../css/EmployerListPage.css';
import useDataStore from '../store/dataStore'; 
import { useShallow } from 'zustand/react/shallow';
import useAuthStore from '../store/useAuthStore';

// --- START: TEMPORARY ISOLATION REMOVED ---
// const employers = [];
// const isLoaded = true;
// const addEmployerToStore = () => {};
// const updateEmployerInStore = () => {};
// const deleteEmployerFromStore = () => {};
// --- END: TEMPORARY ISOLATION REMOVED ---

function EmployerListPage() {
  const initialForm = {
    companyName: '',
    country: '',
    contactPerson: '',
    contactEmail: '',
    notes: '',
  };
  
  // --- RESTORED ZUSTAND HOOK (P1.1 FIX) ---
  const { 
    employers, 
    isLoaded, 
    addEmployer: addEmployerToStore,
    updateEmployer: updateEmployerInStore,
    deleteEmployer: deleteEmployerFromStore
  } = useDataStore(
    useShallow((state) => ({ // <--- MODIFIED: Wraps selector function with useShallow
      employers: state.employers,
      isLoaded: state.isLoaded,
      addEmployer: state.addEmployer,
      updateEmployer: state.updateEmployer,
      deleteEmployer: state.deleteEmployer,
    })) // <--- REMOVED ', shallow)' from outside the hook
  );
  const { user } = useAuthStore(
    useShallow((state) => ({ user: state.user }))
  );
  const [formData, setFormData] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [editingEmployer, setEditingEmployer] = useState(null);

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.companyName || formData.companyName.trim() === '') {
      newErrors.companyName = 'Company Name is required.';
    }

    if (formData.contactEmail && !emailRegex.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Please enter a valid email address.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please correct the errors in the form.'); 
      return;
    }

    setIsSaving(true);
    const res = await window.electronAPI.addEmployer({user, data: formData });
    if (res.success) {
      addEmployerToStore(res.data); 
      setFormData(initialForm);
      setErrors({});
      toast.success('Employer added successfully!'); 
    } else {
      toast.error(res.error || 'Failed to add employer.'); 
    }
    setIsSaving(false);
  };
  
  const handleUpdateEmployer = (updatedData) => {
    updateEmployerInStore(updatedData); 
    toast.success(`Employer ${updatedData.companyName} updated successfully!`); 
  };
  
  const handleDeleteEmployer = async (id, name) => {
    if (!window.confirm(`Are you sure you want to move employer "${name}" to the Recycle Bin? All associated job orders will also be soft-deleted.`)) return;

    const res = await window.electronAPI.deleteEmployer({user, id });

    if (res.success) {
      deleteEmployerFromStore(id); 
      toast.success(`Employer "${name}" and linked jobs moved to Recycle Bin.`); 
    } else {
      toast.error(res.error || 'Failed to delete employer.'); 
    }
  };

  // --- RESTORED LOADING CHECK ---
  if (!isLoaded) {
    return <p>Loading employers...</p>;
  }

  return (
    <div className="employer-page-container">
      
      {editingEmployer && (
        <EmployerEditModal 
          user={user}
          employer={editingEmployer}
          onClose={() => setEditingEmployer(null)}
          onSave={handleUpdateEmployer}
        />
      )}
      
      <h1>Employer Management</h1>

      <div className="employer-layout">
        {/* Add Employer Form */}
        <div className="form-card">
          <h2>
            <FiPlus /> Add New Employer
          </h2>
          <form onSubmit={handleSubmit}>
            
            <div className={`form-group ${errors.companyName ? 'error' : ''}`}>
              <label>Company Name</label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleTextChange}
              />
              {errors.companyName && <p className="error-text">{errors.companyName}</p>}
            </div>

            <div className="form-group">
              <label>Country</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleTextChange}
              />
            </div>

            <div className="form-group">
              <label>Contact Person</label>
              <input
                type="text"
                name="contactPerson"
                value={formData.contactPerson}
                onChange={handleTextChange}
              />
            </div>

            <div className={`form-group ${errors.contactEmail ? 'error' : ''}`}>
              <label>Contact Email</label>
              <input
                type="text"
                name="contactEmail"
                value={formData.contactEmail}
                onChange={handleTextChange}
              />
              {errors.contactEmail && <p className="error-text">{errors.contactEmail}</p>}
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleTextChange}
              ></textarea>
            </div>
            <button type="submit" className="btn" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Employer'}
            </button>
          </form>
        </div>

        {/* Employer List */}
        <div className="list-card">
          <h2>
            <FiServer /> Existing Employers ({employers.length})
          </h2>
          <div className="employer-list">
            {employers.length === 0 ? (
              <p>No employers found. Add one using the form.</p>
            ) : (
              employers.map((emp) => (
                <div key={emp.id} className="employer-item">
                  <div className="employer-item-icon">
                    <FiServer />
                  </div>
                  <div className="employer-item-info">
                    <h3>{emp.companyName}</h3>
                    <p>
                      {emp.country || 'N/A'} | {emp.contactPerson || 'N/A'}
                    </p>
                  </div>
                  
                  <div className="employer-item-actions">
                    <button 
                      className="doc-btn view" // Use global doc-btn style (view color)
                      title="Edit Employer"
                      onClick={() => setEditingEmployer(emp)}
                    >
                      <FiEdit2 />
                    </button>
                    <button 
                      className="doc-btn delete" // Use global doc-btn style (delete color)
                      title="Move to Recycle Bin"
                      onClick={() => handleDeleteEmployer(emp.id, emp.companyName)}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployerListPage;