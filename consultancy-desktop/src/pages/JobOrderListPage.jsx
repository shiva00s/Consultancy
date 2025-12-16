import React, { useState, useEffect } from "react";
import {
  FiClipboard,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiX,
  FiSave,
} from "react-icons/fi";
import toast from "react-hot-toast";
import useDataStore from "../store/dataStore";
import useAuthStore from "../store/useAuthStore";
import "../css/JobOrderListPage.css";
import ConfirmDialog from "../components/ConfirmDialog";

function JobOrderListPage() {
  const initialForm = {
    employer_id: "",
    positionTitle: "",
    country: "",
    openingsCount: "1",
    status: "Open",
    requirements: "",
    food: "",
    accommodation: "",
    dutyHours: "",
    overtime: "",
    contractPeriod: "",
    selectionType: "CV Selection",
  };

  const jobs = useDataStore((state) => state.jobs);
  const employers = useDataStore((state) => state.employers);
  const isLoaded = useDataStore((state) => state.isLoaded);
  const addJobToStore = useDataStore((state) => state.addJob);
  const updateJobInStore = useDataStore((state) => state.updateJob);
  const deleteJobToStore = useDataStore((state) => state.deleteJob);
  const user = useAuthStore((state) => state.user);

  const [activeTab, setActiveTab] = useState("add");

  // ADD TAB STATE
  const [formData, setFormData] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // VIEW TAB STATE
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewForm, setViewForm] = useState(initialForm);
  const [viewErrors, setViewErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [viewSaving, setViewSaving] = useState(false);

  const [confirmState, setConfirmState] = useState({
    open: false,
    id: null,
    name: "",
  });

  const selectionTypeOptions = [
    "CV Selection",
    "CV Selection + Video Interview",
    "Zoom Interview",
    "Direct Client Interview",
  ];

  const selectedJob = jobs[selectedIndex] || null;
  const jobCount = jobs.length;

  const getEmployerName = (employerId) => {
    const emp = employers.find((e) => e.id === employerId);
    return emp ? emp.companyName : "Unknown";
  };

  // Sync selected job to viewForm
  const syncSelectedToForm = (idx) => {
    const job = jobs[idx];
    if (!job) {
      setViewForm(initialForm);
      return;
    }
    setViewForm({
      employer_id: job.employer_id,
      positionTitle: job.positionTitle,
      country: job.country || "",
      openingsCount: job.openingsCount?.toString() || "1",
      status: job.status,
      requirements: job.requirements || "",
      food: job.food || "",
      accommodation: job.accommodation || "",
      dutyHours: job.dutyHours || "",
      overtime: job.overtime || "",
      contractPeriod: job.contractPeriod || "",
      selectionType: job.selectionType || "CV Selection",
    });
  };

  // Keep viewForm in sync when jobs change
  useEffect(() => {
    if (activeTab === "list") {
      if (jobs.length === 0) {
        setSelectedIndex(0);
        setViewForm(initialForm);
        setIsEditing(false);
      } else if (selectedIndex >= jobs.length) {
        setSelectedIndex(0);
        syncSelectedToForm(0);
      } else {
        syncSelectedToForm(selectedIndex);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "list") {
      setViewErrors({});
      setIsEditing(false);
      if (jobs.length > 0) {
        setSelectedIndex(0);
        syncSelectedToForm(0);
      } else {
        setViewForm(initialForm);
      }
    }
  };

  const handleFormChange = (state, setState) => (e) => {
    const { name, value } = e.target;
    let v = value;
    if (
      ["openingsCount", "dutyHours", "overtime", "contractPeriod"].includes(
        name
      )
    ) {
      v = value.replace(/[^\d]/g, "");
    }
    const next = { ...state, [name]: v };
    setState(next);
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
    if (viewErrors[name]) setViewErrors((prev) => ({ ...prev, [name]: null }));
  };

  const validateForm = (state, setErr) => {
    const newErrors = {};
    if (!state.employer_id) newErrors.employer_id = "Select an employer.";
    if (!state.positionTitle || state.positionTitle.trim() === "")
      newErrors.positionTitle = "Position Title is required.";
    const openings = parseInt(state.openingsCount, 10);
    if (isNaN(openings) || openings < 1)
      newErrors.openingsCount = "Openings must be at least 1.";
    setErr(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildPayload = (state) => ({
    employer_id: state.employer_id,
    positionTitle: state.positionTitle,
    country: state.country,
    openingsCount: parseInt(state.openingsCount || "0", 10),
    status: state.status,
    requirements: state.requirements,
    food: state.food || null,
    accommodation: state.accommodation || null,
    dutyHours: state.dutyHours || null,
    overtime: state.overtime || null,
    contractPeriod: state.contractPeriod || null,
    selectionType: state.selectionType,
  });

  // ADD TAB HANDLERS
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm(formData, setErrors)) {
      toast.error("Please correct the errors in the form.");
      return;
    }
    setIsSaving(true);
    const payload = buildPayload(formData);
    const res = await window.electronAPI.addJobOrder({ user, data: payload });
    if (res.success) {
      addJobToStore(res.data);
      setFormData(initialForm);
      setErrors({});
      toast.success("Job Order added successfully!");
    } else {
      toast.error(res.error || "Failed to add job order.");
    }
    setIsSaving(false);
  };

  // VIEW TAB HANDLERS
  const onJobSelect = (e) => {
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
    if (!selectedJob) return;
    if (!validateForm(viewForm, setViewErrors)) {
      toast.error("Fix validation errors before saving.");
      return;
    }
    setViewSaving(true);
    const payload = buildPayload(viewForm);
    const res = await window.electronAPI.updateJobOrder({
      user,
      id: selectedJob.id,
      data: payload,
    });
    if (res.success) {
      updateJobInStore(res.data);
      toast.success(`Job "${res.data.positionTitle}" updated successfully.`);
      setIsEditing(false);
      setViewErrors({});
    } else {
      toast.error(res.error || "Update failed");
    }
    setViewSaving(false);
  };

  // DELETE HANDLERS
  const askDeleteJob = () => {
    if (!selectedJob) return;
    setConfirmState({
      open: true,
      id: selectedJob.id,
      name: selectedJob.positionTitle || "",
    });
  };

  const confirmDeleteJob = async () => {
    const { id, name } = confirmState;
    setConfirmState({ open: false, id: null, name: "" });
    if (!id) return;

    const res = await window.electronAPI.deleteJobOrder({ user, id });
    if (res.success) {
      deleteJobToStore(id);
      toast.success(
        `Job Order "${name}" and linked placements moved to Recycle Bin.`
      );
    } else {
      toast.error(res.error || "Failed to delete job order.");
    }
  };

  const cancelDeleteJob = () => {
    setConfirmState({ open: false, id: null, name: "" });
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Open":
        return "badge-green";
      case "Closed":
        return "badge-grey";
      case "On Hold":
        return "badge-yellow";
      default:
        return "badge-grey";
    }
  };

  if (!isLoaded) {
    return (
      <div className="job-page-container">
        <p className="empty-text">
          <span className="emoji-inline">⏳</span> Loading jobs and employers...
        </p>
      </div>
    );
  }

  return (
    <div className="job-page-container fade-in">
      {/* HEADER */}
      <div className="job-page-header">
        <h1>
          <span className="emoji-inline">📋</span> Job Order Management
        </h1>
      </div>

      {/* TABS */}
      <div className="job-tabs">
        <button
          className={`job-tab ${activeTab === "add" ? "job-tab-active" : ""}`}
          onClick={() => handleTabChange("add")}
        >
          <FiPlus /> <span className="emoji-inline">✨</span> Add New
        </button>
        <button
          className={`job-tab ${activeTab === "list" ? "job-tab-active" : ""}`}
          onClick={() => handleTabChange("list")}
        >
          <FiClipboard /> <span className="emoji-inline">📊</span> View/Edit
          <span className="tab-count-pill">
            <span className="emoji-inline">💼</span> {jobCount}
          </span>
        </button>
      </div>

      {/* TAB CONTENT */}
      {activeTab === "add" && (
        <div className="job-card-wide job-card-elevated slide-up">
          <div className="job-card-header">
            <div className="job-title-block">
              <div className="job-title">
                <span className="emoji-inline">🏗️</span> Create New Job Order
              </div>
              <div className="job-subtitle">
                <span className="emoji-inline">💡</span> Define position requirements and selection criteria
              </div>
            </div>
          </div>
          <div className="job-card-body">
            <form onSubmit={handleSubmit} className="job-grid-4">
              {/* Employer */}
              <div className="form-group">
                <label>
                  <span className="emoji-inline">🏢</span> Employer{" "}
                  <span style={{ color: "red" }}>*</span>
                </label>
                <select
                  name="employer_id"
                  value={formData.employer_id}
                  onChange={handleFormChange(formData, setFormData)}
                  style={errors.employer_id ? { borderColor: "red" } : {}}
                >
                  <option value="">
                    <span className="emoji-inline">👇</span> Select Employer
                  </option>
                  {employers.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.companyName}
                    </option>
                  ))}
                </select>
                {errors.employer_id && (
                  <span className="error-text">{errors.employer_id}</span>
                )}
              </div>

              {/* Position Title */}
              <div className="form-group">
                <label>
                  <span className="emoji-inline">💼</span> Position Title{" "}
                  <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="text"
                  name="positionTitle"
                  value={formData.positionTitle}
                  onChange={handleFormChange(formData, setFormData)}
                  placeholder="e.g. Software Engineer"
                  style={errors.positionTitle ? { borderColor: "red" } : {}}
                />
                {errors.positionTitle && (
                  <span className="error-text">{errors.positionTitle}</span>
                )}
              </div>

              {/* Country */}
              <div className="form-group">
                <label>
                  <span className="emoji-inline">🌍</span> Country
                </label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleFormChange(formData, setFormData)}
                  placeholder="e.g. UAE"
                />
              </div>

              {/* Openings Count */}
              <div className="form-group">
                <label>
                  <span className="emoji-inline">🔢</span> Openings{" "}
                  <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="text"
                  name="openingsCount"
                  value={formData.openingsCount}
                  onChange={handleFormChange(formData, setFormData)}
                  placeholder="1"
                  style={errors.openingsCount ? { borderColor: "red" } : {}}
                />
                {errors.openingsCount && (
                  <span className="error-text">{errors.openingsCount}</span>
                )}
              </div>

              {/* Status */}
              <div className="form-group">
                <label>
                  <span className="emoji-inline">📊</span> Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange(formData, setFormData)}
                >
                  <option value="Open">🟢 Open</option>
                  <option value="Closed">⚫ Closed</option>
                  <option value="On Hold">🟡 On Hold</option>
                </select>
              </div>

              {/* Selection Type */}
              <div className="form-group">
                <label>
                  <span className="emoji-inline">🎯</span> Selection Type
                </label>
                <select
                  name="selectionType"
                  value={formData.selectionType}
                  onChange={handleFormChange(formData, setFormData)}
                >
                  {selectionTypeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Food */}
              <div className="form-group">
                <label>
                  <span className="emoji-inline">🍽️</span> Food
                </label>
                <input
                  type="text"
                  name="food"
                  value={formData.food}
                  onChange={handleFormChange(formData, setFormData)}
                  placeholder="e.g. Provided"
                />
              </div>

              {/* Accommodation */}
              <div className="form-group">
                <label>
                  <span className="emoji-inline">🏠</span> Accommodation
                </label>
                <input
                  type="text"
                  name="accommodation"
                  value={formData.accommodation}
                  onChange={handleFormChange(formData, setFormData)}
                  placeholder="e.g. Shared"
                />
              </div>

              {/* Duty Hours */}
              <div className="form-group">
                <label>
                  <span className="emoji-inline">⏰</span> Duty Hours
                </label>
                <input
                  type="text"
                  name="dutyHours"
                  value={formData.dutyHours}
                  onChange={handleFormChange(formData, setFormData)}
                  placeholder="e.g. 8"
                />
              </div>

              {/* Overtime */}
              <div className="form-group">
                <label>
                  <span className="emoji-inline">⏱️</span> Overtime (hrs)
                </label>
                <input
                  type="text"
                  name="overtime"
                  value={formData.overtime}
                  onChange={handleFormChange(formData, setFormData)}
                  placeholder="e.g. 2"
                />
              </div>

              {/* Contract Period */}
              <div className="form-group">
                <label>
                  <span className="emoji-inline">📅</span> Contract Period (months)
                </label>
                <input
                  type="text"
                  name="contractPeriod"
                  value={formData.contractPeriod}
                  onChange={handleFormChange(formData, setFormData)}
                  placeholder="e.g. 24"
                />
              </div>

              {/* Requirements */}
              <div className="form-group form-group-full">
                <label>
                  <span className="emoji-inline">📝</span> Requirements
                </label>
                <textarea
                  name="requirements"
                  value={formData.requirements}
                  onChange={handleFormChange(formData, setFormData)}
                  rows={3}
                  placeholder="Job requirements..."
                />
              </div>

              {/* Submit */}
              <div className="form-footer form-group-full">
                <button
                  type="submit"
                  className="btn-primary-lg"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <span className="emoji-inline">⏳</span> Saving...
                    </>
                  ) : (
                    <>
                      <span className="emoji-inline">💾</span> Save Job Order
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === "list" && (
        <>
          {jobCount === 0 ? (
            <p className="empty-text">
              <span className="emoji-inline">📭</span> No job orders found.
              Switch to "Add New" to create one.
            </p>
          ) : (
            <div className="job-card-wide job-card-elevated job-card-editing slide-up">
              {/* CARD HEADER - Dropdown + Actions */}
              <div className="job-card-header">
                <div className="job-title-block">
                  <div className="job-title">
                    <span className="emoji-inline">📋</span>{" "}
                    {selectedJob ? selectedJob.positionTitle : "Select Job"}
                  </div>
                  <div className="job-subtitle">
                    {selectedJob && (
                      <>
                        <span className="emoji-inline">🏢</span>{" "}
                        {getEmployerName(selectedJob.employer_id)} •{" "}
                        <span className="emoji-inline">🌍</span>{" "}
                        {selectedJob.country || "N/A"}
                      </>
                    )}
                  </div>
                </div>

                <div className="job-header-actions">
                  <span className="job-count-chip">
                    <span className="emoji-inline">💼</span> {jobCount} Jobs
                  </span>

                  {/* Dropdown */}
                  <select
                    value={selectedIndex}
                    onChange={onJobSelect}
                    className="job-picker-select"
                  >
                    {jobs.map((job, idx) => (
                      <option key={job.id} value={idx}>
                        {idx + 1}. {job.positionTitle} ({job.status})
                      </option>
                    ))}
                  </select>

                  {/* Edit/Save/Cancel Buttons */}
                  {!isEditing ? (
                    <>
                      <button
                        className="icon-btn"
                        onClick={startEdit}
                        title="Edit"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={askDeleteJob}
                        title="Delete"
                      >
                        <FiTrash2 />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="icon-btn success"
                        onClick={saveEdit}
                        disabled={viewSaving}
                        title="Save"
                      >
                        <FiSave />
                      </button>
                      <button
                        className="icon-btn muted"
                        onClick={cancelEdit}
                        disabled={viewSaving}
                        title="Cancel"
                      >
                        <FiX />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* CARD BODY - Form */}
              <div className="job-card-body">
                <form
                  onSubmit={saveEdit}
                  className={isEditing ? "job-grid-4" : "read-grid"}
                >
                  {/* Employer */}
                  <div className={isEditing ? "form-group" : "detail-item"}>
                    <label className={isEditing ? "" : "detail-label"}>
                      <span className="emoji-inline">🏢</span> Employer
                    </label>
                    {isEditing ? (
                      <>
                        <select
                          name="employer_id"
                          value={viewForm.employer_id}
                          onChange={handleFormChange(viewForm, setViewForm)}
                          style={
                            viewErrors.employer_id ? { borderColor: "red" } : {}
                          }
                        >
                          <option value="">-- Select Employer --</option>
                          {employers.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.companyName}
                            </option>
                          ))}
                        </select>
                        {viewErrors.employer_id && (
                          <span className="error-text">
                            {viewErrors.employer_id}
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="detail-value">
                        {getEmployerName(viewForm.employer_id)}
                      </div>
                    )}
                  </div>

                  {/* Position Title */}
                  <div className={isEditing ? "form-group" : "detail-item"}>
                    <label className={isEditing ? "" : "detail-label"}>
                      <span className="emoji-inline">💼</span> Position Title
                    </label>
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          name="positionTitle"
                          value={viewForm.positionTitle}
                          onChange={handleFormChange(viewForm, setViewForm)}
                          style={
                            viewErrors.positionTitle
                              ? { borderColor: "red" }
                              : {}
                          }
                        />
                        {viewErrors.positionTitle && (
                          <span className="error-text">
                            {viewErrors.positionTitle}
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="detail-value">
                        {viewForm.positionTitle || "N/A"}
                      </div>
                    )}
                  </div>

                  {/* Country */}
                  <div className={isEditing ? "form-group" : "detail-item"}>
                    <label className={isEditing ? "" : "detail-label"}>
                      <span className="emoji-inline">🌍</span> Country
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="country"
                        value={viewForm.country}
                        onChange={handleFormChange(viewForm, setViewForm)}
                      />
                    ) : (
                      <div className="detail-value">
                        {viewForm.country || "N/A"}
                      </div>
                    )}
                  </div>

                  {/* Openings Count */}
                  <div className={isEditing ? "form-group" : "detail-item"}>
                    <label className={isEditing ? "" : "detail-label"}>
                      <span className="emoji-inline">🔢</span> Openings
                    </label>
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          name="openingsCount"
                          value={viewForm.openingsCount}
                          onChange={handleFormChange(viewForm, setViewForm)}
                          style={
                            viewErrors.openingsCount
                              ? { borderColor: "red" }
                              : {}
                          }
                        />
                        {viewErrors.openingsCount && (
                          <span className="error-text">
                            {viewErrors.openingsCount}
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="detail-value">
                        {viewForm.openingsCount || "N/A"}
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div className={isEditing ? "form-group" : "detail-item"}>
                    <label className={isEditing ? "" : "detail-label"}>
                      <span className="emoji-inline">📊</span> Status
                    </label>
                    {isEditing ? (
                      <select
                        name="status"
                        value={viewForm.status}
                        onChange={handleFormChange(viewForm, setViewForm)}
                      >
                        <option value="Open">🟢 Open</option>
                        <option value="Closed">⚫ Closed</option>
                        <option value="On Hold">🟡 On Hold</option>
                      </select>
                    ) : (
                      <div className="detail-value">
                        <span
                          className={`status-pill ${getStatusBadgeClass(
                            viewForm.status
                          )}`}
                        >
                          {viewForm.status}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Selection Type */}
                  <div className={isEditing ? "form-group" : "detail-item"}>
                    <label className={isEditing ? "" : "detail-label"}>
                      <span className="emoji-inline">🎯</span> Selection Type
                    </label>
                    {isEditing ? (
                      <select
                        name="selectionType"
                        value={viewForm.selectionType}
                        onChange={handleFormChange(viewForm, setViewForm)}
                      >
                        {selectionTypeOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="detail-value">
                        {viewForm.selectionType || "N/A"}
                      </div>
                    )}
                  </div>

                  {/* Food */}
                  <div className={isEditing ? "form-group" : "detail-item"}>
                    <label className={isEditing ? "" : "detail-label"}>
                      <span className="emoji-inline">🍽️</span> Food
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="food"
                        value={viewForm.food}
                        onChange={handleFormChange(viewForm, setViewForm)}
                      />
                    ) : (
                      <div className="detail-value">
                        {viewForm.food || "N/A"}
                      </div>
                    )}
                  </div>

                  {/* Accommodation */}
                  <div className={isEditing ? "form-group" : "detail-item"}>
                    <label className={isEditing ? "" : "detail-label"}>
                      <span className="emoji-inline">🏠</span> Accommodation
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="accommodation"
                        value={viewForm.accommodation}
                        onChange={handleFormChange(viewForm, setViewForm)}
                      />
                    ) : (
                      <div className="detail-value">
                        {viewForm.accommodation || "N/A"}
                      </div>
                    )}
                  </div>

                  {/* Duty Hours */}
                  <div className={isEditing ? "form-group" : "detail-item"}>
                    <label className={isEditing ? "" : "detail-label"}>
                      <span className="emoji-inline">⏰</span> Duty Hours
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="dutyHours"
                        value={viewForm.dutyHours}
                        onChange={handleFormChange(viewForm, setViewForm)}
                      />
                    ) : (
                      <div className="detail-value">
                        {viewForm.dutyHours || "N/A"}
                      </div>
                    )}
                  </div>

                  {/* Overtime */}
                  <div className={isEditing ? "form-group" : "detail-item"}>
                    <label className={isEditing ? "" : "detail-label"}>
                      <span className="emoji-inline">⏱️</span> Overtime (hrs)
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="overtime"
                        value={viewForm.overtime}
                        onChange={handleFormChange(viewForm, setViewForm)}
                      />
                    ) : (
                      <div className="detail-value">
                        {viewForm.overtime || "N/A"}
                      </div>
                    )}
                  </div>

                  {/* Contract Period */}
                  <div className={isEditing ? "form-group" : "detail-item"}>
                    <label className={isEditing ? "" : "detail-label"}>
                      <span className="emoji-inline">📅</span> Contract Period (months)
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="contractPeriod"
                        value={viewForm.contractPeriod}
                        onChange={handleFormChange(viewForm, setViewForm)}
                      />
                    ) : (
                      <div className="detail-value">
                        {viewForm.contractPeriod || "N/A"}
                      </div>
                    )}
                  </div>

                  {/* Requirements */}
                  <div
                    className={
                      isEditing ? "form-group form-group-full" : "detail-full"
                    }
                  >
                    <label className={isEditing ? "" : "detail-label"}>
                      <span className="emoji-inline">📝</span> Requirements
                    </label>
                    {isEditing ? (
                      <textarea
                        name="requirements"
                        value={viewForm.requirements}
                        onChange={handleFormChange(viewForm, setViewForm)}
                        rows={3}
                      />
                    ) : (
                      <div className="detail-value">
                        {viewForm.requirements || "N/A"}
                      </div>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        open={confirmState.open}
        title="Delete Job Order"
        message={`Are you sure you want to delete "${confirmState.name}"? This will also move linked placements to Recycle Bin.`}
        onConfirm={confirmDeleteJob}
        onCancel={cancelDeleteJob}
      />
    </div>
  );
}

export default JobOrderListPage;
