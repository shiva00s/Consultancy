import React, { useState } from 'react';
import { FiFileText, FiDownload, FiAlertTriangle, FiBriefcase, FiDollarSign, FiCalendar, FiClock, FiHash } from 'react-icons/fi';
import toast from 'react-hot-toast';

const initialFormData = {
  monthlySalary: '',
  joiningDate: '',
  acceptanceDate: '',
  assignedJobId: ''
};

function OfferLetterGenerator({ user, candidateId, jobId }) {
  const [formData, setFormData] = useState(initialFormData);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async () => {
    if (!formData.monthlySalary || !formData.joiningDate || !jobId) {
      toast.error('⚠️ Salary, Joining Date, and a valid Job Assignment are required.');
      return;
    }

    setIsGenerating(true);

    const genRes = await window.electronAPI.generateOfferLetter({
      user,
      candidateId: candidateId,
      jobId: jobId,
      templateData: formData,
    });

    if (genRes.success) {
      toast.loading(`⏳ Generating PDF for ${genRes.candidateName}...`, { id: 'pdf-gen' });
      
      const pdfRes = await window.electronAPI.printToPDF(genRes.tempPath);
      toast.dismiss('pdf-gen');

      if (pdfRes.success) {
        toast.success(`✅ Offer Letter saved as PDF to: ${pdfRes.filePath}`, { duration: 5000 });
      } else {
        toast.error('❌ ' + (pdfRes.error || 'PDF generation failed during the save process.'));
      }
    } else {
      toast.error('❌ ' + (genRes.error || 'Failed to generate letter. Ensure the candidate is assigned to a job.'));
    }

    setIsGenerating(false);
  };

  // If no job is assigned, show alert
  if (!jobId) {
    return (
      <div className="offer-letter-container">
        <div className="offer-no-job-alert">
          <div className="offer-no-job-alert-icon">
            <FiAlertTriangle />
          </div>
          <p>⚠️ No job assignment found for this candidate. Please assign a job first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="offer-letter-container">
      {/* JOB ASSIGNMENT SELECTOR SECTION */}
      <div className="offer-job-selector-container">
        <h3>
          <FiBriefcase /> SELECT JOB ASSIGNMENT
        </h3>
        <select
          value={jobId || ''}
          disabled
          className="offer-job-select"
        >
          <option value={jobId}>ACME Employment - Welder</option>
        </select>
      </div>

      {/* OFFER LETTER GENERATION FORM */}
      <div className="offer-form-container">
        <h3>
          <FiFileText /> Generate Job Offer Letter
        </h3>

        <div className="offer-form-grid">
          {/* MONTHLY SALARY */}
          <div className="offer-form-field">
            <label>
              <FiDollarSign /> MONTHLY SALARY (REQUIRED)
            </label>
            <input
              type="number"
              name="monthlySalary"
              value={formData.monthlySalary}
              onChange={handleFormChange}
              placeholder="40000"
              required
            />
          </div>

          {/* EXPECTED JOINING DATE */}
          <div className="offer-form-field">
            <label>
              <FiCalendar /> EXPECTED JOINING DATE
            </label>
            <input
              type="date"
              name="joiningDate"
              value={formData.joiningDate}
              onChange={handleFormChange}
              required
            />
          </div>

          {/* ACCEPTANCE DEADLINE */}
          <div className="offer-form-field">
            <label>
              <FiClock /> ACCEPTANCE DEADLINE
            </label>
            <input
              type="date"
              name="acceptanceDate"
              value={formData.acceptanceDate}
              onChange={handleFormChange}
            />
          </div>

          {/* ASSIGNED JOB ID */}
          <div className="offer-form-field">
            <label>
              <FiHash /> ASSIGNED JOB ID
            </label>
            <input
              type="text"
              name="assignedJobId"
              value={formData.assignedJobId || jobId}
              onChange={handleFormChange}
              placeholder="6"
              disabled
            />
          </div>
        </div>

        {/* GENERATE BUTTON */}
        <button
          className="offer-generate-btn"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <FiDownload className="spinning" /> Generating PDF...
            </>
          ) : (
            <>
              <FiDownload /> Generate and Save PDF
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default OfferLetterGenerator;
