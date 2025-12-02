import React, { useState, useEffect, useCallback } from 'react';
import {
  FiTrash2,
  FiRotateCcw,
  FiUsers,
  FiServer,
  FiClipboard,
  FiAlertTriangle,
  FiFileText,
  FiBriefcase,
  FiMapPin,
} from 'react-icons/fi';
import '../css/RecycleBinPage.css';
import Tabs from '../components/Tabs';
import toast from 'react-hot-toast';
import PermanentDeleteModal from '../components/modals/PermanentDeleteModal';

function RecycleBinPage({ user }) {
  const [deletedCandidates, setDeletedCandidates] = useState([]);
  const [deletedEmployers, setDeletedEmployers] = useState([]);
  const [deletedJobs, setDeletedJobs] = useState([]);
  const [deletedRequiredDocs, setDeletedRequiredDocs] = useState([]);
  const [deletedPlacements, setDeletedPlacements] = useState([]);
  const [deletedPassports, setDeletedPassports] = useState([]);
  const [deletedVisas, setDeletedVisas] = useState([]);

  const [loading, setLoading] = useState(true);
  const [deleteModalItem, setDeleteModalItem] = useState(null);

  const canDeletePermanently = user.role === 'super_admin';

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
    ] = await Promise.all([
      window.electronAPI.getDeletedCandidates(),
      window.electronAPI.getDeletedEmployers(),
      window.electronAPI.getDeletedJobOrders(),
      window.electronAPI.getDeletedRequiredDocuments(),
      window.electronAPI.getDeletedPlacements(),
      window.electronAPI.getDeletedPassports(),
      window.electronAPI.getDeletedVisas(),
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

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAllDeleted();
  }, [fetchAllDeleted]);

  const handlePermanentDelete = (id, targetType) => {
    setDeleteModalItem(null);

    if (targetType === 'candidates') {
      setDeletedCandidates(prev => prev.filter(c => c.id !== id));
    } else if (targetType === 'employers') {
      setDeletedEmployers(prev => prev.filter(e => e.id !== id));
    } else if (targetType === 'job_orders') {
      setDeletedJobs(prev => prev.filter(j => j.id !== id));
    } else if (targetType === 'required_docs') {
      setDeletedRequiredDocs(prev => prev.filter(d => d.id !== id));
    } else if (targetType === 'placements') {
      setDeletedPlacements(prev => prev.filter(p => p.id !== id));
    } else if (targetType === 'passports') {
      setDeletedPassports(prev => prev.filter(p => p.id !== id));
    } else if (targetType === 'visas') {
      setDeletedVisas(prev => prev.filter(v => v.id !== id));
    }
  };

  // Restore handlers
  const handleRestoreCandidate = async (candidateId, name) => {
    if (window.confirm(`Restore candidate: ${name}?`)) {
      const res = await window.electronAPI.restoreCandidate({ user, id: candidateId });
      if (res.success) {
        toast.success(`Candidate ${name} restored.`);
        setDeletedCandidates(prev => prev.filter(c => c.id !== candidateId));
      } else {
        toast.error(res.error);
      }
    }
  };

  const handleRestoreEmployer = async (employerId, name) => {
    if (
      window.confirm(`Restore employer: ${name}? This will also restore associated jobs.`)
    ) {
      const res = await window.electronAPI.restoreEmployer({ user, id: employerId });
      if (res.success) {
        toast.success(`Employer ${name} and linked jobs restored.`);
        fetchAllDeleted();
      } else {
        toast.error(res.error);
      }
    }
  };

  const handleRestoreJob = async (jobId, name) => {
    if (
      window.confirm(`Restore job: ${name}? This will also restore linked placements.`)
    ) {
      const res = await window.electronAPI.restoreJobOrder({ user, id: jobId });
      if (res.success) {
        toast.success(`Job ${name} and linked placements restored.`);
        fetchAllDeleted();
      } else {
        toast.error(res.error);
      }
    }
  };

  const handleRestoreRequiredDoc = async (docId, name) => {
    if (window.confirm(`Restore required document: ${name}?`)) {
      const res = await window.electronAPI.restoreRequiredDocument({ user, id: docId });
      if (res.success) {
        toast.success(`Required document "${name}" restored.`);
        setDeletedRequiredDocs(prev => prev.filter(d => d.id !== docId));
      } else {
        toast.error(res.error);
      }
    }
  };

  const handleRestorePlacement = async (placementId, displayName) => {
    if (window.confirm(`Restore placement: ${displayName}?`)) {
      const res = await window.electronAPI.restorePlacement({ user, id: placementId });
      if (res.success) {
        toast.success(`Placement restored.`);
        setDeletedPlacements(prev => prev.filter(p => p.id !== placementId));
      } else {
        toast.error(res.error);
      }
    }
  };

  const handleRestorePassport = async (passportId, candidateName) => {
    if (window.confirm(`Restore passport for: ${candidateName}?`)) {
      const res = await window.electronAPI.restorePassport({ user, id: passportId });
      if (res.success) {
        toast.success(`Passport restored.`);
        setDeletedPassports(prev => prev.filter(p => p.id !== passportId));
      } else {
        toast.error(res.error);
      }
    }
  };

  const handleRestoreVisa = async (visaId, candidateName) => {
    if (window.confirm(`Restore visa tracking for: ${candidateName}?`)) {
      const res = await window.electronAPI.restoreVisa({ user, id: visaId });
      if (res.success) {
        toast.success(`Visa tracking restored.`);
        setDeletedVisas(prev => prev.filter(v => v.id !== visaId));
      } else {
        toast.error(res.error);
      }
    }
  };

  const renderItemActions = (item, type, restoreHandler) => (
    <div className="item-actions">
      {canDeletePermanently && (
        <button
          className="doc-btn delete"
          title={`Permanently Delete ${type}`}
          onClick={() => setDeleteModalItem({ item: item, type: type })}
        >
          <FiAlertTriangle />
        </button>
      )}
      <button
        className="doc-btn view"
        onClick={() =>
          restoreHandler(
            item.id,
            item.name || item.companyName || item.positionTitle || item.candidateName || 'N/A'
          )
        }
        title={`Restore ${type}`}
      >
        <FiRotateCcw />
      </button>
    </div>
  );

  const renderCandidateList = () => (
    <div className="recycle-list-content">
      {loading ? (
        <p>Loading...</p>
      ) : deletedCandidates.length === 0 ? (
        <p>No deleted candidates found.</p>
      ) : (
        <ul className="recycle-list">
          {deletedCandidates.map(candidate => (
            <li key={candidate.id} className="recycle-item">
              <div className="item-info">
                <strong>{candidate.name}</strong>
                <span>Position: {candidate.Position || 'N/A'}</span>
              </div>
              {renderItemActions(candidate, 'candidates', handleRestoreCandidate)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderEmployerList = () => (
    <div className="recycle-list-content">
      {loading ? (
        <p>Loading...</p>
      ) : deletedEmployers.length === 0 ? (
        <p>No deleted employers found.</p>
      ) : (
        <ul className="recycle-list">
          {deletedEmployers.map(emp => (
            <li key={emp.id} className="recycle-item">
              <div className="item-info">
                <strong>{emp.companyName}</strong>
                <span>Country: {emp.country || 'N/A'}</span>
              </div>
              {renderItemActions(emp, 'employers', handleRestoreEmployer)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderJobList = () => (
    <div className="recycle-list-content">
      {loading ? (
        <p>Loading...</p>
      ) : deletedJobs.length === 0 ? (
        <p>No deleted jobs found.</p>
      ) : (
        <ul className="recycle-list">
          {deletedJobs.map(job => (
            <li key={job.id} className="recycle-item">
              <div className="item-info">
                <strong>{job.positionTitle}</strong>
                <span>Company: {job.companyName || 'N/A'}</span>
              </div>
              {renderItemActions(job, 'job_orders', handleRestoreJob)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderRequiredDocsList = () => (
    <div className="recycle-list-content">
      {loading ? (
        <p>Loading...</p>
      ) : deletedRequiredDocs.length === 0 ? (
        <p>No deleted required documents found.</p>
      ) : (
        <ul className="recycle-list">
          {deletedRequiredDocs.map(doc => (
            <li key={doc.id} className="recycle-item">
              <div className="item-info">
                <strong>{doc.name}</strong>
              </div>
              {renderItemActions(doc, 'required_docs', handleRestoreRequiredDoc)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderPlacementsList = () => (
    <div className="recycle-list-content">
      {loading ? (
        <p>Loading...</p>
      ) : deletedPlacements.length === 0 ? (
        <p>No deleted placements found.</p>
      ) : (
        <ul className="recycle-list">
          {deletedPlacements.map(placement => (
            <li key={placement.id} className="recycle-item">
              <div className="item-info">
                <strong>{placement.candidateName}</strong>
                <span>Job: {placement.jobTitle || 'N/A'}</span>
              </div>
              {renderItemActions(placement, 'placements', handleRestorePlacement)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderPassportsList = () => (
    <div className="recycle-list-content">
      {loading ? (
        <p>Loading...</p>
      ) : deletedPassports.length === 0 ? (
        <p>No deleted passports found.</p>
      ) : (
        <ul className="recycle-list">
          {deletedPassports.map(passport => (
            <li key={passport.id} className="recycle-item">
              <div className="item-info">
                <strong>{passport.candidateName}</strong>
                <span>Passport: {passport.passportNumber || 'N/A'}</span>
              </div>
              {renderItemActions(passport, 'passports', handleRestorePassport)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderVisasList = () => (
    <div className="recycle-list-content">
      {loading ? (
        <p>Loading...</p>
      ) : deletedVisas.length === 0 ? (
        <p>No deleted visas found.</p>
      ) : (
        <ul className="recycle-list">
          {deletedVisas.map(visa => (
            <li key={visa.id} className="recycle-item">
              <div className="item-info">
                <strong>{visa.candidateName}</strong>
                <span>Status: {visa.status || 'N/A'}</span>
              </div>
              {renderItemActions(visa, 'visas', handleRestoreVisa)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const tabs = [
    {
      key: 'candidates',
      title: `Candidates (${deletedCandidates.length})`,
      icon: <FiUsers />,
      content: renderCandidateList(),
    },
    {
      key: 'employers',
      title: `Employers (${deletedEmployers.length})`,
      icon: <FiServer />,
      content: renderEmployerList(),
    },
    {
      key: 'jobs',
      title: `Job Orders (${deletedJobs.length})`,
      icon: <FiClipboard />,
      content: renderJobList(),
    },
    {
      key: 'placements',
      title: `Placements (${deletedPlacements.length})`,
      icon: <FiBriefcase />,
      content: renderPlacementsList(),
    },
    {
      key: 'required_docs',
      title: `Required Docs (${deletedRequiredDocs.length})`,
      icon: <FiFileText />,
      content: renderRequiredDocsList(),
    },
    {
      key: 'passports',
      title: `Passports (${deletedPassports.length})`,
      icon: <FiMapPin />,
      content: renderPassportsList(),
    },
    {
      key: 'visas',
      title: `Visas (${deletedVisas.length})`,
      icon: <FiMapPin />,
      content: renderVisasList(),
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
          onPermanentDelete={id => handlePermanentDelete(id, deleteModalItem.type)}
        />
      )}
      <h1>
        <FiTrash2 /> Recycle Bin
      </h1>
      {canDeletePermanently && (
        <p className="form-message danger" style={{ marginBottom: '1.5rem' }}>
          <FiAlertTriangle /> **SUPER ADMIN WARNING**: You have permission for **Permanent
          Deletion** (red trash icon). Use with extreme caution.
        </p>
      )}
      <p>
        Items moved to the recycle bin. Restoring an item will also restore its associated records
        (e.g., jobs, placements, documents).
      </p>

      <Tabs tabs={tabs} defaultActiveTab="candidates" />
    </div>
  );
}

export default RecycleBinPage;
