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
import useNotificationStore from '../store/useNotificationStore';
import "../css/JobOrderListPage.css";
import ConfirmDialog from "../components/common/ConfirmDialog";

function JobOrderListPage() {
  // ✅ CORRECT: Hooks first, before any other declarations
  const createNotification = useNotificationStore((s) => s.createNotification);

  const initialForm = {
    employer_id: "",
    positionTitle: "",
    salary: "",
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
    overtimeCustom: "",
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
  const [showDetails, setShowDetails] = useState(false);

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
      salary: job.salary || "",
      country: job.country || "",
      openingsCount: job.openingsCount?.toString() || "1",
      status: job.status,
      requirements: job.requirements || "",
      food: foodValue,
      foodCustom: foodCustomValue,
      accommodation: accommodationValue,
      accommodationCustom: accommodationCustomValue,
      dutyHours: job.dutyHours || "",
      // If stored as 'Other: ...', parse to overtime + overtimeCustom
      overtime: job.overtime && job.overtime.startsWith('Other: ') ? 'Other' : (job.overtime || ''),
      overtimeCustom: job.overtime && job.overtime.startsWith('Other: ') ? job.overtime.replace('Other: ', '') : '',
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

  // Prefill overtime for addForm when country is available and overtime is empty
  useEffect(() => {
    const country = addForm.country && addForm.country.trim();
    if (country && !addForm.overtime) {
      setAddForm((p) => ({ ...p, overtime: `As per ${country} labour law` }));
    }
  }, [addForm.country]);

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

  // Prefill overtime for viewForm when viewing (not editing) and no overtime exists
  useEffect(() => {
    const country = viewForm.country && viewForm.country.trim();
    if (country && !isEditing && !viewForm.overtime) {
      setViewForm((p) => ({ ...p, overtime: `As per ${country} labour law` }));
    }
  }, [viewForm.country, isEditing]);

  // ADD handlers
  const onAddChange = (e) => {
    const { name, value } = e.target;
    let v = value;

    if (["openingsCount", "dutyHours", "contractPeriod"].includes(name)) {
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
      salary: state.salary || null,
      country: state.country || "",
      openingsCount: parseInt(state.openingsCount || "0", 10),
      status: state.status || "Open",
      requirements: state.requirements || "",
      food: finalFood,
      accommodation: finalAccommodation,
      dutyHours: state.dutyHours ? parseInt(state.dutyHours, 10) : null,
      // overtime is stored as free-text (e.g., 'As per Japan labour law', '2hrs', 'Other: custom')
      overtime: state.overtime === 'Other' && state.overtimeCustom ? `Other: ${state.overtimeCustom}` : (state.overtime || null),
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
      try {
        createNotification({
          title: '📋 Job Order added',
          message: `${res.data.positionTitle} added by ${user?.name || user?.username}`,
          type: 'success',
          priority: 'normal',
          link: `/jobs`,
          actor: { id: user?.id, name: user?.name || user?.username },
          target: { type: 'job_order', id: res.data.id },
          meta: { positionTitle: res.data.positionTitle, employerId: res.data.employer_id },
        });
      } catch (e) {}
    } else {
      toast.error(res.error || "Failed to add job order.");
    }
    setAddSaving(false);
  };

  // VIEW handlers
  const onViewChange = (e) => {
    const { name, value } = e.target;
    let v = value;

    if (["openingsCount", "dutyHours", "contractPeriod"].includes(name)) {
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
          salary: job.salary || "",
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
        try {
          createNotification({
            title: '✏️ Job Order updated',
            message: `${res.data.positionTitle} updated by ${user?.name || user?.username}`,
            type: 'info',
            priority: 'normal',
            link: `/jobs`,
            actor: { id: user?.id, name: user?.name || user?.username },
            target: { type: 'job_order', id: res.data.id },
            meta: { positionTitle: res.data.positionTitle, employerId: res.data.employer_id },
          });
        } catch (e) {}
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
      try {
        createNotification({
          title: '🗑️ Job Order moved to Recycle Bin',
          message: `${jobName} moved to Recycle Bin by ${user?.name || user?.username}`,
          type: 'warning',
          priority: 'high',
          link: `/recycle-bin`,
          actor: { id: user?.id, name: user?.name || user?.username },
          target: { type: 'job_order', id: jobId },
          meta: { jobName },
        });
      } catch (e) {}
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

        {/* SALARY */}
        <div className="form-group">
          <label>
            <span className="emoji-inline">💰</span> SALARY
          </label>
          <input
            type="text"
            name="salary"
            value={state.salary}
            onChange={onChange}
            placeholder="e.g. 1500 or $1,200/month"
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
          {/* Select with presets and a custom option. Prefilled based on country. */}
          <select name="overtime" value={state.overtime} onChange={onChange} disabled={disabled}>
            <option value="">-- Select OT --</option>
            {(() => {
              const country = (state.country || '').trim();
              const baseLabel = country ? `As per ${country} labour law` : 'As per local law';
              const opts = [baseLabel, '2 hrs', '3 hrs', 'Other'];
              return opts.map((opt) => (
                <option key={opt} value={opt === baseLabel ? baseLabel : opt}>
                  {opt}
                </option>
              ));
            })()}
          </select>

          {/* If user chooses Other, show a free-text input for custom OT */}
          {state.overtime === 'Other' && !disabled && (
            <input
              type="text"
              name="overtimeCustom"
              value={state.overtimeCustom}
              onChange={onChange}
              placeholder="e.g. 2 hrs on weekends or special arrangement"
              className="custom-input-field"
              style={{ marginTop: '8px' }}
            />
          )}
          {state.overtime === 'Other' && disabled && state.overtimeCustom && (
            <div className="custom-value-display">{state.overtimeCustom}</div>
          )}
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
                      {getEmployerName(viewForm.employer_id) || "N/A"}
                      {viewForm.salary ? (
                        <> {" • "}<span className="emoji-inline">💰</span> {viewForm.salary}</>
                      ) : null}
                      {" "}
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
                        {i + 1}. {j.positionTitle} - {getEmployerName(j.employer_id)}{j.salary ? ` • ${j.salary}` : ''}
                      </option>
                    ))
                  )}
                </select>

                {!isEditing ? (
                  <>
                    <button
                      type="button"
                      className="icon-btn"
                      title="View job details"
                      onClick={() => setShowDetails(true)}
                    >
                      <span role="img" aria-label="flag">🇮🇳</span>
                    </button>

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

      {/* JOB DETAILS MODAL - NOW WITH CSS CLASSES */}
      {showDetails && selectedJob && (
        <div className="job-details-modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="job-details-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="job-details-header">
              <div className="job-details-header-top">
                <div>
                  <div className="job-details-header-title">CONGRATULATIONS</div>
                  <div className="job-details-header-subtitle">
                    {getEmployerName(viewForm.employer_id)} - {viewForm.positionTitle}
                  </div>
                </div>
                <div className="job-details-header-date">
                  Date: {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="job-details-body">
              <table className="job-details-table">
                <tbody>
                  <tr>
                    <td>Position</td>
                    <td>{viewForm.positionTitle}</td>
                  </tr>
                  <tr>
                    <td>Employer</td>
                    <td>{getEmployerName(viewForm.employer_id)}</td>
                  </tr>
                  <tr>
                    <td>Country</td>
                    <td>{viewForm.country}</td>
                  </tr>
                  <tr>
                    <td>Salary</td>
                    <td>{viewForm.salary || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td>Duty Hours</td>
                    <td>{viewForm.dutyHours || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td>Overtime (OT)</td>
                    <td>{viewForm.overtime === 'Other' ? viewForm.overtimeCustom || 'Other' : viewForm.overtime || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td>Contract Period</td>
                    <td>{viewForm.contractPeriod ? `${viewForm.contractPeriod} months` : 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer Banner */}
            <div className="job-details-footer-banner">
              {getEmployerName(viewForm.employer_id)} • {viewForm.country}
            </div>

            {/* Action Buttons */}
            <div className="job-details-actions">
              <button className="btn" onClick={async () => {
                try {
                  const dataUrl = createJobImageDataUrl(viewForm, getEmployerName);
                  const a = document.createElement('a');
                  a.href = dataUrl;
                  a.download = `job-${selectedJob.id || 'details'}.png`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                } catch (err) {
                  console.error('Download image failed', err);
                }
              }}>Download</button>
              <button className="btn btn-close" onClick={() => setShowDetails(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default JobOrderListPage;

// -------------------- Helper: Create image data URL from job data --------------------
function createJobImageDataUrl(job, getEmployerNameFn) {
  // Canvas dimensions
  const width = 1000;
  const height = 640;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Always render the printable card using a light theme to ensure high contrast
  // (this avoids low-contrast text when the app theme is dark)
  const headerColor = '#ff7f50';
  const footerColor = '#2aa44f';
  const bodyBg = '#ffffff';
  const bodyText = '#1f2937';

  // Background
  ctx.fillStyle = bodyBg;
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.fillStyle = headerColor;
  ctx.fillRect(0, 0, width, 96);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 28px Inter, Arial';
  ctx.fillText('CONGRATULATIONS', 20, 46);
  ctx.font = '600 14px Inter, Arial';
  ctx.fillText(`${job && job.positionTitle ? job.positionTitle : ''} ${job && job.employer_id ? '- ' + (job.positionTitle ? '' : '') : ''}`, 20, 70);

  // Body panel (white card feel)
  const cardY = 110;
  ctx.fillStyle = bodyBg;
  ctx.fillRect(20, cardY, width - 40, 420);

  // Labels & values (ensure strong contrast and sensible fallbacks)
  ctx.fillStyle = bodyText;
  ctx.font = '600 14px Inter, Arial';
  const labels = ['Position', 'Employer', 'Country', 'Salary', 'Duty Hours', 'Overtime (OT)', 'Contract Period'];
  const values = [
    job.positionTitle || '',
    getEmployerNameFn(job && job.employer_id) || '',
    job.country || '',
    job.salary || '',
    job.dutyHours || '',
    job.overtime === 'Other' ? (job.overtimeCustom || 'Other') : (job.overtime || ''),
    job.contractPeriod ? `${job.contractPeriod} months` : ''
  ];

  ctx.font = '600 12px Inter, Arial';
  for (let i = 0; i < labels.length; i++) {
    const y = cardY + 28 + i * 48;
    // label (muted)
    ctx.fillStyle = '#6b7280';
    ctx.fillText(labels[i], 40, y);
    // value (strong)
    ctx.fillStyle = bodyText;
    ctx.font = '600 16px Inter, Arial';
    ctx.fillText(values[i], 220, y);
    ctx.font = '600 12px Inter, Arial';
    // underline (light)
    ctx.strokeStyle = '#e6e6e6';
    ctx.beginPath();
    ctx.moveTo(40, y + 8);
    ctx.lineTo(width - 60, y + 8);
    ctx.stroke();
  }

  // Footer
  ctx.fillStyle = footerColor;
  ctx.fillRect(0, height - 64, width, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 16px Inter, Arial';
  ctx.fillText(`${getEmployerNameFn(job && job.employer_id) || ''} • ${job.country || ''}`, 20, height - 28);

  return canvas.toDataURL('image/png');
}
