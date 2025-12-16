import React, { useState } from "react";
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
  const [formData, setFormData] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

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

  const getEmployerName = (employerId) => {
    const emp = employers.find((e) => e.id === employerId);
    return emp ? emp.companyName : "Unknown";
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
  };

  const validateForm = (state) => {
    const newErrors = {};
    if (!state.employer_id) newErrors.employer_id = "Select an employer.";
    if (!state.positionTitle || state.positionTitle.trim() === "")
      newErrors.positionTitle = "Position Title is required.";
    const openings = parseInt(state.openingsCount, 10);
    if (isNaN(openings) || openings < 1)
      newErrors.openingsCount = "Openings must be at least 1.";
    setErrors(newErrors);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm(formData)) {
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

  const startEdit = (job) => {
    setEditingId(job.id);
    setEditForm({
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

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (jobId) => {
    if (!validateForm(editForm)) {
      toast.error("Fix validation errors before saving.");
      return;
    }
    const payload = buildPayload(editForm);
    const res = await window.electronAPI.updateJobOrder({
      user,
      id: jobId,
      data: payload,
    });
    if (res.success) {
      updateJobInStore(res.data);
      toast.success(`Job "${res.data.positionTitle}" updated successfully.`);
      setEditingId(null);
      setEditForm({});
    } else {
      toast.error(res.error || "Update failed");
    }
  };

  // ---- Confirm delete flow ----
  const askDeleteJob = (id, name) => {
    setConfirmState({
      open: true,
      id,
      name: name || "",
    });
  };

  const confirmDeleteJob = async () => {
    const { id, name } = confirmState;
    if (!id) {
      setConfirmState({ open: false, id: null, name: "" });
      return;
    }

    const res = await window.electronAPI.deleteJobOrder({ user, id });
    setConfirmState({ open: false, id: null, name: "" });

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
        <p>Loading jobs and employers...</p>
      </div>
    );
  }

  const renderJobFormFields = (state, setState, disabled = false) => {
    const onChange = disabled ? () => {} : handleFormChange(state, setState);

    return (
      <div className={`job-grid-4 ${disabled ? "read-grid" : ""}`}>
        <div className="form-group">
          <label>🏢 Company (Employer)</label>
          <select
            name="employer_id"
            value={state.employer_id}
            onChange={onChange}
            disabled={disabled}
          >
            <option value="">-- Select Employer --</option>
            {employers.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.companyName}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>💺 Position</label>
          <input
            type="text"
            name="positionTitle"
            value={state.positionTitle}
            onChange={onChange}
            placeholder="e.g. Admin"
            disabled={disabled}
          />
        </div>

        <div className="form-group">
          <label>🌏 Country</label>
          <input
            type="text"
            name="country"
            value={state.country}
            onChange={onChange}
            placeholder="e.g. Japan"
            disabled={disabled}
          />
        </div>

        <div className="form-group">
          <label>👥 No. of Openings</label>
          <input
            type="text"
            inputMode="numeric"
            name="openingsCount"
            value={state.openingsCount}
            onChange={onChange}
            placeholder="1"
            disabled={disabled}
          />
        </div>

        {/* Food */}
        <div className="form-group">
          <label>🍽 Food</label>
          <select
            name="food"
            value={state.food}
            onChange={onChange}
            disabled={disabled}
          >
            <option value="">-- Select --</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="Company Provided">Company Provided</option>
            <option value="Self">Self</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Accommodation */}
        <div className="form-group">
          <label>🏠 Accommodation</label>
          <select
            name="accommodation"
            value={state.accommodation}
            onChange={onChange}
            disabled={disabled}
          >
            <option value="">-- Select --</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="Company Provided">Company Provided</option>
            <option value="Self">Self</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="form-group">
          <label>⏰ Duty Hours</label>
          <input
            type="text"
            inputMode="numeric"
            name="dutyHours"
            value={state.dutyHours}
            onChange={onChange}
            placeholder="e.g. 8"
            disabled={disabled}
          />
        </div>

        <div className="form-group">
          <label>⏱ Overtime (OT)</label>
          <input
            type="text"
            inputMode="numeric"
            name="overtime"
            value={state.overtime}
            onChange={onChange}
            placeholder="e.g. 2"
            disabled={disabled}
          />
        </div>

        <div className="form-group">
          <label>📅 Contract Period (months)</label>
          <input
            type="text"
            inputMode="numeric"
            name="contractPeriod"
            value={state.contractPeriod}
            onChange={onChange}
            placeholder="e.g. 24"
            disabled={disabled}
          />
        </div>

        <div className="form-group">
          <label>🎯 Selection Type</label>
          <select
            name="selectionType"
            value={state.selectionType}
            onChange={onChange}
            disabled={disabled}
          >
            {selectionTypeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>📌 Status</label>
          <select
            name="status"
            value={state.status}
            onChange={onChange}
            disabled={disabled}
          >
            <option value="Open">Open</option>
            <option value="On Hold">On Hold</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

        <div className="form-group form-group-empty" />

        <div className="form-group form-group-full">
          <label>✅ Requirements</label>
          <textarea
            name="requirements"
            value={state.requirements}
            onChange={onChange}
            rows={3}
            disabled={disabled}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="job-page-container">
      <div className="job-page-header">
        <h1>
          <FiClipboard /> Job Order Management
        </h1>
      </div>

      <div className="job-tabs">
        <button
          className={`job-tab ${activeTab === "add" ? "job-tab-active" : ""}`}
          onClick={() => setActiveTab("add")}
        >
          <FiPlus /> Add New
        </button>
        <button
          className={`job-tab ${activeTab === "view" ? "job-tab-active" : ""}`}
          onClick={() => setActiveTab("view")}
        >
          📋 View & Edit
        </button>
      </div>

      {activeTab === "add" && (
        <div className="tab-panel fade-in">
          <div className="job-card-wide job-card-elevated">
            <div className="job-card-header">
              <h2>➕ Add New Job Order</h2>
            </div>
            <div className="job-card-body">
              <form onSubmit={handleSubmit}>
                {renderJobFormFields(formData, setFormData, false)}
                <div className="form-footer">
                  <button
                    type="submit"
                    className="btn-primary-lg"
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Add Job Order"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTab === "view" && (
        <div className="tab-panel fade-in">
          <div className="view-tab-header">
            <span className="view-tab-pill">
              ✨ Showing {jobs.length} Job Orders
            </span>
            <span className="view-tab-hint">
              💡 Tip: Click ✏ to edit or 🗑 to move to recycle bin
            </span>
          </div>

          {jobs.length === 0 ? (
            <p className="empty-text">
              No job orders found. Switch to "Add New" to create one.
            </p>
          ) : (
            <div className="job-grid-cards">
              {jobs.map((job) => {
                const isEditing = editingId === job.id;

                const viewState = {
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
                };

                return (
                  <div
                    key={job.id}
                    className={`job-card-wide job-card-elevated ${
                      isEditing ? "job-card-editing" : ""
                    }`}
                  >
                    <div className="job-card-header">
                      <div className="job-title-block">
                        <span className="job-title">
                          {isEditing ? "✏ Editing Job Order" : job.positionTitle}
                        </span>
                        <span className="job-subtitle">
                          🏢 {getEmployerName(job.employer_id)} • 🌏{" "}
                          {job.country || "N/A"}
                        </span>
                      </div>
                      <div className="job-header-actions">
                        <span
                          className={`status-pill ${getStatusBadgeClass(
                            job.status
                          )}`}
                        >
                          {job.status === "Open" && "🟢 "}
                          {job.status === "On Hold" && "🟡 "}
                          {job.status === "Closed" && "⚪ "}
                          {job.status}
                        </span>
                        {!isEditing ? (
                          <>
                            <button
                              className="icon-btn"
                              title="Edit"
                              onClick={() => startEdit(job)}
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              className="icon-btn danger"
                              title="Delete"
                              onClick={() =>
                                askDeleteJob(job.id, job.positionTitle)
                              }
                            >
                              <FiTrash2 />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="icon-btn success"
                              title="Save"
                              onClick={() => saveEdit(job.id)}
                            >
                              <FiSave />
                            </button>
                            <button
                              className="icon-btn muted"
                              title="Cancel"
                              onClick={cancelEdit}
                            >
                              <FiX />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="job-card-body">
                      {isEditing
                        ? renderJobFormFields(editForm, setEditForm, false)
                        : renderJobFormFields(viewState, () => {}, true)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmState.open}
        title="Move job order to Recycle Bin?"
        message={
          confirmState.name
            ? `Job "${confirmState.name}" and all linked placements will be moved to the Recycle Bin.`
            : "This job order and all linked placements will be moved to the Recycle Bin."
        }
        confirmLabel="Yes, move to Recycle Bin"
        cancelLabel="No, keep job"
        onConfirm={confirmDeleteJob}
        onCancel={cancelDeleteJob}
      />
    </div>
  );
}

export default JobOrderListPage;
