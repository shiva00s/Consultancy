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
import { useShallow } from "zustand/react/shallow";
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
    foodCustom: "",
    accommodation: "",
    accommodationCustom: "",
    dutyHours: "",
    overtime: "",
    contractPeriod: "",
    selectionType: "CV Selection",
  };

  // ✅ Direct zustand selectors with useShallow
  const {
    jobs,
    employers,
    isLoaded,
    addJob,
    updateJob,
    deleteJob,
    fetchInitialData,
  } = useDataStore(
    useShallow((state) => ({
      jobs: state.jobs,
      employers: state.employers,
      isLoaded: state.isLoaded,
      addJob: state.addJob,
      updateJob: state.updateJob,
      deleteJob: state.deleteJob,
      fetchInitialData: state.fetchInitialData,
    }))
  );

  const { user } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
    }))
  );

  // 🔥 Fetch data on component mount
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const [activeTab, setActiveTab] = useState("add");

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

  const selectedJob = jobs[selectedIndex] || null;
  const jobCount = jobs.length;

  // confirm delete dialog state
  const [confirmDeleteState, setConfirmDeleteState] = useState({
    open: false,
    jobId: null,
    jobName: "",
  });

  const selectionTypeOptions = [
    "CV Selection",
    "CV Selection + Video Interview",
    "Zoom Interview",
    "Direct Client Interview",
  ];

  const foodOptions = ["Yes", "No", "Company Provided", "Self", "Other"];

  const accommodationOptions = [
    "Yes",
    "No",
    "Company Provided",
    "Self",
    "Other",
  ];

  const getEmployerName = (employerId) => {
    const emp = employers.find((e) => e.id === employerId);
    return emp ? emp.companyName : "Unknown";
  };

  // Validation function
  const validate = (data, setErr) => {
    const errs = {};

    if (!data.employer_id || data.employer_id === "" || data.employer_id === "0") {
      errs.employer_id = "Select an employer.";
    }

    if (!data.positionTitle || data.positionTitle.trim() === "") {
      errs.positionTitle = "Position Title is required.";
    }

    const openings = parseInt(data.openingsCount, 10);
    if (isNaN(openings) || openings < 1) {
      errs.openingsCount = "Openings must be at least 1.";
    }

    setErr(errs);
    return Object.keys(errs).length === 0;
  };

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
      employer_id: job.employer_id,
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
        // ✅ Always sync when job data changes
        syncSelectedToForm(selectedIndex);
      }
    }
  }, [jobs, activeTab, selectedIndex]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "list") {
      setViewErrors({});
      setIsEditing(false);
      if (jobs.length > 0) {
        syncSelectedToForm(selectedIndex);
      } else {
        setViewForm(initialForm);
      }
    }
  };

  // 🔥 AUTO-POPULATE POSITION & COUNTRY FROM EMPLOYER (ADD MODE)
  useEffect(() => {
    if (addForm.employer_id) {
      const selectedEmployer = employers.find(
        (e) => e.id === parseInt(addForm.employer_id)
      );
      if (selectedEmployer) {
        setAddForm((prev) => ({
          ...prev,
          country: selectedEmployer.country || "",
          positionTitle: selectedEmployer.position || "",
        }));
      }
    }
  }, [addForm.employer_id, employers]);

  // 🔥 AUTO-POPULATE POSITION & COUNTRY FROM EMPLOYER (VIEW/EDIT MODE)
  useEffect(() => {
    if (viewForm.employer_id && isEditing) {
      const selectedEmployer = employers.find(
        (e) => e.id === parseInt(viewForm.employer_id)
      );
      if (selectedEmployer) {
        setViewForm((prev) => ({
          ...prev,
          country: selectedEmployer.country || "",
          positionTitle: selectedEmployer.position || "",
        }));
      }
    }
  }, [viewForm.employer_id, employers, isEditing]);

  // ADD handlers
  const onAddChange = (e) => {
    const { name, value } = e.target;
    let v = value;

    if (["openingsCount", "dutyHours", "overtime", "contractPeriod"].includes(name)) {
      v = value.replace(/[^\d]/g, "");
    }

    setAddForm((p) => ({ ...p, [name]: v }));
    if (addErrors[name]) setAddErrors((p) => ({ ...p, [name]: null }));
  };

  // Build payload with proper "Other" handling
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
      employer_id: parseInt(state.employer_id, 10),
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

  const onAddSubmit = async (e) => {
    e.preventDefault();
    if (!validate(addForm, setAddErrors)) {
      toast.error("Please select an employer and enter a position.");
      return;
    }

    setAddSaving(true);
    const payload = buildPayload(addForm);
    const res = await window.electronAPI.addJobOrder({ user, data: payload });

    if (res.success) {
      addJob(res.data);
      setAddForm(initialForm);
      setAddErrors({});
      toast.success("Job Order added successfully!");
    } else {
      toast.error(res.error || "Failed to add job order.");
    }
    setAddSaving(false);
  };

  // VIEW handlers
  const onViewChange = (e) => {
    const { name, value } = e.target;
    let v = value;

    if (["openingsCount", "dutyHours", "overtime", "contractPeriod"].includes(name)) {
      v = value.replace(/[^\d]/g, "");
    }

    setViewForm((p) => ({ ...p, [name]: v }));
    if (viewErrors[name]) setViewErrors((p) => ({ ...p, [name]: null }));
  };

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

    if (!validate(viewForm, setViewErrors)) {
      toast.error("Fix validation errors before saving.");
      return;
    }

    setViewSaving(true);

    try {
      const payload = buildPayload(viewForm);
      const res = await window.electronAPI.updateJobOrder({
        user,
        id: selectedJob.id,
        data: payload,
      });

      if (res.success) {
        // Update global store
        updateJob(res.data);

        // ✅ Immediately update local form state with server response
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

        const updatedData = {
          employer_id: job.employer_id,
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
        };

        setViewForm(updatedData);
        setIsEditing(false);
        setViewErrors({});
        toast.success(`Job "${res.data.positionTitle}" updated successfully.`);
      } else {
        toast.error(res.error || "Update failed");
      }
    } catch (error) {
      console.error("Update error:", error);
      toast.error("An error occurred while updating.");
    } finally {
      setViewSaving(false);
    }
  };

  // open confirm dialog
  const onDeleteClick = () => {
    if (!selectedJob) return;
    setConfirmDeleteState({
      open: true,
      jobId: selectedJob.id,
      jobName: selectedJob.positionTitle,
    });
  };

  // confirm delete from dialog
  const handleConfirmDelete = async () => {
    const { jobId, jobName } = confirmDeleteState;
    setConfirmDeleteState({ open: false, jobId: null, jobName: "" });
    if (!jobId) return;

    const res = await window.electronAPI.deleteJobOrder({ user, id: jobId });

    if (res.success) {
      deleteJob(jobId);
      toast.success(`Job Order "${jobName}" moved to Recycle Bin.`);
    } else {
      toast.error(res.error || "Delete failed.");
    }
  };

  const handleCancelDelete = () => {
    setConfirmDeleteState({ open: false, jobId: null, jobName: "" });
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

  const renderJobFormFields = (state, onChange, disabled = false) => {
    return (
      <div className={`job-grid-4 ${disabled ? "read-grid" : ""}`}>
        {/* EMPLOYER */}
        <div className={`form-group ${addErrors.employer_id || viewErrors.employer_id ? "error" : ""}`}>
          <label>
            <span className="emoji-inline">🏢</span> COMPANY (EMPLOYER)
          </label>
          <select
            name="employer_id"
            value={state.employer_id}
            onChange={onChange}
            disabled={disabled}
            style={
              addErrors.employer_id || viewErrors.employer_id
                ? { borderColor: "red" }
                : {}
            }
          >
            <option value="">-- Select Employer --</option>
            {employers.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.companyName}
              </option>
            ))}
          </select>
          {(addErrors.employer_id || viewErrors.employer_id) && (
            <p className="error-text">
              {addErrors.employer_id || viewErrors.employer_id}
            </p>
          )}
        </div>

        {/* POSITION */}
        <div className={`form-group ${addErrors.positionTitle || viewErrors.positionTitle ? "error" : ""}`}>
          <label>
            <span className="emoji-inline">🎯</span> POSITION
          </label>
          <input
            type="text"
            name="positionTitle"
            value={state.positionTitle}
            onChange={onChange}
            placeholder="e.g. Admin"
            disabled={disabled}
            style={
              addErrors.positionTitle || viewErrors.positionTitle
                ? { borderColor: "red" }
                : {}
            }
          />
          {(addErrors.positionTitle || viewErrors.positionTitle) && (
            <p className="error-text">
              {addErrors.positionTitle || viewErrors.positionTitle}
            </p>
          )}
        </div>

        {/* COUNTRY */}
        <div className="form-group">
          <label>
            <span className="emoji-inline">🌍</span> COUNTRY
          </label>
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
        <div className={`form-group ${addErrors.openingsCount || viewErrors.openingsCount ? "error" : ""}`}>
          <label>
            <span className="emoji-inline">🔢</span> NO. OF OPENINGS
          </label>
          <input
            type="text"
            inputMode="numeric"
            name="openingsCount"
            value={state.openingsCount}
            onChange={onChange}
            placeholder="1"
            disabled={disabled}
            style={
              addErrors.openingsCount || viewErrors.openingsCount
                ? { borderColor: "red" }
                : {}
            }
          />
          {(addErrors.openingsCount || viewErrors.openingsCount) && (
            <p className="error-text">
              {addErrors.openingsCount || viewErrors.openingsCount}
            </p>
          )}
        </div>

        {/* FOOD */}
        <div className="form-group">
          <label>
            <span className="emoji-inline">🍽️</span> FOOD
          </label>
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
          <label>
            <span className="emoji-inline">🏠</span> ACCOMMODATION
          </label>
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
          {state.accommodation === "Other" && disabled && state.accommodationCustom && (
            <div className="custom-value-display">{state.accommodationCustom}</div>
          )}
        </div>

        {/* DUTY HOURS */}
        <div className="form-group">
          <label>
            <span className="emoji-inline">⏰</span> DUTY HOURS
          </label>
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
          <label>
            <span className="emoji-inline">⏱️</span> OVERTIME (OT)
          </label>
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
          <label>
            <span className="emoji-inline">📅</span> CONTRACT PERIOD (MONTHS)
          </label>
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
          <label>
            <span className="emoji-inline">🎯</span> SELECTION TYPE
          </label>
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
          <label>
            <span className="emoji-inline">📊</span> STATUS
          </label>
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
          <label>
            <span className="emoji-inline">📝</span> REQUIREMENTS
          </label>
          <textarea
            name="requirements"
            value={state.requirements}
            onChange={onChange}
            placeholder="job requirements, skills, experience, etc."
            rows="3"
            disabled={disabled}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="job-page-container fade-in">
      {/* HEADER */}
      <header className="job-page-header">
        <h1>
          <span className="emoji-inline">📋</span> Job Order Management
        </h1>
      </header>

      {/* TABS */}
      <div className="job-tabs">
        <button
          type="button"
          className={`job-tab ${activeTab === "add" ? "job-tab-active" : ""}`}
          onClick={() => handleTabChange("add")}
        >
          <FiPlus />
          <span className="emoji-inline">➕</span> Add New
        </button>
        <button
          type="button"
          className={`job-tab ${activeTab === "list" ? "job-tab-active" : ""}`}
          onClick={() => handleTabChange("list")}
        >
          <FiClipboard />
          <span className="emoji-inline">👁️</span> View/Edit{" "}
          <span className="tab-count-pill">
            <span className="emoji-inline">📊</span> {jobCount}
          </span>
        </button>
      </div>

      {/* TAB 1: ADD NEW */}
      {activeTab === "add" && (
        <section className="job-card-wide job-card-elevated slide-up">
          <div className="job-card-header">
            <div className="job-title-block">
              <div className="job-title">
                <span className="emoji-inline">🆕</span> New Job Order Setup
              </div>
              <div className="job-subtitle">
                <span className="emoji-inline">📋</span> Create a job order linked to an employer
              </div>
            </div>
          </div>

          <div className="job-card-body">
            <form onSubmit={onAddSubmit}>
              {renderJobFormFields(addForm, onAddChange, false)}

              <div className="form-footer">
                <button type="submit" className="btn-primary-lg" disabled={addSaving}>
                  {addSaving ? (
                    <span className="emoji-inline">⏳</span>
                  ) : (
                    <span className="emoji-inline">💾</span>
                  )}{" "}
                  Save Job Order
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* TAB 2: VIEW & MANAGE */}
      {activeTab === "list" &&
        (jobCount === 0 ? (
          <p className="empty-text">
            <span className="emoji-inline">📭</span> No job orders available. Create one from the Add New tab.
          </p>
        ) : (
          <section className="job-card-wide job-card-elevated job-card-editing slide-up">
            <div className="job-card-header">
              <div className="job-title-block">
                <div className="job-title">
                  <span className="emoji-inline">📋</span>{" "}
                  {viewForm.positionTitle || "No Job Selected"}
                </div>
                <div className="job-subtitle">
                  {viewForm.country || getEmployerName(viewForm.employer_id) ? (
                    <>
                      <span className="emoji-inline">🏢</span>{" "}
                      {getEmployerName(viewForm.employer_id) || "N/A"}{" "}
                      <span className="emoji-inline">🌍</span> {viewForm.country || "N/A"}
                    </>
                  ) : (
                    ""
                  )}
                </div>
              </div>

              <div className="job-header-actions">
                <span className="job-count-chip">
                  <span className="emoji-inline">📊</span> {jobCount} Job Orders
                </span>
                <select
                  className="job-picker-select"
                  value={selectedIndex}
                  onChange={onJobSelect}
                  disabled={jobs.length === 0}
                >
                  {jobs.length === 0 ? (
                    <option>No jobs found</option>
                  ) : (
                    jobs.map((j, i) => (
                      <option key={j.id} value={i}>
                        {i + 1}. {j.positionTitle} - {getEmployerName(j.employer_id)}
                      </option>
                    ))
                  )}
                </select>

                {!isEditing ? (
                  <>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Edit job order"
                      onClick={startEdit}
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="Move job order to Recycle Bin"
                      onClick={onDeleteClick}
                      disabled={!selectedJob}
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
                    >
                      <FiX />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="job-card-body">
              {isEditing
                ? renderJobFormFields(viewForm, onViewChange, false)
                : renderJobFormFields(viewForm, () => {}, true)}
            </div>
          </section>
        ))}

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        open={confirmDeleteState.open}
        title="Move job order to Recycle Bin?"
        message={
          confirmDeleteState.jobName
            ? `Job "${confirmDeleteState.jobName}" and all linked placements will be moved to the Recycle Bin.`
            : "This job order and all linked placements will be moved to the Recycle Bin."
        }
        confirmLabel="Yes, move to Recycle Bin"
        cancelLabel="No, keep job"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}

export default JobOrderListPage;
