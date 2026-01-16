import React, { useState, useEffect, useCallback } from 'react';
import { FiClipboard, FiPlus, FiTrash2, FiServer, FiBriefcase, FiCheck, FiX, FiAlertCircle, FiFileText } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../../css/CandidateJobs.css';
import ConfirmDialog from '../common/ConfirmDialog';

function CandidateJobs({ user, candidateId, onJobAssigned }) {
  const [placements, setPlacements] = useState([]);
  const [unassignedJobs, setUnassignedJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    placementId: null,
    jobName: ''
  });
  const [detailsModal, setDetailsModal] = useState({ open: false, data: null });
  const [candidateName, setCandidateName] = useState('');
  const [candidateDetails, setCandidateDetails] = useState(null);
  const [companySetup, setCompanySetup] = useState(null);

  const fetchPlacements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getCandidatePlacements({ candidateId });
      if (res.success) {
        const validPlacements = (res.data || []).filter(
          p => p && p.positionTitle && p.companyName
        );
        setPlacements(validPlacements);
      }
    } catch (err) {
      console.error('Error fetching placements:', err);
      toast.error('❌ Failed to load placements');
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  const fetchUnassignedJobs = useCallback(async () => {
    try {
      const res = await window.electronAPI.getUnassignedJobs({ candidateId });
      if (res.success) setUnassignedJobs(res.data || []);
    } catch (err) {
      console.error('Error fetching unassigned jobs:', err);
    }
  }, [candidateId]);

  // Open details: fetch full job order data before showing modal
  const openDetails = async (placement) => {
    try {
      // try to fetch full job order by id if available
      const jobId = placement.jobId || placement.job_id || placement.id || placement.jobOrderId;
      let fullJob = {};
      if (jobId && window.electronAPI.getJobOrderById) {
        const res = await window.electronAPI.getJobOrderById({ jobId });
        if (res && res.success && res.data) fullJob = res.data;
      }

      // merge placement + fullJob (fullJob wins where present)
      const merged = { ...placement, ...fullJob };

      // ensure candidate details are available
      if (!candidateDetails) {
        try {
          const cres = await window.electronAPI.getCandidateDetails({ id: candidateId, user });
          if (cres && cres.success && cres.data && cres.data.candidate) setCandidateDetails(cres.data.candidate);
        } catch (e) { /* ignore */ }
      }

      setDetailsModal({ open: true, data: merged });
    } catch (e) {
      console.error('Error opening details:', e);
      // fallback to showing placement only
      setDetailsModal({ open: true, data: placement });
    }
  };

  useEffect(() => {
    fetchPlacements();
    fetchUnassignedJobs();

    // Fetch candidate details (for modal header and CPR)
    (async () => {
      try {
        const res = await window.electronAPI.getCandidateDetails({ id: candidateId, user });
        if (res && res.success && res.data && res.data.candidate) {
          setCandidateDetails(res.data.candidate);
          setCandidateName(res.data.candidate.name || '');
        }
      } catch (e) {
        // ignore
      }
    })();

    // Fetch company setup (for footer)
    (async () => {
      try {
        const res = await window.electronAPI.getCompanySetup();
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          // prefer the first active record
          setCompanySetup(res.data[0]);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [candidateId, fetchPlacements, fetchUnassignedJobs, user]);

  const handleAssignJob = async (e) => {
    e.preventDefault();
    if (!selectedJobId) {
      toast.error('⚠️ Please select a job first.');
      return;
    }

    setIsAssigning(true);
    try {
      const res = await window.electronAPI.assignCandidateToJob({
        user,
        candidateId,
        jobId: parseInt(selectedJobId, 10),
      });

      if (res.success) {
        await fetchPlacements();
        await fetchUnassignedJobs();
        setSelectedJobId('');
        toast.success('✅ Job assigned successfully!');
        if (onJobAssigned) {
          onJobAssigned(res.data?.jobId);
        }
      } else {
        toast.error(res.error || '❌ Failed to assign job');
      }
    } catch (err) {
      console.error('Error assigning job:', err);
      toast.error('❌ Failed to assign job');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemovePlacement = (placementId, jobName) => {
    setConfirmDialog({
      isOpen: true,
      placementId,
      jobName
    });
  };

  const confirmRemove = async () => {
    const { placementId } = confirmDialog;
    try {
      const res = await window.electronAPI.removeCandidateFromJob({
        user,
        placementId,
      });

      if (res.success) {
        await fetchPlacements();
        await fetchUnassignedJobs();
        toast.success('✅ Job assignment removed successfully');
      } else {
        toast.error(res.error || '❌ Failed to remove placement');
      }
    } catch (err) {
      console.error('Error removing placement:', err);
      toast.error('❌ Failed to remove placement');
    } finally {
      setConfirmDialog({ isOpen: false, placementId: null, jobName: '' });
    }
  };

  const cancelRemove = () => {
    setConfirmDialog({ isOpen: false, placementId: null, jobName: '' });
  };

  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'Assigned': return 'badge-cyan';
      case 'Interviewing': return 'badge-blue';
      case 'Placed': return 'badge-green';
      case 'Rejected': return 'badge-red';
      default: return 'badge-grey';
    }
  };

  const getStatusEmoji = (status) => {
    switch(status) {
      case 'Assigned': return '📋';
      case 'Interviewing': return '🎤';
      case 'Placed': return '✅';
      case 'Rejected': return '❌';
      default: return '⏳';
    }
  };

  if (loading) {
    return (
      <div className="job-placement-content">
        <div className="loading-spinner">
          <FiServer /> Loading job assignments...
        </div>
      </div>
    );
  }

  return (
    <div className="job-placement-content">
      {/* Assign Job Form */}
      <div className="form-container">
        <h3>
          <span className="section-icon"><FiPlus /></span>
          Assign to Job Order
        </h3>
        <form className="assign-job-form" onSubmit={handleAssignJob}>
          <div className="form-group">
            <label>
              <FiBriefcase /> Select Job Order
            </label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              disabled={isAssigning || unassignedJobs.length === 0}
            >
              <option value="">
                {unassignedJobs.length === 0 
                  ? 'No available job orders' 
                  : 'Choose a job order...'
                }
              </option>
              {unassignedJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.positionTitle} at {job.companyName}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="btn"
            disabled={isAssigning || !selectedJobId}
          >
            {isAssigning ? (
              <>
                <span className="spinner-icon">⏳</span>
                Assigning...
              </>
            ) : (
              <>
                <FiCheck /> Assign Job
              </>
            )}
          </button>
        </form>
      </div>

      {/* Current Job Assignments List */}
      <div className="list-container">
        <h3>
          <span className="section-icon"><FiClipboard /></span>
          Current Job Assignments ({placements.length})
        </h3>

        {placements.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💼</div>
            <p>No active job assignments</p>
            <span>This candidate is not assigned to any job orders yet</span>
          </div>
        ) : (
          <div className={`module-list ${placements && placements.length >= 2 ? 'two-column' : ''}`}>
            {placements.map((p) => (
              <div 
                key={p.placementId || p.id || `placement-${p.jobId}-${p.candidateId}`} 
                className="module-list-item"
              >
                <div className="item-icon">
                  <FiBriefcase />
                </div>

                <div className="item-details">
                  <h4>{p.positionTitle}</h4>
                  <p>
                    <strong>🏢 {p.companyName}</strong>
                  </p>
                  <p className="date-info">
                    📅 Assigned: {new Date(p.assignedDate).toLocaleDateString()}
                  </p>
                </div>

                <div className="item-status">
                  <span className={`status-badge ${getStatusBadgeClass(p.status)}`}>
                    {getStatusEmoji(p.status)} {p.status || 'Assigned'}
                  </span>
                </div>

                <div className="item-actions">
                  <button
                    onClick={() => openDetails(p)}
                    title="View job details"
                    aria-label="View job details"
                  >
                    <span style={{fontSize:18}}>🇮🇳</span>
                  </button>

                  <button
                    onClick={() => handleRemovePlacement(p.placementId || p.id, p.positionTitle)}
                    title="Remove job assignment"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Remove Job Assignment"
        message={`Are you sure you want to remove the assignment for "${confirmDialog.jobName}"?`}
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={confirmRemove}
        onCancel={cancelRemove}
        type="danger"
      />

      {/* Job Details Modal */}
      {detailsModal.open && (
        <div className="job-details-modal-overlay">
          <div className="job-details-modal">
            <div className="job-details-modal-header header-centered">
              <div className="header-content">
                <div className="congrats-small">CONGRATULATIONS 🎉🎉🎉</div>
                <div className="big-name">MR. {candidateName || ''}</div>

                <p className="modal-statement caps">
                  TODAY I SUCCESSFULLY RECEIVED APPLY COPY FOR <strong>{(detailsModal.data.country || detailsModal.data.employerCountry || '').toUpperCase()}</strong> WORK AS A <strong>{(detailsModal.data.positionTitle || '').toUpperCase()}</strong>
                </p>

                <div className="salary-line pill">BASIC SALARY {detailsModal.data.salary || detailsModal.data.monthlySalary || ''}</div>

                <div className="company-line">{detailsModal.data.companyName || ''}</div>
              </div>
            </div>

            <div className="job-details-modal-body">
              {/* Full Visa / notice content (transcribed from attachment) */}
              <div className="modal-visa-note visa-full">
                <div className="visa-header">New Work Visa Confirmation</div>
                <div className="visa-line visa-important">Expat is IN { (detailsModal.data.country || detailsModal.data.employerCountry || '').toUpperCase() }:</div>
                <p>
                  If the expat is IN { (detailsModal.data.country || detailsModal.data.employerCountry || '').toUpperCase() }, LMRA will issue the Work Visa after paying the fees, provided there are no active offenses on the CR.
                </p>

                <div className="visa-line visa-important">With regard to the expat's address, please note the following:</div>
                <p>
                  If the address provided is invalid, the application will be sent back. Repeated error will result in the application being rejected.
                  If zero address has been entered, the proper address MUST be updated within 30 days from the date of arrival (or from date of enrolment if expat is in { (detailsModal.data.country || detailsModal.data.employerCountry || '').toUpperCase() }). Failure to do so will result in future applications being withheld.
                </p>

                <div className="visa-footer-note">Your application has been successfully submitted to LMRA</div>
              </div>
              {/* details-grid removed per request (POSITION/EMPLOYER/COUNTRY list) */}
            
              <h2 className="modal-company">{detailsModal.data.companyName} - {detailsModal.data.positionTitle}</h2>
              {/* Main application details table (populated from job order + candidate) - CPR intentionally hidden until download */}
              <table className="visa-main-table">
                <tbody>
                  <tr><td className="k">Application ID</td><td className="v">{detailsModal.data.applicationId || detailsModal.data.appId || detailsModal.data.id || ''}</td></tr>
                  <tr><td className="k">Application Status</td><td className="v">{detailsModal.data.applicationStatus || detailsModal.data.status || ''}</td></tr>
                  <tr><td className="k">Submission Date</td><td className="v">{detailsModal.data.submissionDate || detailsModal.data.assignedDate ? new Date(detailsModal.data.submissionDate || detailsModal.data.assignedDate).toLocaleString() : ''}</td></tr>
                  <tr><td className="k">Permit Period (Months)</td><td className="v">{detailsModal.data.permitPeriod || detailsModal.data.contractPeriod || ''}</td></tr>
                  <tr><td className="k">Employer No</td><td className="v">{detailsModal.data.employerNo || detailsModal.data.employerNumber || detailsModal.data.employer_id || ''}</td></tr>
                  <tr><td className="k">Employer Name</td><td className="v">{detailsModal.data.companyName || ''}</td></tr>
                  <tr><td className="k">Applicant CPR</td><td className="v">{/* hidden on UI; added dynamically when generating download */}</td></tr>
                  <tr><td className="k">Applicant Name</td><td className="v">{(candidateDetails && (candidateDetails.name || candidateDetails.fullName)) || ''}</td></tr>
                  <tr><td className="k">Applicant Phone</td><td className="v">{(candidateDetails && (candidateDetails.contact || candidateDetails.phone || candidateDetails.mobile || candidateDetails.phone_number)) || detailsModal.data.applicantPhone || ''}</td></tr>
                  <tr><td className="k">Expat Name</td><td className="v">{(candidateDetails && (candidateDetails.name || candidateDetails.fullName)) || detailsModal.data.expatName || candidateName || ''}</td></tr>
                  <tr><td className="k">Expat Passport</td><td className="v">{(candidateDetails && (candidateDetails.passport || candidateDetails.passportNo)) || detailsModal.data.expatPassport || detailsModal.data.passport || ''}</td></tr>
                  <tr><td className="k">Expat Nationality</td><td className="v">{(candidateDetails && (candidateDetails.nationality || candidateDetails.countryCode)) || detailsModal.data.nationality || (detailsModal.data.country || detailsModal.data.employerCountry) || ''}</td></tr>
                </tbody>
              </table>
              </div>

            <div className="job-details-modal-footer">
              <div className="footer-left">
                {companySetup ? (
                  <div className="company-footer-block">
                    <div className="company-footer-name">{companySetup.company_name}</div>
                    <div className="company-footer-address">{companySetup.address}</div>
                    {companySetup.contact && <div className="company-footer-contact">{companySetup.contact}</div>}
                  </div>
                ) : null}
              </div>

              <div className="footer-actions">
                <button className="btn btn-primary" onClick={async () => {
                try {
                  const defaultAcceptanceDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0,10);
                  // Include applicant CPR dynamically just before generating/downloading
                  const applicantCpr = (candidateDetails && (candidateDetails.cpr || candidateDetails.cprNumber || candidateDetails.cpr_no)) || detailsModal.data.applicantCpr || detailsModal.data.applicantCPR || '';
                  const templateData = {
                    monthlySalary: detailsModal.data.salary || detailsModal.data.monthlySalary || '',
                    applicationId: detailsModal.data.applicationId || detailsModal.data.appId || detailsModal.data.id || '',
                    applicationStatus: detailsModal.data.applicationStatus || detailsModal.data.status || '',
                    submissionDate: detailsModal.data.submissionDate || detailsModal.data.assignedDate || '',
                    permitPeriod: detailsModal.data.permitPeriod || detailsModal.data.contractPeriod || '',
                    employerNo: detailsModal.data.employerNo || detailsModal.data.employerNumber || detailsModal.data.employer_id || '',
                    employerName: detailsModal.data.companyName || '',
                    applicantName: (candidateDetails && (candidateDetails.name || candidateDetails.fullName)) || '',
                    applicantPhone: (candidateDetails && (candidateDetails.contact || candidateDetails.phone || candidateDetails.mobile || candidateDetails.phone_number)) || detailsModal.data.applicantPhone || '',
                    expatName: (candidateDetails && (candidateDetails.name || candidateDetails.fullName)) || detailsModal.data.expatName || candidateName || '',
                    expatPassport: (candidateDetails && (candidateDetails.passport || candidateDetails.passportNo)) || detailsModal.data.expatPassport || detailsModal.data.passport || '',
                    expatNationality: (candidateDetails && (candidateDetails.nationality || candidateDetails.countryCode)) || detailsModal.data.nationality || (detailsModal.data.country || detailsModal.data.employerCountry) || '',
                    joiningDate: (candidateDetails && (candidateDetails.joiningDate || candidateDetails.expectedJoiningDate || candidateDetails.joining_date)) || detailsModal.data.joiningDate || detailsModal.data.expectedJoiningDate || detailsModal.data.joining_date || detailsModal.data.submissionDate || '',
                    acceptanceDate: (candidateDetails && (candidateDetails.acceptanceDate || candidateDetails.acceptance_date || candidateDetails.acceptanceDeadline)) || detailsModal.data.acceptanceDate || detailsModal.data.acceptance_date || defaultAcceptanceDate,
                    applicantCPR: applicantCpr,
                  };

                  // Try generating offer letter PDF if candidateId is available
                  // Fetch CandidateJobs CSS so we can inline exact styles for the PDF
                  const cssRes = await window.electronAPI.getCandidateJobsCss();
                  const inlinedCss = (cssRes && cssRes.success && cssRes.css) ? cssRes.css : `body{font-family: Arial, Helvetica, sans-serif; margin:0; padding:16px; color:#222}`;

                  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Job Application Preview</title>
  <style>${inlinedCss}</style>
</head>
<body>
  <div class="job-details-modal-header header-centered">
    <div class="header-content">
      <div class="congrats-small">CONGRATULATIONS 🎉🎉🎉</div>
      <div class="big-name">MR. ${candidateName || ''}</div>
      <p class="modal-statement caps">TODAY I SUCCESSFULLY RECEIVED APPLY COPY FOR <strong>${(templateData.expatNationality || '').toUpperCase()}</strong> WORK AS A <strong>${(detailsModal.data.positionTitle || '').toUpperCase()}</strong></p>
      <div class="salary-line pill">BASIC SALARY ${templateData.monthlySalary || ''}</div>
      <div class="company-line">${templateData.employerName || detailsModal.data.companyName || ''}</div>
    </div>
  </div>

  <div class="job-details-modal-body">
    <div class="modal-visa-note visa-full">
      <div class="visa-header">New Work Visa Confirmation</div>
      <div class="visa-line visa-important">Expat is IN ${(templateData.expatNationality || '').toUpperCase()}:</div>
      <p>If the expat is IN ${(templateData.expatNationality || '').toUpperCase()}, LMRA will issue the Work Visa after paying the fees, provided there are no active offenses on the CR.</p>
      <div class="visa-line visa-important">With regard to the expat's address, please note the following:</div>
      <p>If the address provided is invalid, the application will be sent back. Repeated error will result in the application being rejected. If zero address has been entered, the proper address MUST be updated within 30 days from the date of arrival (or from date of enrolment if expat is in ${(templateData.expatNationality || '').toUpperCase()}). Failure to do so will result in future applications being withheld.</p>
      <div class="visa-footer-note">Your application has been successfully submitted to LMRA</div>
    </div>

    <h2 class="modal-company">${templateData.employerName || detailsModal.data.companyName || ''} - ${detailsModal.data.positionTitle || ''}</h2>

    <table class="visa-main-table">
      <tbody>
        <tr><td className="k">Application ID</td><td className="v">${templateData.applicationId || ''}</td></tr>
        <tr><td className="k">Application Status</td><td className="v">${templateData.applicationStatus || ''}</td></tr>
        <tr><td className="k">Submission Date</td><td className="v">${templateData.submissionDate || ''}</td></tr>
        <tr><td className="k">Permit Period (Months)</td><td className="v">${templateData.permitPeriod || ''}</td></tr>
        <tr><td className="k">Employer No</td><td className="v">${templateData.employerNo || ''}</td></tr>
        <tr><td className="k">Employer Name</td><td className="v">${templateData.employerName || ''}</td></tr>
        <tr><td className="k">Applicant Name</td><td className="v">${templateData.applicantName || ''}</td></tr>
        <tr><td className="k">Applicant Phone</td><td className="v">${templateData.applicantPhone || ''}</td></tr>
        <tr><td className="k">Expat Name</td><td className="v">${templateData.expatName || ''}</td></tr>
        <tr><td className="k">Expat Passport</td><td className="v">${templateData.expatPassport || ''}</td></tr>
        <tr><td className="k">Expat Nationality</td><td className="v">${templateData.expatNationality || ''}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="job-details-modal-footer">
    ${companySetup ? `<div class="company-footer-block"><div class="company-footer-name">${companySetup.company_name || ''}</div><div class="company-footer-address">${companySetup.address || ''}</div><div class="company-footer-contact">${companySetup.contact || ''}</div></div>` : ''}
  </div>
</body>
</html>`;

                  const writeRes = await window.electronAPI.writeTempHtml({ html, fileName: `job_preview_${Date.now()}.html` });
                  if (writeRes && writeRes.success && writeRes.tempPath) {
                    const fileUrlRes = await window.electronAPI.getFileUrl({ path: writeRes.tempPath });
                    if (fileUrlRes && fileUrlRes.success) {
                      // Build a sanitized filename using candidate name and application id
                      const rawName = (candidateDetails && (candidateDetails.name || candidateDetails.fullName)) || templateData.applicantName || `candidate`;
                      const rawId = templateData.applicationId || detailsModal.data.id || Date.now();
                      const sanitize = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0,160);
                      const suggested = `${sanitize(rawName)}_${sanitize(rawId)}.pdf`;
                      const pdfRes = await window.electronAPI.printToPDF({ url: fileUrlRes.fileUrl, suggestedName: suggested });
                      if (pdfRes.success) toast.success(`✅ Saved to ${pdfRes.filePath}`);
                      else toast.error(pdfRes.error || 'PDF generation failed');
                    } else {
                      toast.error(fileUrlRes.error || 'Failed to construct file URL');
                    }
                  } else {
                    toast.error(writeRes.error || 'Failed to write temporary preview');
                  }
                } catch (e) {
                  console.error('Error generating PDF from modal:', e);
                  toast.error('Error generating PDF');
                }
              }}><FiFileText /> Download</button>

                <button className="btn" onClick={() => setDetailsModal({ open: false, data: null })}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CandidateJobs;