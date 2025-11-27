import React, { useState } from 'react';
import {
  FiClipboard,
  FiPlus,
  FiEdit2, 
  FiTrash2, 
} from 'react-icons/fi';
import JobEditModal from "../components/JobEditModal";
import toast from 'react-hot-toast';
import useDataStore from '../store/dataStore'; 
import { shallow } from 'zustand/shallow'; 
import useAuthStore from '../store/useAuthStore';
import "../css/JobOrderListPage.css";


function JobOrderListPage() {
  const initialForm = {
    employer_id: '',
    positionTitle: '',
    country: '',
    openingsCount: 1,
    status: 'Open',
    requirements: '',
  };
  
  const { 
    jobs, 
    employers, 
    isLoaded, 
    addJob: addJobToStore,
    updateJob: updateJobInStore,
    deleteJob: deleteJobToStore
  } = useDataStore((state) => ({
    jobs: state.jobs,
    employers: state.employers,
    isLoaded: state.isLoaded,
    addJob: state.addJob,
    updateJob: state.updateJob,
    deleteJob: state.deleteJob,
  }), shallow); 
  const { user } = useAuthStore(
    (state) => ({ user: state.user }),
    shallow
  );
  const [formData, setFormData] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [editingJob, setEditingJob] = useState(null);

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.employer_id) {
      newErrors.employer_id = 'You must select an employer.';
    }

    if (!formData.positionTitle || formData.positionTitle.trim() === '') {
      newErrors.positionTitle = 'Position Title is required.';
    }

    const openings = parseInt(formData.openingsCount, 10);
    if (isNaN(openings) || openings < 1) {
      newErrors.openingsCount = 'Openings must be at least 1.';
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
    const res = await window.electronAPI.addJobOrder({user, data: formData });

    if (res.success) {
      addJobToStore(res.data);
      setFormData(initialForm);
      setErrors({});
      toast.success('Job Order added successfully!');
    } else {
      toast.error(res.error || 'Failed to add job order.');
    }
    setIsSaving(false);
  };
  
  const handleUpdateJob = (updatedData) => {
    updateJobInStore(updatedData.data);
    toast.success(`Job Order "${updatedData.data.positionTitle}" updated successfully!`);
  };

  const handleDeleteJob = async (id, name) => {
    if (!window.confirm(`Are you sure you want to move job "${name}" to the Recycle Bin? All linked placements will also be soft-deleted.`)) return;

    const res = await window.electronAPI.deleteJobOrder({user, id });

    if (res.success) {
      deleteJobToStore(id);
      toast.success(`Job Order "${name}" and linked placements moved to Recycle Bin.`);
    } else {
      toast.error(res.error || 'Failed to delete job order.');
    }
  };
  
  // Helper function to map status to global badge class
  const getStatusBadgeClass = (status) => {
    switch(status) {
        case 'Open': return 'badge-green';
        case 'Closed': return 'badge-grey';
        case 'On Hold': return 'badge-yellow';
        default: return 'badge-grey';
    }
  };

  if (!isLoaded) return <p>Loading jobs and employers...</p>;

  return (
    <div className="job-page-container">
      
      {editingJob && (
        <JobEditModal 
          user={user}
          job={editingJob}
          employers={employers} 
          onClose={() => setEditingJob(null)}
          onSave={handleUpdateJob}
        />
      )}
      
      <h1>Job Order Management</h1>

      {/* --- NEW UNIFIED LAYOUT GRID --- */}
      <div className="job-layout">
        
        {/* Left Column: Add Job Form (Form is already wrapped in .form-card) */}
        <div className="form-card">
          <h2>
            <FiPlus /> Add New Job Order
          </h2>
          <form onSubmit={handleSubmit}>
            
            <div className={`form-group ${errors.employer_id ? 'error' : ''}`}>
              <label>Employer / Company</label>
              <select
                name="employer_id"
                value={formData.employer_id}
                onChange={handleTextChange}
              >
                <option value="">-- Select an Employer --</option>
                {employers.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.companyName} ({emp.country})
                  </option>
                ))}
              </select>
              {errors.employer_id && <p className="error-text">{errors.employer_id}</p>}
            </div>

            <div className={`form-group ${errors.positionTitle ? 'error' : ''}`}>
              <label>Position Title</label>
              <input
                type="text"
                name="positionTitle"
                value={formData.positionTitle}
                onChange={handleTextChange}
              />
              {errors.positionTitle && <p className="error-text">{errors.positionTitle}</p>}
            </div>

            <div className="form-group">
              <label>Country (if different from employer)</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleTextChange}
              />
            </div>

            <div className={`form-group ${errors.openingsCount ? 'error' : ''}`}>
              <label>Number of Openings</label>
              <input
                type="number"
                name="openingsCount"
                min="1"
                value={formData.openingsCount}
                onChange={handleTextChange}
              />
              {errors.openingsCount && <p className="error-text">{errors.openingsCount}</p>}
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleTextChange}
              >
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Requirements / Notes</label>
              <textarea
                name="requirements"
                value={formData.requirements}
                onChange={handleTextChange}
              ></textarea>
            </div>
            <button type="submit" className="btn" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Job Order'}
            </button>
          </form>
        </div>

        {/* Right Column: Job List (List is already wrapped in .list-card) */}
        <div className="list-card">
          <h2>
            <FiClipboard /> Existing Job Orders ({jobs.length})
          </h2>
          <div className="job-list">
            {jobs.length === 0 ? (
              <p>No job orders found. Add one using the form.</p>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="job-item">
                  <div className="job-item-info">
                    <h3>{job.positionTitle}</h3>
                    <p>
                      {job.companyName} - {job.country || 'N/A'}
                    </p>
                  </div>
                  <div className="job-item-status">
                    <span
                      className={`status-badge ${getStatusBadgeClass(job.status)}`}
                    >
                      {job.status}
                    </span>
                    <span className="job-item-count">
                      {job.openingsCount} Openings
                    </span>
                  </div>
                  
                  <div className="job-item-actions">
                    <button 
                      className="doc-btn view" 
                      title="Edit Job Order"
                      onClick={(e) => { e.stopPropagation(); setEditingJob(job); }}
                    >
                      <FiEdit2 />
                    </button>
                    <button 
                      className="doc-btn delete" 
                      title="Move to Recycle Bin"
                      onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id, job.positionTitle); }}
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

export default JobOrderListPage;