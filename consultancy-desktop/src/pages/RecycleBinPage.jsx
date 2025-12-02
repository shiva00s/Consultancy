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
  FiActivity,
  FiCalendar,
  FiSend,
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
  const [deletedMedical, setDeletedMedical] = useState([]);
  const [deletedInterviews, setDeletedInterviews] = useState([]);
  const [deletedTravel, setDeletedTravel] = useState([]);

  const [loading, setLoading] = useState(true);
  const [deleteModalItem, setDeleteModalItem] = useState(null);

  const canDeletePermanently = user?.role === 'super_admin';

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

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAllDeleted();
  }, [fetchAllDeleted]);

  const handlePermanentDelete = (id, targetType) => {
    setDeleteModalItem(null);

    if (targetType === 'candidates') {
      setDeletedCandidates((prev) => prev.filter((c) => c.id !== id));
    } else if (targetType === 'employers') {
      setDeletedEmployers((prev) => prev.filter((e) => e.id !== id));
    } else if (targetType === 'job_orders') {
      setDeletedJobs((prev) => prev.filter((j) => j.id !== id));
    } else if (targetType === 'required_docs') {
      setDeletedRequiredDocs((prev) => prev.filter((d) => d.id !== id));
    } else if (targetType === 'placements') {
      setDeletedPlacements((prev) => prev.filter((p) => p.id !== id));
    } else if (targetType === 'passports') {
      setDeletedPassports((prev) => prev.filter((p) => p.id !== id));
    } else if (targetType === 'visas') {
      setDeletedVisas((prev) => prev.filter((v) => v.id !== id));
    } else if (targetType === 'medical') {
      setDeletedMedical((prev) => prev.filter((m) => m.id !== id));
    } else if (targetType === 'interviews') {
      setDeletedInterviews((prev) => prev.filter((i) => i.id !== id));
    } else if (targetType === 'travel') {
      setDeletedTravel((prev) => prev.filter((t) => t.id !== id));
    }
  };

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
            item.name ||
              item.companyName ||
              item.positionTitle ||
              item.candidateName ||
              item.description ||
              'N/A'
          )
        }
        title={`Restore ${type}`}
      >
        <FiRotateCcw />
      </button>
    </div>
  );

  // restore handlers
  const handleRestoreCandidate = async (id, name) => {
    if (!window.confirm(`Restore candidate: ${name}?`)) return;
    const res = await window.electronAPI.restoreCandidate({ user, id });
    if (res.success) {
      setDeletedCandidates((prev) => prev.filter((c) => c.id !== id));
      toast.success(`Candidate ${name} restored.`);
    } else toast.error(res.error);
  };

  const handleRestoreEmployer = async (id, name) => {
    if (
      !window.confirm(
        `Restore employer: ${name}? This will also restore associated jobs.`
      )
    )
      return;
    const res = await window.electronAPI.restoreEmployer({ user, id });
    if (res.success) {
      toast.success(`Employer ${name} and linked jobs restored.`);
      fetchAllDeleted();
    } else toast.error(res.error);
  };

  const handleRestoreJob = async (id, name) => {
    if (
      !window.confirm(
        `Restore job: ${name}? This will also restore linked placements.`
      )
    )
      return;
    const res = await window.electronAPI.restoreJobOrder({ user, id });
    if (res.success) {
      toast.success(`Job ${name} and linked placements restored.`);
      fetchAllDeleted();
    } else toast.error(res.error);
  };

  const handleRestoreRequiredDoc = async (id, name) => {
    if (!window.confirm(`Restore required document: ${name}?`)) return;
    const res = await window.electronAPI.restoreRequiredDocument({ user, id });
    if (res.success) {
      setDeletedRequiredDocs((prev) => prev.filter((d) => d.id !== id));
      toast.success(`Required document "${name}" restored.`);
    } else toast.error(res.error);
  };

  const handleRestorePlacement = async (id, display) => {
    if (!window.confirm(`Restore placement: ${display}?`)) return;
    const res = await window.electronAPI.restorePlacement({ user, id });
    if (res.success) {
      setDeletedPlacements((prev) => prev.filter((p) => p.id !== id));
      toast.success('Placement restored.');
    } else toast.error(res.error);
  };

  const handleRestorePassport = async (id, name) => {
    if (!window.confirm(`Restore passport for: ${name}?`)) return;
    const res = await window.electronAPI.restorePassport({ user, id });
    if (res.success) {
      setDeletedPassports((prev) => prev.filter((p) => p.id !== id));
      toast.success('Passport restored.');
    } else toast.error(res.error);
  };

  const handleRestoreVisa = async (id, name) => {
    if (!window.confirm(`Restore visa tracking for: ${name}?`)) return;
    const res = await window.electronAPI.restoreVisa({ user, id });
    if (res.success) {
      setDeletedVisas((prev) => prev.filter((v) => v.id !== id));
      toast.success('Visa tracking restored.');
    } else toast.error(res.error);
  };

  const handleRestoreMedical = async (id, name) => {
    if (!window.confirm(`Restore medical record for: ${name}?`)) return;
    const res = await window.electronAPI.restoreMedical({ user, id });
    if (res.success) {
      setDeletedMedical((prev) => prev.filter((m) => m.id !== id));
      toast.success('Medical record restored.');
    } else toast.error(res.error);
  };

  const handleRestoreInterview = async (id, name) => {
    if (!window.confirm(`Restore interview record for: ${name}?`)) return;
    const res = await window.electronAPI.restoreInterview({ user, id });
    if (res.success) {
      setDeletedInterviews((prev) => prev.filter((i) => i.id !== id));
      toast.success('Interview record restored.');
    } else toast.error(res.error);
  };

  const handleRestoreTravel = async (id, name) => {
    if (!window.confirm(`Restore travel record for: ${name}?`)) return;
    const res = await window.electronAPI.restoreTravel({ user, id });
    if (res.success) {
      setDeletedTravel((prev) => prev.filter((t) => t.id !== id));
      toast.success('Travel record restored.');
    } else toast.error(res.error);
  };

  const renderList = (items, emptyText, renderRow) => (
    <div className="recycle-list-content">
      {loading ? (
        <p>Loading...</p>
      ) : items.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <ul className="recycle-list">
          {items.map(renderRow)}
        </ul>
      )}
    </div>
  );

  const tabs = [
    {
      key: 'candidates',
      title: `Candidates (${deletedCandidates.length})`,
      icon: <FiUsers />,
      content: renderList(
        deletedCandidates,
        'No deleted candidates found.',
        (candidate) => (
          <li key={candidate.id} className="recycle-item">
            <div className="item-info">
              <strong>{candidate.name}</strong>
              <span>Position: {candidate.Position || 'N/A'}</span>
            </div>
            {renderItemActions(candidate, 'candidates', handleRestoreCandidate)}
          </li>
        )
      ),
    },
    {
      key: 'employers',
      title: `Employers (${deletedEmployers.length})`,
      icon: <FiServer />,
      content: renderList(
        deletedEmployers,
        'No deleted employers found.',
        (emp) => (
          <li key={emp.id} className="recycle-item">
            <div className="item-info">
              <strong>{emp.companyName}</strong>
              <span>Country: {emp.country || 'N/A'}</span>
            </div>
            {renderItemActions(emp, 'employers', handleRestoreEmployer)}
          </li>
        )
      ),
    },
    {
      key: 'jobs',
      title: `Job Orders (${deletedJobs.length})`,
      icon: <FiClipboard />,
      content: renderList(
        deletedJobs,
        'No deleted jobs found.',
        (job) => (
          <li key={job.id} className="recycle-item">
            <div className="item-info">
              <strong>{job.positionTitle}</strong>
              <span>Company: {job.companyName || 'N/A'}</span>
            </div>
            {renderItemActions(job, 'job_orders', handleRestoreJob)}
          </li>
        )
      ),
    },
    {
      key: 'placements',
      title: `Placements (${deletedPlacements.length})`,
      icon: <FiBriefcase />,
      content: renderList(
        deletedPlacements,
        'No deleted placements found.',
        (placement) => (
          <li key={placement.id} className="recycle-item">
            <div className="item-info">
              <strong>{placement.candidateName}</strong>
              <span>
                Job: {placement.jobTitle || 'N/A'} –{' '}
                {placement.companyName || 'N/A'}
              </span>
            </div>
            {renderItemActions(
              placement,
              'placements',
              handleRestorePlacement
            )}
          </li>
        )
      ),
    },
    {
      key: 'required_docs',
      title: `Required Docs (${deletedRequiredDocs.length})`,
      icon: <FiFileText />,
      content: renderList(
        deletedRequiredDocs,
        'No deleted required documents found.',
        (doc) => (
          <li key={doc.id} className="recycle-item">
            <div className="item-info">
              <strong>{doc.name}</strong>
            </div>
            {renderItemActions(doc, 'required_docs', handleRestoreRequiredDoc)}
          </li>
        )
      ),
    },
    {
      key: 'passports',
      title: `Passports (${deletedPassports.length})`,
      icon: <FiMapPin />,
      content: renderList(
        deletedPassports,
        'No deleted passports found.',
        (passport) => (
          <li key={passport.id} className="recycle-item">
            <div className="item-info">
              <strong>{passport.candidateName}</strong>
              <span>
                Passport: {passport.passportNumber || 'N/A'} (Exp:{' '}
                {passport.expiryDate || 'N/A'})
              </span>
            </div>
            {renderItemActions(
              passport,
              'passports',
              handleRestorePassport
            )}
          </li>
        )
      ),
    },
    {
      key: 'visas',
      title: `Visas (${deletedVisas.length})`,
      icon: <FiMapPin />,
      content: renderList(
        deletedVisas,
        'No deleted visas found.',
        (visa) => (
          <li key={visa.id} className="recycle-item">
            <div className="item-info">
              <strong>{visa.candidateName}</strong>
              <span>
                Type: {visa.visaType || 'N/A'} – Status:{' '}
                {visa.status || 'N/A'}
              </span>
            </div>
            {renderItemActions(visa, 'visas', handleRestoreVisa)}
          </li>
        )
      ),
    },
    {
      key: 'medical',
      title: `Medical (${deletedMedical.length})`,
      icon: <FiActivity />,
      content: renderList(
        deletedMedical,
        'No deleted medical records found.',
        (m) => (
          <li key={m.id} className="recycle-item">
            <div className="item-info">
              <strong>{m.candidateName}</strong>
              <span>
                Status: {m.status || 'N/A'} – Center:{' '}
                {m.centerName || 'N/A'}
              </span>
            </div>
            {renderItemActions(m, 'medical', handleRestoreMedical)}
          </li>
        )
      ),
    },
    {
      key: 'interviews',
      title: `Interviews (${deletedInterviews.length})`,
      icon: <FiCalendar />,
      content: renderList(
        deletedInterviews,
        'No deleted interview records found.',
        (i) => (
          <li key={i.id} className="recycle-item">
            <div className="item-info">
              <strong>{i.candidateName}</strong>
              <span>
                Status: {i.status || 'N/A'} – Date:{' '}
                {i.interviewDate || 'N/A'}
              </span>
            </div>
            {renderItemActions(i, 'interviews', handleRestoreInterview)}
          </li>
        )
      ),
    },
    {
      key: 'travel',
  title: `Travel (${deletedTravel.length})`,
  icon: <FiSend />,
  content: renderList(
    deletedTravel,
    'No deleted travel records found.',
    (t) => (
      <li key={t.id} className="recycle-item">
        <div className="item-info">
          <strong>{t.candidateName}</strong>
          <span>
            PNR: {t.pnr || 'N/A'} – {t.departure_city || 'N/A'} → {t.arrival_city || 'N/A'}
          </span>
          <span>Travel Date: {t.travel_date || 'N/A'}</span>
        </div>
        {renderItemActions(t, 'travel', handleRestoreTravel)}
      </li>
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
      <h1>
        <FiTrash2 /> Recycle Bin
      </h1>
      

      <Tabs tabs={tabs} defaultActiveTab="candidates" />
    </div>
  );
}

export default RecycleBinPage;
