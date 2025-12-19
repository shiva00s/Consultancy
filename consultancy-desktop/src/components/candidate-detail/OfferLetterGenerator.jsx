import React, { useState } from 'react';
import { FiFileText, FiDownload, FiAlertTriangle } from 'react-icons/fi';
import toast from 'react-hot-toast';

const initialFormData = {
  monthlySalary: '40000',
  joiningDate: new Date().toISOString().slice(0, 10),
  acceptanceDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), 
};

function OfferLetterGenerator({user, candidateId, jobId }) {
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
      
      // FIX: Correct function name is printToPDF (uppercase PDF)
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

  if (!jobId) {
    return (
      <div className="form-message error">
        <FiAlertTriangle /> ⚠️ Select a job assignment from the Job Placements tab first to generate an offer letter.
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--border-radius)' }}>
      <h3><FiFileText /> 📜 Generate Job Offer Letter</h3>
      
      <div className="form-grid" style={{ gap: '15px' }}>
        <div className="form-group">
          <label>💰 Monthly Salary (Required)</label>
          <input type="number" name="monthlySalary" value={formData.monthlySalary} onChange={handleFormChange} />
        </div>
        <div className="form-group">
          <label>📅 Expected Joining Date</label>
          <input type="date" name="joiningDate" value={formData.joiningDate} onChange={handleFormChange} />
        </div>
        <div className="form-group">
          <label>⏰ Acceptance Deadline</label>
          <input type="date" name="acceptanceDate" value={formData.acceptanceDate} onChange={handleFormChange} />
        </div>
        <div className="form-group">
          <label>💼 Assigned Job ID</label>
          <input type="text" value={jobId} readOnly disabled />
        </div>
      </div>

      <button className="btn mt-4" onClick={handleGenerate} disabled={isGenerating}>
        <FiDownload /> {isGenerating ? '⏳ Generating...' : '📥 Generate and Save PDF'}
      </button>
    </div>
  );
}

export default OfferLetterGenerator;
