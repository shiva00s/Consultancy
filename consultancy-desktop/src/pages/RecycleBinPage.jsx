// src/pages/RecycleBinPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  FiTrash2,
  FiRotateCcw,
  FiUsers,
  FiServer,
  FiClipboard,
  FiFileText,
  FiBriefcase,
  FiMapPin,
  FiActivity,
  FiCalendar,
  FiSend,
} from "react-icons/fi";
import "../css/RecycleBinPage.css";
import Tabs from "../components/Tabs";
import toast from "react-hot-toast";
import PermanentDeleteModal from "../components/modals/PermanentDeleteModal";
import RestoreConfirmModal from "../components/modals/RestoreConfirmModal";

function RecycleBinPage({ user }) {
  const [deletedCandidates, setDeletedCandidates] = useState([]);
  const [deletedEmployers, setDeletedEmployers] = useState([]);
  const [deletedJobs, setDeletedJobs] = useState([]);
  const [deletedRequiredDocs, setDeletedRequiredDocs] = useState([]);
  const [deletedPlacements, setDeletedPlacements] = useState([]);
  const [deletedPassports, setDeletedPassports] = useState([]);
  const [deletedVisas, setDeletedVisas] = useState([]);
  const [deletedMedical, setDeletedMedical] = useState([]);
  const [deletedInterviews, setDeletedInterviews] = useState([]);
  const [deletedTravel, setDeletedTravel] = useState([]);
  const [deletedPassportMovements, setDeletedPassportMovements] = useState([]);

  const [restorePrompt, setRestorePrompt] = useState(null); // {title, description, handler}
  const [loading, setLoading] = useState(true);
  const [deleteModalItem, setDeleteModalItem] = useState(null);

  const canDeletePermanently = user?.role === "super_admin";

  const fetchAllDeleted = useCallback(async () => {
    if (!user || !user.id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [
      candRes,
      empRes,
      jobRes,
      reqDocRes,
      placementRes,
      passportRes,
      visaRes,
      medRes,
      intRes,
      travelRes,
      movementRes,     
    ] = await Promise.all([
      window.electronAPI.getDeletedCandidates(),
      window.electronAPI.getDeletedEmployers(),
      window.electronAPI.getDeletedJobOrders(),
      window.electronAPI.getDeletedRequiredDocuments(),
      window.electronAPI.getDeletedPlacements(),
      window.electronAPI.getDeletedPassports(),
      window.electronAPI.getDeletedVisas(),
      window.electronAPI.getDeletedMedical(),
      window.electronAPI.getDeletedInterviews(),
      window.electronAPI.getDeletedTravel(),
      window.electronAPI.getAllDeletedPassportMovements(user),
    ]);

    if (candRes.success) setDeletedCandidates(candRes.data);
    else toast.error(candRes.error);

    if (empRes.success) setDeletedEmployers(empRes.data);
    else toast.error(empRes.error);

    if (jobRes.success) setDeletedJobs(jobRes.data);
    else toast.error(jobRes.error);

    if (reqDocRes.success) setDeletedRequiredDocs(reqDocRes.data);
    else toast.error(reqDocRes.error);

    if (placementRes.success) setDeletedPlacements(placementRes.data);
    else toast.error(placementRes.error);

    if (passportRes.success) setDeletedPassports(passportRes.data);
    else toast.error(passportRes.error);

    if (visaRes.success) setDeletedVisas(visaRes.data);
    else toast.error(visaRes.error);

    if (medRes.success) setDeletedMedical(medRes.data);
    else toast.error(medRes.error);

    if (intRes.success) setDeletedInterviews(intRes.data);
    else toast.error(intRes.error);

    if (travelRes.success) setDeletedTravel(travelRes.data);
    else toast.error(travelRes.error);

    if (movementRes.success) setDeletedPassportMovements(movementRes.data);
  else toast.error(movementRes.error);

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAllDeleted();
  }, [fetchAllDeleted]);

  const handlePermanentDelete = (id, targetType) => {
    setDeleteModalItem(null);
    const updater = (list) => list.filter((item) => item.id !== id);

    switch (targetType) {
      case "candidates":
        setDeletedCandidates(updater);
        break;
      case "employers":
        setDeletedEmployers(updater);
        break;
      case "job_orders":
        setDeletedJobs(updater);
        break;
      case "required_docs":
        setDeletedRequiredDocs(updater);
        break;
      case "placements":
        setDeletedPlacements(updater);
        break;
      case "passports":
        setDeletedPassports(updater);
        break;
      case "visas":
        setDeletedVisas(updater);
        break;
      case "medical":
        setDeletedMedical(updater);
        break;
      case "interviews":
        setDeletedInterviews(updater);
        break;
      case "travel":
        setDeletedTravel(updater);
        break;
        case "passport_movements":
  setDeletedPassportMovements(updater);
  break;
      default:
        break;
    }
  };

  const renderItemActions = (item, type, restoreHandler) => (
    <div className="item-actions">
      {canDeletePermanently && (
        <button
          className="doc-btn delete"
          title={`Permanently delete ${type}`}
          onClick={() => setDeleteModalItem({ item, type })}
        >
          <FiTrash2 />
        </button>
      )}
      <button
        className="doc-btn view"
        onClick={() =>
          restoreHandler(
            item.id,
            item.name ||
              item.companyName ||
              item.positionTitle ||
              item.candidateName ||
              item.description ||
              "N/A"
          )
        }
        title={`Restore ${type}`}
      >
        <FiRotateCcw />
      </button>
    </div>
  );

  // helper to open restore modal
  const openRestorePrompt = (title, description, handler) => {
    setRestorePrompt({ title, description, handler });
  };

  // restore handlers – all routed through RestoreConfirmModal

  const handleRestoreCandidate = (id, name) =>
    openRestorePrompt(
      "Restore candidate?",
      `Restore candidate: ${name}?`,
      async () => {
        const res = await window.electronAPI.restoreCandidate({ user, id });
        if (res.success) {
          setDeletedCandidates((prev) => prev.filter((c) => c.id !== id));
          toast.success(`Candidate ${name} restored.`);
        } else toast.error(res.error);
      }
    );

  const handleRestoreEmployer = (id, name) =>
    openRestorePrompt(
      "Restore employer?",
      `Restore employer: ${name}? This will also restore associated jobs.`,
      async () => {
        const res = await window.electronAPI.restoreEmployer({ user, id });
        if (res.success) {
          toast.success(`Employer ${name} and linked jobs restored.`);
          fetchAllDeleted();
        } else toast.error(res.error);
      }
    );

  const handleRestoreJob = (id, name) =>
    openRestorePrompt(
      "Restore job order?",
      `Restore job: ${name}? This will also restore linked placements.`,
      async () => {
        const res = await window.electronAPI.restoreJobOrder({ user, id });
        if (res.success) {
          toast.success(`Job ${name} and linked placements restored.`);
          fetchAllDeleted();
        } else toast.error(res.error);
      }
    );

  const handleRestoreRequiredDoc = (id, name) =>
    openRestorePrompt(
      "Restore required document?",
      `Restore required document: ${name}?`,
      async () => {
        const res = await window.electronAPI.restoreRequiredDocument({
          user,
          id,
        });
        if (res.success) {
          setDeletedRequiredDocs((prev) => prev.filter((d) => d.id !== id));
          toast.success(`Required document "${name}" restored.`);
        } else toast.error(res.error);
      }
    );

  const handleRestorePlacement = (id, display) =>
    openRestorePrompt(
      "Restore placement?",
      `Restore placement: ${display}?`,
      async () => {
        const res = await window.electronAPI.restorePlacement({ user, id });
        if (res.success) {
          setDeletedPlacements((prev) => prev.filter((p) => p.id !== id));
          toast.success("Placement restored.");
        } else toast.error(res.error);
      }
    );

  const handleRestorePassport = (id, name) =>
    openRestorePrompt(
      "Restore passport?",
      `Restore passport for: ${name}?`,
      async () => {
        const res = await window.electronAPI.restorePassport({ user, id });
        if (res.success) {
          setDeletedPassports((prev) => prev.filter((p) => p.id !== id));
          toast.success("Passport restored.");
        } else toast.error(res.error);
      }
    );

  const handleRestoreVisa = (id, name) =>
    openRestorePrompt(
      "Restore visa tracking?",
      `Restore visa tracking for: ${name}?`,
      async () => {
        const res = await window.electronAPI.restoreVisa({ user, id });
        if (res.success) {
          setDeletedVisas((prev) => prev.filter((v) => v.id !== id));
          toast.success("Visa tracking restored.");
        } else toast.error(res.error);
      }
    );

  const handleRestoreMedical = (id, name) =>
    openRestorePrompt(
      "Restore medical record?",
      `Restore medical record for: ${name}?`,
      async () => {
        const res = await window.electronAPI.restoreMedical({ user, id });
        if (res.success) {
          setDeletedMedical((prev) => prev.filter((m) => m.id !== id));
          toast.success("Medical record restored.");
        } else toast.error(res.error);
      }
    );

  const handleRestoreInterview = (id, name) =>
    openRestorePrompt(
      "Restore interview record?",
      `Restore interview record for: ${name}?`,
      async () => {
        const res = await window.electronAPI.restoreInterview({ user, id });
        if (res.success) {
          setDeletedInterviews((prev) => prev.filter((i) => i.id !== id));
          toast.success("Interview record restored.");
        } else toast.error(res.error);
      }
    );

  const handleRestoreTravel = (id, name) =>
    openRestorePrompt(
      "Restore travel record?",
      `Restore travel record for: ${name}?`,
      async () => {
        const res = await window.electronAPI.restoreTravel({ user, id });
        if (res.success) {
          setDeletedTravel((prev) => prev.filter((t) => t.id !== id));
          toast.success("Travel record restored.");
        } else toast.error(res.error);
      }
    );

  const renderList = (items, emptyText, renderRow) => (
    <div className="recycle-list-content">
      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <div className="recycle-grid">{items.map(renderRow)}</div>
      )}
    </div>
  );

  const tabs = [
    {
      key: "candidates",
      title: `Candidates (${deletedCandidates.length})`,
      icon: <FiUsers />,
      content: renderList(
        deletedCandidates,
        "No deleted candidates found.",
        (candidate) => (
          <div key={candidate.id} className="recycle-item">
            <div className="item-info">
              <strong>{candidate.name}</strong>
              <span>Position: {candidate.Position || "N/A"}</span>
            </div>
            {renderItemActions(
              candidate,
              "candidates",
              handleRestoreCandidate
            )}
          </div>
        )
      ),
    },
    {
      key: "employers",
      title: `Employers (${deletedEmployers.length})`,
      icon: <FiServer />,
      content: renderList(
        deletedEmployers,
        "No deleted employers found.",
        (emp) => (
          <div key={emp.id} className="recycle-item">
            <div className="item-info">
              <strong>{emp.companyName}</strong>
              <span>Country: {emp.country || "N/A"}</span>
            </div>
            {renderItemActions(emp, "employers", handleRestoreEmployer)}
          </div>
        )
      ),
    },
    {
      key: "jobs",
      title: `Job Orders (${deletedJobs.length})`,
      icon: <FiClipboard />,
      content: renderList(
        deletedJobs,
        "No deleted jobs found.",
        (job) => (
          <div key={job.id} className="recycle-item">
            <div className="item-info">
              <strong>{job.positionTitle}</strong>
              <span>Company: {job.companyName || "N/A"}</span>
            </div>
            {renderItemActions(job, "job_orders", handleRestoreJob)}
          </div>
        )
      ),
    },
    {
      key: "placements",
      title: `Placements (${deletedPlacements.length})`,
      icon: <FiBriefcase />,
      content: renderList(
        deletedPlacements,
        "No deleted placements found.",
        (placement) => (
          <div key={placement.id} className="recycle-item">
            <div className="item-info">
              <strong>{placement.candidateName}</strong>
              <span>
                Job: {placement.jobTitle || "N/A"} –{" "}
                {placement.companyName || "N/A"}
              </span>
            </div>
            {renderItemActions(
              placement,
              "placements",
              handleRestorePlacement
            )}
          </div>
        )
      ),
    },
    {
      key: "required_docs",
      title: `Required Docs (${deletedRequiredDocs.length})`,
      icon: <FiFileText />,
      content: renderList(
        deletedRequiredDocs,
        "No deleted required documents found.",
        (doc) => (
          <div key={doc.id} className="recycle-item">
            <div className="item-info">
              <strong>{doc.name}</strong>
            </div>
            {renderItemActions(doc, "required_docs", handleRestoreRequiredDoc)}
          </div>
        )
      ),
    },
    {
  key: "passport_movements",
  title: `Movements (${deletedPassportMovements.length})`,
  icon: <FiActivity />,
  content: renderList(
    deletedPassportMovements,
    "No deleted passport movements found.",
    (movement) => {
      // ✅ Create a descriptive name for the modal
      const movementName = `${movement.movement_type === 'RECEIVE' ? '📥 Received' : '📤 Sent'} - ${movement.date || 'Unknown Date'}${
        movement.candidate_name ? ` (${movement.candidate_name})` : ''
      }`;

      return (
        <div key={movement.id} className="recycle-item">
          <div className="item-info">
            <strong>{movement.candidate_name || `Movement #${movement.id}`}</strong>
            <span>
              {movement.movement_type} • {movement.method || "N/A"} • {movement.date}
            </span>
          </div>
          <div className="item-actions">
            {canDeletePermanently && (
              <button
                className="doc-btn delete"
                title="Permanently delete passport movement"
                onClick={() => setDeleteModalItem({ 
                  item: {
                    ...movement,
                    name: movementName  // ✅ Add the descriptive name
                  }, 
                  type: "passport_movements" 
                })}
              >
                <FiTrash2 />
              </button>
            )}
            <button
              className="doc-btn view"
              onClick={() => {
                openRestorePrompt(
                  "Restore passport movement?",
                  `Restore movement: ${movementName}?`,
                  async () => {
                    const res = await window.electronAPI.restorePassportMovement({
                      id: movement.id,
                      user: user
                    });

                    if (res.success) {
                      setDeletedPassportMovements((prev) =>
                        prev.filter((m) => m.id !== movement.id)
                      );
                      toast.success("Passport movement restored.");
                    } else {
                      toast.error(res.error);
                    }
                  }
                );
              }}
              title="Restore passport movement"
            >
              <FiRotateCcw />
            </button>
          </div>
        </div>
      );
    }
  ),
},

    {
      key: "visas",
      title: `Visas (${deletedVisas.length})`,
      icon: <FiMapPin />,
      content: renderList(
        deletedVisas,
        "No deleted visas found.",
        (visa) => (
          <div key={visa.id} className="recycle-item">
            <div className="item-info">
              <strong>{visa.candidateName}</strong>
              <span>
                Type: {visa.visaType || "N/A"} – Status:{" "}
                {visa.status || "N/A"}
              </span>
            </div>
            {renderItemActions(visa, "visas", handleRestoreVisa)}
          </div>
        )
      ),
    },
    {
      key: "medical",
      title: `Medical (${deletedMedical.length})`,
      icon: <FiActivity />,
      content: renderList(
        deletedMedical,
        "No deleted medical records found.",
        (m) => (
          <div key={m.id} className="recycle-item">
            <div className="item-info">
              <strong>{m.candidateName}</strong>
              <span>
                Status: {m.status || "N/A"} – Center:{" "}
                {m.centerName || "N/A"}
              </span>
            </div>
            {renderItemActions(m, "medical", handleRestoreMedical)}
          </div>
        )
      ),
    },
    {
      key: "interviews",
      title: `Interviews (${deletedInterviews.length})`,
      icon: <FiCalendar />,
      content: renderList(
        deletedInterviews,
        "No deleted interview records found.",
        (i) => (
          <div key={i.id} className="recycle-item">
            <div className="item-info">
              <strong>{i.candidateName}</strong>
              <span>
                Status: {i.status || "N/A"} – Date:{" "}
                {i.interviewDate || "N/A"}
              </span>
            </div>
            {renderItemActions(i, "interviews", handleRestoreInterview)}
          </div>
        )
      ),
    },
    {
      key: "travel",
      title: `Travel (${deletedTravel.length})`,
      icon: <FiSend />,
      content: renderList(
        deletedTravel,
        "No deleted travel records found.",
        (t) => (
          <div key={t.id} className="recycle-item">
            <div className="item-info">
              <strong>{t.candidateName}</strong>
              <span>
                PNR: {t.pnr || "N/A"} – {t.departure_city || "N/A"} →{" "}
                {t.arrival_city || "N/A"}
              </span>
              <span>Travel Date: {t.travel_date || "N/A"}</span>
            </div>
            {renderItemActions(t, "travel", handleRestoreTravel)}
          </div>
        )
      ),
    },
  ];

  return (
    <div className="recycle-bin-container">
      {deleteModalItem && (
        <PermanentDeleteModal
          user={user}
          item={deleteModalItem.item}
          targetType={deleteModalItem.type}
          onClose={() => setDeleteModalItem(null)}
          onPermanentDelete={(id) =>
            handlePermanentDelete(id, deleteModalItem.type)
          }
        />
      )}

      <RestoreConfirmModal
        open={!!restorePrompt}
        title={restorePrompt?.title}
        description={restorePrompt?.description}
        onCancel={() => setRestorePrompt(null)}
        onConfirm={async () => {
          if (restorePrompt?.handler) {
            await restorePrompt.handler();
          }
          setRestorePrompt(null);
        }}
      />

      <div className="recycle-page-header">
        <div>
          <h1>♻️ Recycle Bin</h1>
          <p>
            Restore accidentally deleted records or permanently remove items you
            no longer need.
          </p>
        </div>
      </div>

      <Tabs tabs={tabs} defaultActiveTab="candidates" />
    </div>
  );
}

export default RecycleBinPage;
