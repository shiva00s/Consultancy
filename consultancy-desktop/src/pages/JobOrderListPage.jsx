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
    employerid: "",
    positionTitle: "",
    country: "",
    openingsCount: "1",
    status: "Open",
    requirements: "",
    food: "",
    foodCustom: "",
    accommodation: "",
    accommodationCustom: "",
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

  const foodOptions = [
    "Yes",
    "No",
    "Company Provided",
    "Self",
    "Other",
  ];

  const accommodationOptions = [
    "Yes",
    "No",
    "Company Provided",
    "Self",
    "Other",
  ];

  const selectedJob = jobs[selectedIndex] || null;
  const jobCount = jobs.length;

  const getEmployerName = (employerId) => {
    const emp = employers.find((e) => e.id === employerId);
    return emp ? emp.companyName : "Unknown";
  };

  // 🔥 AUTO-POPULATE POSITION & COUNTRY FROM EMPLOYER (ADD MODE)
  useEffect(() => {
    if (formData.employerid) {
      const selectedEmployer = employers.find(
        (e) => e.id === parseInt(formData.employerid)
      );
      if (selectedEmployer) {
        setFormData((prev) => ({
          ...prev,
          country: selectedEmployer.country || "",
          positionTitle: selectedEmployer.position || "", // Auto-fetch Position
        }));
      }
    }
  }, [formData.employerid, employers]);

  // 🔥 AUTO-POPULATE POSITION & COUNTRY FROM EMPLOYER (VIEW/EDIT MODE)
  useEffect(() => {
    if (viewForm.employerid && isEditing) {
      const selectedEmployer = employers.find(
        (e) => e.id === parseInt(viewForm.employerid)
      );
      if (selectedEmployer) {
        setViewForm((prev) => ({
          ...prev,
          country: selectedEmployer.country || "",
          positionTitle: selectedEmployer.position || "", // Auto-fetch Position
        }));
      }
    }
  }, [viewForm.employerid, employers, isEditing]);

  // Sync selected job to viewForm
  const syncSelectedToForm = (idx) => {
    const job = jobs[idx];
    if (!job) {
      setViewForm(initialForm);
      return;
    }

    // Parse food/accommodation to handle "Other: ..." values
    let foodValue = job.food || "";
    let foodCustomValue = "";
    if (foodValue.startsWith("Other: ")) {
      foodCustomValue = foodValue.replace("Other: ", "");
      foodValue = "Other";
    }

    let accommodationValue = job.accommodation || "";
    let accommodationCustomValue = "";
    if (accommodationValue.startsWith("Other: ")) {
      accommodationCustomValue = accommodationValue.replace("Other: ", "");
      accommodationValue = "Other";
    }

    setViewForm({
      employerid: job.employerid,
      positionTitle: job.positionTitle,
      country: job.country || "",
      openingsCount: job.openingsCount?.toString() || "1",
      status: job.status,
      requirements: job.requirements || "",
      food: foodValue,
      foodCustom: foodCustomValue,
      accommodation: accommodationValue,
      accommodationCustom: accommodationCustomValue,
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
    if (viewErrors[name])
      setViewErrors((prev) => ({ ...prev, [name]: null }));
  };

  const validateForm = (state, setErr) => {
    const newErrors = {};
    if (!state.employerid) newErrors.employerid = "Select an employer.";
    if (!state.positionTitle || state.positionTitle.trim() === "")
      newErrors.positionTitle = "Position Title is required.";

    const openings = parseInt(state.openingsCount, 10);
    if (isNaN(openings) || openings < 1)
      newErrors.openingsCount = "Openings must be at least 1.";

    setErr(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // FIX: Force Integer mapping and handle "Other" logic correctly
  const buildPayload = (state) => {
    let finalFood = state.food || null;
    if (state.food === "Other" && state.foodCustom) {
      finalFood = `Other: ${state.foodCustom}`;
    }

    let finalAccommodation = state.accommodation || null;
    if (state.accommodation === "Other" && state.accommodationCustom) {
      finalAccommodation = `Other: ${state.accommodationCustom}`;
    }

    return {
      employerid: parseInt(state.employerid, 10), // CRITICAL: Database expects Integer
      positionTitle: state.positionTitle || "",
      country: state.country || "",
      openingsCount: parseInt(state.openingsCount || "0", 10),
      status: state.status || "Open",
      requirements: state.requirements || "",
      food: finalFood,
      accommodation: finalAccommodation,
      dutyHours: state.dutyHours ? parseInt(state.dutyHours, 10) : null,
      overtime: state.overtime ? parseInt(state.overtime, 10) : null,
      contractPeriod: state.contractPeriod ? parseInt(state.contractPeriod, 10) : null,
      selectionType: state.selectionType || "CV Selection",
    };
  };

  // ADD TAB HANDLER
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm(formData, setErrors)) {
      toast.error("Please select an employer and enter a position.");
      return;
    }

    setIsSaving(true);
    const payload = buildPayload(formData);
    const res = await window.electronAPI.addJobOrder({ user, data: payload });

    if (res.success) {
      addJobToStore(res.data); // Update global store
      setFormData(initialForm);
      setErrors({});
      toast.success("Job Order added successfully!");
    } else {
      toast.error(res.error || "Failed to add job order.");
    }
    setIsSaving(false);
  };

  // VIEW TAB HANDLER (Fixed for Immediate Refresh)
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
      // 1. Update global store
      updateJobInStore(res.data);
      
      // 2. IMMEDIATE UI REFRESH: Re-sync local view form with actual DB response
      const job = res.data;
      let foodValue = job.food || "";
      let foodCustomValue = "";
      if (foodValue.startsWith("Other: ")) {
        foodCustomValue = foodValue.replace("Other: ", "");
        foodValue = "Other";
      }

      let accommodationValue = job.accommodation || "";
      let accommodationCustomValue = "";
      if (accommodationValue.startsWith("Other: ")) {
        accommodationCustomValue = accommodationValue.replace("Other: ", "");
        accommodationValue = "Other";
      }

      setViewForm({
        employerid: job.employerid,
        positionTitle: job.positionTitle,
        country: job.country || "",
        openingsCount: job.openingsCount?.toString() || "1",
        status: job.status,
        requirements: job.requirements || "",
        food: foodValue,
        foodCustom: foodCustomValue,
        accommodation: accommodationValue,
        accommodationCustom: accommodationCustomValue,
        dutyHours: job.dutyHours || "",
        overtime: job.overtime || "",
        contractPeriod: job.contractPeriod || "",
        selectionType: job.selectionType || "CV Selection",
      });

      toast.success(`Job updated successfully.`);
      setIsEditing(false);
      setViewErrors({});
    } else {
      toast.error(res.error || "Update failed");
    }
    setViewSaving(false);
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
        <p>⏳ Loading jobs and employers...</p>
      </div>
    );
  }

  const renderJobFormFields = (state, setState, disabled = false) => {
    const onChange = disabled ? undefined : handleFormChange(state, setState);

    return (
      <div className={`job-grid-4 ${disabled ? "read-grid" : ""}`}>
        {/* EMPLOYER */}
        <div className="form-group">
          <label>🏢 Company (Employer)</label>
          <select
            name="employerid"
            value={state.employerid}
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

        {/* POSITION */}
        <div className="form-group">
          <label>💼 Position</label>
          <input
            type="text"
            name="positionTitle"
            value={state.positionTitle}
            onChange={onChange}
            placeholder="e.g. Admin"
            disabled={disabled}
          />
        </div>

        {/* COUNTRY */}
        <div className="form-group">
          <label>🌍 Country</label>
          <input
            type="text"
            name="country"
            value={state.country}
            onChange={onChange}
            placeholder="e.g. Japan"
            disabled={disabled}
          />
        </div>

        {/* OPENINGS */}
        <div className="form-group">
          <label>🔢 No. of Openings</label>
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

        {/* FOOD */}
        <div className="form-group">
          <label>🍽️ Food</label>
          <select
            name="food"
            value={state.food}
            onChange={onChange}
            disabled={disabled}
          >
            <option value="">-- Select --</option>
            {foodOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {state.food === "Other" && !disabled && (
            <input
              type="text"
              name="foodCustom"
              value={state.foodCustom}
              onChange={onChange}
              placeholder="Specify food details..."
              className="custom-input-field"
              style={{ marginTop: "8px" }}
            />
          )}
          {state.food === "Other" && disabled && state.foodCustom && (
            <div className="custom-value-display">{state.foodCustom}</div>
          )}
        </div>

        {/* ACCOMMODATION */}
        <div className="form-group">
          <label>🏠 Accommodation</label>
          <select
            name="accommodation"
            value={state.accommodation}
            onChange={onChange}
            disabled={disabled}
          >
            <option value="">-- Select --</option>
            {accommodationOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {state.accommodation === "Other" && !disabled && (
            <input
              type="text"
              name="accommodationCustom"
              value={state.accommodationCustom}
              onChange={onChange}
              placeholder="Specify accommodation details..."
              className="custom-input-field"
              style={{ marginTop: "8px" }}
            />
          )}
          {state.accommodation === "Other" &&
            disabled &&
            state.accommodationCustom && (
              <div className="custom-value-display">
                {state.accommodationCustom}
              </div>
            )}
        </div>

        {/* DUTY HOURS */}
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

        {/* OVERTIME */}
        <div className="form-group">
          <label>⏱️ Overtime (OT)</label>
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

        {/* CONTRACT PERIOD */}
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

        {/* SELECTION TYPE */}
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

        {/* STATUS */}
        <div className="form-group">
          <label>📊 Status</label>
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

        <div className="form-group form-group-empty"></div>

        {/* REQUIREMENTS */}
        <div className="form-group form-group-full">
          <label>📝 Requirements</label>
          <textarea
            name="requirements"
            value={state.requirements}
            onChange={onChange}
            rows="3"
            disabled={disabled}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="job-page-container">
      {/* HEADER */}
      <div className="job-page-header">
        <h1>
          <FiClipboard /> Job Order Management
        </h1>
      </div>

      {/* TABS */}
      <div className="job-tabs">
        <button
          className={`job-tab ${activeTab === "add" ? "job-tab-active" : ""}`}
          onClick={() => handleTabChange("add")}
        >
          <FiPlus /> Add New
        </button>
        <button
          className={`job-tab ${activeTab === "list" ? "job-tab-active" : ""}`}
          onClick={() => handleTabChange("list")}
        >
          View / Edit
        </button>
      </div>

      {/* ADD TAB */}
      {activeTab === "add" && (
        <div className="tab-panel fade-in">
          <div className="job-card-wide job-card-elevated">
            <div className="job-card-header">
              <h2>📋 Create New Job Order</h2>
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
                    {isSaving ? "💾 Saving..." : "💾 Add Job Order"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VIEW/EDIT TAB */}
      {activeTab === "list" && (
        <div className="tab-panel fade-in">
          <div className="view-tab-header">
            <span className="view-tab-pill">📊 Showing {jobCount} Job Orders</span>
            <span className="view-tab-hint">
              Tip: Click ✏️ to edit or 🗑️ to move to recycle bin
            </span>
          </div>

          {jobCount === 0 ? (
            <p className="empty-text">
              📭 No job orders found. Switch to "Add New" to create one.
            </p>
          ) : (
            <div className="job-list-container">
              {/* JOB SELECTOR */}
              <div className="job-selector-bar">
                <label>Select Job Order:</label>
                <select value={selectedIndex} onChange={onJobSelect}>
                  {jobs.map((job, idx) => (
                    <option key={job.id} value={idx}>
                      {job.positionTitle} - {getEmployerName(job.employerid)}
                    </option>
                  ))}
                </select>
              </div>

              {/* SELECTED JOB CARD */}
              {selectedJob && (
                <div
                  className={`job-card-wide job-card-elevated ${
                    isEditing ? "job-card-editing" : ""
                  }`}
                >
                  <div className="job-card-header">
                    <div className="job-title-block">
                      <span className="job-title">
                        {isEditing ? "✏️ Editing Job Order" : selectedJob.positionTitle}
                      </span>
                      <span className="job-subtitle">
                        {getEmployerName(selectedJob.employerid)} •{" "}
                        {selectedJob.country || "N/A"}
                      </span>
                    </div>
                    <div className="job-header-actions">
                      <span
                        className={`status-pill ${getStatusBadgeClass(
                          selectedJob.status
                        )}`}
                      >
                        {selectedJob.status === "Open" && "✅ "}
                        {selectedJob.status === "On Hold" && "⏸️ "}
                        {selectedJob.status === "Closed" && "🔒 "}
                        {selectedJob.status}
                      </span>

                      {!isEditing ? (
                        <>
                          <button
                            className="icon-btn"
                            title="Edit"
                            onClick={startEdit}
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            className="icon-btn danger"
                            title="Delete"
                            onClick={askDeleteJob}
                          >
                            <FiTrash2 />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="icon-btn success"
                            title="Save"
                            onClick={saveEdit}
                            disabled={viewSaving}
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
                      ? renderJobFormFields(viewForm, setViewForm, false)
                      : renderJobFormFields(viewForm, () => {}, true)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CONFIRM DELETE DIALOG */}
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
