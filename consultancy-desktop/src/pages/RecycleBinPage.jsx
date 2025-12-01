import React, { useState, useEffect, useCallback } from 'react';
import {
  FiTrash2,
  FiRotateCcw,
  FiUsers,
  FiServer,
  FiClipboard,
  FiAlertTriangle,
  FiFileText,
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

  const [loading, setLoading] = useState(true);
  const [deleteModalItem, setDeleteModalItem] = useState(null); // { item, type }

  const fetchAllDeleted = useCallback(async () => {
    if (!user || !user.id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [candRes, empRes, jobRes, reqDocRes] = await Promise.all([
      window.electronAPI.getDeletedCandidates(),
      window.electronAPI.getDeletedEmployers(),
      window.electronAPI.getDeletedJobOrders(),
      window.electronAPI.getDeletedRequiredDocuments(),
    ]);

    if (candRes.success && Array.isArray(candRes.data)) {
      setDeletedCandidates(candRes.data);
    } else if (!candRes.success) {
      toast.error(candRes.error);
    }

    if (empRes.success && Array.isArray(empRes.data)) {
      setDeletedEmployers(empRes.data);
    } else if (!empRes.success) {
      toast.error(empRes.error);
    }

    if (jobRes.success && Array.isArray(jobRes.data)) {
      setDeletedJobs(jobRes.data);
    } else if (!jobRes.success) {
      toast.error(jobRes.error);
    }

    // normalize required docs result to an array
    if (reqDocRes.success) {
      const docs =
        Array.isArray(reqDocRes.data)
          ? reqDocRes.data
          : Array.isArray(reqDocRes.data?.rows)
          ? reqDocRes.data.rows
          : [];
      setDeletedRequiredDocs(docs);
    } else {
      toast.error(reqDocRes.error);
    }

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
    }
  };

  const handleRestoreRequiredDoc = async (docId, name) => {
    if (window.confirm(`Restore required document: ${name}?`)) {
      const res = await window.electronAPI.restoreRequiredDocument({
        user,
        id: docId,
      });
      if (res.success) {
        toast.success(`Required document "${name}" restored.`);
        setDeletedRequiredDocs(prev => prev.filter(d => d.id !== docId));
      } else {
        toast.error(res.error);
      }
    }
  };

  const handleRestoreCandidate = async (candidateId, name) => {
    if (window.confirm(`Are you sure you want to restore candidate: ${name}?`)) {
      const res = await window.electronAPI.restoreCandidate({
        user,
        id: candidateId,
      });
      if (res.success) {
        toast.success(`Candidate ${name} restored successfully.`);
        setDeletedCandidates(prev => prev.filter(c => c.id !== candidateId));
      } else {
        toast.error(res.error);
      }
    }
  };

  const handleRestoreEmployer = async (employerId, name) => {
    if (
      window.confirm(
        `Are you sure you want to restore employer: ${name}? This will also restore their associated jobs.`
      )
    ) {
      const res = await window.electronAPI.restoreEmployer({
        user,
        id: employerId,
      });
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
      window.confirm(
        `Are you sure you want to restore job: ${name}? This will also restore its linked placements.`
      )
    ) {
      const res = await window.electronAPI.restoreJobOrder({
        user,
        id: jobId,
      });
      if (res.success) {
        toast.success(`Job ${name} and linked placements restored.`);
        fetchAllDeleted();
      } else {
        toast.error(res.error);
      }
    }
  };

  const canDeletePermanently = user.role === 'super_admin';

  const renderItemActions = (item, type, restoreHandler) => (
    <div className="item-actions">
      {canDeletePermanently && (
        <button
          className="doc-btn delete"
          title={`Permanently Delete ${type}`}
          onClick={() => setDeleteModalItem({ item, type })}
        >
          <FiAlertTriangle />
        </button>
      )}
      <button
        className="doc-btn view"
        onClick={() =>
          restoreHandler(
            item.id,
            item.name || item.companyName || item.positionTitle
          )
        }
        title={`Restore ${type}`}
      >
        <FiRotateCcw />
      </button>
    </div>
  );

  const renderRequiredDocsList = () => {
    const docs = Array.isArray(deletedRequiredDocs)
      ? deletedRequiredDocs
      : [];

    return (
      <div className="recycle-list-content">
        {loading ? (
          <p>Loading...</p>
        ) : docs.length === 0 ? (
          <p>No deleted required documents found.</p>
        ) : (
          <ul className="recycle-list">
            {docs.map(doc => (
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
  };

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
      key: 'required_docs',
      title: `Required Docs (${deletedRequiredDocs.length || 0})`,
      icon: <FiFileText />,
      content: renderRequiredDocsList(),
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
          onPermanentDelete={id =>
            handlePermanentDelete(id, deleteModalItem.type)
          }
        />
      )}

      <h1>
        <FiTrash2 /> Recycle Bin
      </h1>

      {canDeletePermanently && (
        <p
          className="form-message danger"
          style={{ marginBottom: '1.5rem' }}
        >
          <FiAlertTriangle /> SUPER ADMIN WARNING: You have permission for
          permanent deletion (red trash icon). Use with extreme caution.
        </p>
      )}

      <p>
        Items moved to the recycle bin. Restoring an item will also restore its
        associated records (e.g., jobs, placements, documents).
      </p>

      <Tabs tabs={tabs} defaultActiveTab="candidates" />
    </div>
  );
}

export default RecycleBinPage;
