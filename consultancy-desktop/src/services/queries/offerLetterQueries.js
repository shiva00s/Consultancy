// src/services/queries/offerLetterQueries.js
// 📄 Offer Letter Generation for OfferLetterGenerator.jsx
// IPC: generateOfferLetter + printToPDF

const getDatabase = require('../database.cjs');
const { dbGet } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const PDFDocument = require('pdfkit'); // npm i pdfkit

/**
 * generateOfferLetter → OfferLetterGenerator.jsx [file:35]
 * 1. Validate: candidate + job assignment exists
 * 2. Fetch: candidate + job + employer details  
 * 3. Generate: HTML template → temp PDF path
 */
async function generateOfferLetter(user, candidateId, jobId, templateData) {
  const db = getDatabase();
  
  try {
    // 1. Validate candidate exists
    const candidate = await dbGet(db, 
      `SELECT name, Position, passportNo, contact FROM candidates 
       WHERE id = ? AND isDeleted = 0`, [candidateId]);
    if (!candidate) {
      return { success: false, error: 'Candidate not found' };
    }

    // 2. Validate job assignment exists
    const placement = await dbGet(db, 
      `SELECT p.id FROM placements p 
       JOIN joborders j ON p.joborderid = j.id 
       WHERE p.candidateid = ? AND p.joborderid = ? AND p.isDeleted = 0`, 
      [candidateId, jobId]);
    if (!placement) {
      return { success: false, error: 'Candidate must be assigned to this job first' };
    }

    // 3. Fetch job + employer details
    const jobDetails = await dbGet(db, 
      `SELECT j.positionTitle, j.country, e.companyName, e.contactPerson 
       FROM joborders j 
       JOIN employers e ON j.employerid = e.id 
       WHERE j.id = ? AND j.isDeleted = 0`, [jobId]);
    
    if (!jobDetails) {
      return { success: false, error: 'Job details not found' };
    }

    // 4. Generate temp PDF path
    const docsDir = path.join(app.getPath('userData'), 'offer-letters');
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
    
    const fileName = `Offer-${candidate.name.replace(/\s+/g, '_')}-${Date.now()}.pdf`;
    const tempPath = path.join(docsDir, fileName);

    // 5. Create PDF with pdfkit
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(tempPath));

    // Offer Letter Template
    doc.fontSize(20).text('JOB OFFER LETTER', 50, 50);
    doc.fontSize(12)
       .text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 50, 100)
       .text(`To: ${candidate.name}`, 50, 130)
       .text(`Passport: ${candidate.passportNo}`, 50, 150)
       .text(`Position: ${jobDetails.positionTitle}`, 50, 170)
       .text(`Company: ${jobDetails.companyName}`, 50, 190)
       .text(`Location: ${jobDetails.country}`, 50, 210)
       .text(`Monthly Salary: ₹${templateData.monthlySalary.toLocaleString()}`, 50, 230)
       .text(`Joining Date: ${templateData.joiningDate}`, 50, 250)
       .text(`Acceptance Deadline: ${templateData.acceptanceDate}`, 50, 270)
       .text('Please sign and return by acceptance deadline.', 50, 320)
       .text('Sincerely,', 400, 400)
       .text(`${user.username || 'HR Manager'}`, 400, 420);

    doc.end();

    return {
      success: true,
      tempPath,
      candidateName: candidate.name,
      jobTitle: jobDetails.positionTitle,
      companyName: jobDetails.companyName
    };

  } catch (err) {
    console.error('generateOfferLetter error:', err);
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

/**
 * printToPDF → Save final PDF (user selects location)
 * Called after generateOfferLetter success
 */
async function printToPDF(tempPath) {
  try {
    if (!fs.existsSync(tempPath)) {
      return { success: false, error: 'Temporary PDF not found' };
    }

    // Electron dialog → user selects save location
    const { dialog } = require('electron');
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: path.basename(tempPath),
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (!filePath) return { success: false, error: 'Save cancelled' };

    fs.copyFileSync(tempPath, filePath);
    fs.unlinkSync(tempPath); // Clean temp file

    return { success: true, filePath };
  } catch (err) {
    console.error('printToPDF error:', err);
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// 🔌 EXACT IPC HANDLERS from OfferLetterGenerator.jsx [file:35]
module.exports = {
  generateOfferLetter,
  printToPDF
};
