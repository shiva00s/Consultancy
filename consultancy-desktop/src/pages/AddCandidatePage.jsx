import React, { useState } from 'react';
import { readFileAsBuffer } from '../utils/file';
import {  FiFileText} from 'react-icons/fi';
import toast from 'react-hot-toast';
import {  FiPlus } from 'react-icons/fi';
import useAuthStore from '../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import AadharQRScanner from '../components/tools/AadharQRScanner';
import PassportScanner from '../components/tools/PassportScanner';


// Helper to ensure dates are valid YYYY-MM-DD or empty string
const sanitizeDate = (dateString) => {
    if (!dateString) return '';
    // Basic check for ISO format: YYYY-MM-DD
    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (typeof dateString === 'string' && isoRegex.test(dateString)) {
        return dateString;
    }
    return ''; // Return empty string for invalid dates
};
function AddCandidatePage() { 
  
  const initialTextData = {
    name: '',
    education: '',
    experience: '',
    dob: '',
    passportNo: '',
    passportExpiry: '',
    contact: '',
    aadhar: '',
    status: 'New',
    notes: '',
    Position: '',
  };

  const [textData, setTextData] = useState(initialTextData);
  const [files, setFiles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  
  const { user } = useAuthStore(
    useShallow((state) => ({ user: state.user }))
  );

  // --- 1. Handler for Aadhaar QR Data + File ---
  const handleQRData = (data, fileObject) => {
    if (data.uid) {
        setTextData(prev => ({
            ...prev,            
            name: data.name || prev.name,
            aadhar: data.uid, 
            dob: (!prev.dob && data.yob) ? `${data.yob}-01-01` : (data.dob || prev.dob), 
            notes: prev.notes + (prev.notes ? '\n' : '') + `[Verified Address]: ${data.co}, ${data.vtc}, ${data.pc}`
        }));
        setErrors(prev => ({ ...prev, aadhar: null }));

        // AUTO-ATTACH FILE
        if (fileObject) {
            setFiles(prev => [...prev, fileObject]);
            toast.success("Aadhaar image attached to documents.");
        }
    }
  };

  // --- 2. Handler for Passport OCR Data + File ---
  const handlePassportData = (data) => {
      // Data: { passport: {...}, fileObject: File, filePath: string }
      
      if (data.passport && data.passport.passportNo) {
        setTextData(prev => ({
            ...prev,
            passportNo: data.passport.passportNo || prev.passportNo,
            passportExpiry: data.passport.expiry || prev.passportExpiry, 
            dob: data.passport.dob || prev.dob,
        }));
        
        // AUTO-ATTACH FILE
        if (data.fileObject) {
             setFiles(prev => [...prev, data.fileObject]);
             toast.success("Passport image attached to documents.");
        } else if (data.filePath) {
             // Fallback if only path is sent (from electron scanner)
             const mockFile = {
                 name: data.filePath.split(/[/\\]/).pop(),
                 path: data.filePath,
                 type: 'image/jpeg' 
             };
             setFiles(prev => [...prev, mockFile]);
             toast.success("Passport image attached to documents.");
        }
      } 
  };

  

  // --- 3. Standard Form Handlers ---
  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setTextData((prev) => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
        setFiles(prev => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index) => {
      setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({}); // Clear old errors
    setIsSaving(true);

    try {
      // Convert all files (manual + scanned) to buffers for Electron IPC
      const fileDataPromises = files.map(async (file) => {
        let buffer;
        let fileType = file.type;

        // CRITICAL FIX: If the file is from the scanner (has a .path property), read the buffer using FS.
        if (file.path) {
            // Need a new handler to read raw buffer data from the absolute path
            const readRes = await window.electronAPI.readAbsoluteFileBuffer({ filePath: file.path });
            if (!readRes.success) throw new Error(`Failed to read scanned file: ${readRes.error}`);
            buffer = readRes.buffer;
            // Use the determined type from the backend handler if available, otherwise fallback
            fileType = readRes.type || file.type; 
        } else {
            // Standard browser File object handling
            buffer = await readFileAsBuffer(file);
        }

        return {
          name: file.name,
          type: fileType,
          buffer: buffer,
        };
      });

      const fileData = await Promise.all(fileDataPromises);

      const result = await window.electronAPI.saveCandidateMulti({
        user, 
        textData,
        files: fileData,
      });

      if (result.success) {
        toast.success(`Successfully saved candidate! New ID: ${result.id}`);
        setTextData(initialTextData);
        setFiles([]);
        setErrors({});
        // Reset file inputs if any ref was held (not strictly needed with controlled state logic above)
      } else {
        if (result.errors) {
          setErrors(result.errors);
          toast.error('Please correct the errors below.');
        } else {
          toast.error(`Error: ${result.error}`);
        }
      }
    } catch (err) {
      toast.error(`An error occurred: ${err.message}`);
    }

    setIsSaving(false);
  };

  return (
    <div className="add-candidate-container">
      <h2>Add New Candidate</h2>
      
      {/* --- INTELLIGENT SCANNERS SECTION --- */}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '2rem'}}>
        {/* 1. Aadhaar Scanner */}
        <AadharQRScanner onScanSuccess={handleQRData} />
        
        {/* 2. Passport Scanner */}
        <PassportScanner onScanSuccess={handlePassportData} />
      </div>

     

      <form onSubmit={handleSubmit}>
        {/* CRITICAL FIX: Overriding the default 3-column grid for perfect 2-column alignment */}
       <div className="form-grid">
            
          {/* LEFT COLUMN FIELDS */}

          {/* Name */}
          <div className={`form-group ${errors.name ? 'error' : ''}`}>
            <label>Name:</label>
            <input
              type="text"
              name="name"
              value={textData.name}
              onChange={handleTextChange}
            />
            {errors.name && <p className="error-text">{errors.name}</p>}
          </div>

          {/* Passport No */}
          <div className={`form-group ${errors.passportNo ? 'error' : ''}`}>
            <label>Passport No:</label>
            <input
              type="text"
              name="passportNo"
              value={textData.passportNo}
              onChange={handleTextChange}
              placeholder="e.g., K9876543"
              style={{borderColor: textData.passportNo ? 'var(--success-color)' : ''}}
            />
            {errors.passportNo && <p className="error-text">{errors.passportNo}</p>}
          </div>

          {/* Passport Expiry */}
          <div className={`form-group ${errors.passportExpiry ? 'error' : ''}`}>
            <label>Passport Expiry:</label>
            <input
              type="date"
              name="passportExpiry"
              value={textData.passportExpiry}
              onChange={handleTextChange}
            />
            {errors.passportExpiry && <p className="error-text">{errors.passportExpiry}</p>}
          </div>
          
          {/* Education */}
          <div className="form-group">
            <label>Education:</label>
            <input
              type="text"
              name="education"
              value={textData.education}
              onChange={handleTextChange}
              placeholder="e.g., MCA, B.Tech"
            />
          </div>

          {/* Experience */}
          <div className={`form-group ${errors.experience ? 'error' : ''}`}>
            <label>Experience (years):</label>
            <input
              type="number"
              name="experience"
              value={textData.experience}
              onChange={handleTextChange}
            />
            {errors.experience && <p className="error-text">{errors.experience}</p>}
          </div>
          
          {/* RIGHT COLUMN FIELDS */}

          {/* Contact */}
          <div className={`form-group ${errors.contact ? 'error' : ''}`}>
            <label>Contact Number:</label>
            <input
              type="text"
              name="contact"
              value={textData.contact}
              onChange={handleTextChange}
            />
            {errors.contact && <p className="error-text">{errors.contact}</p>}
          </div>

          {/* Aadhar */}
          <div className={`form-group ${errors.aadhar ? 'error' : ''}`}>
            <label>Aadhar Number:</label>
            <input
              type="text"
              name="aadhar"
              value={textData.aadhar}
              onChange={handleTextChange}
              placeholder="12-digit number"
            />
            {errors.aadhar && <p className="error-text">{errors.aadhar}</p>}
          </div>

          {/* Position */}
          <div className={`form-group ${errors.Position ? 'error' : ''}`}>
            <label>Position Applying For:</label>
            <input
              type="text"
              name="Position"
              value={textData.Position}
              onChange={handleTextChange}
            />
            {errors.Position && <p className="error-text">{errors.Position}</p>}
          </div>
          
          {/* DOB */}
          <div className={`form-group ${errors.dob ? 'error' : ''}`}>
            <label>Date of Birth:</label>
            <input
              type="date"
              name="dob"
              value={textData.dob}
              onChange={handleTextChange}
            />
            {errors.dob && <p className="error-text">{errors.dob}</p>}
          </div>
          
          {/* Status (Remains full-width but uses the last slot) */}
          <div className="form-group full-width">
            <label>Status:</label>
            <select
              name="status"
              value={textData.status}
              onChange={handleTextChange}
            >
              <option value="New">New</option>
              <option value="Documents Collected">Documents Collected</option>
              <option value="Visa Applied">Visa Applied</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Notes */}
          <div className="form-group full-width">
            <label>Notes:</label>
            <textarea
              name="notes"
              value={textData.notes}
              onChange={handleTextChange}
            ></textarea>
          </div>
          
          {/* File Upload Section */}
          <div className="form-group full-width">
            <label>Attached Documents (From Scan or Manual Upload):</label>
            <div className="custom-file-input">
              <input 
                type="file" 
                name="documents" 
                id="add-candidate-files" 
                onChange={handleFileChange} 
                multiple 
              />
              {/* CRITICAL FIX: Ensure the label uses the standard blue background (.file-input-label default) and the correct icon/text */}
              <label htmlFor="add-candidate-files" className="file-input-label btn btn-no-hover">
                <FiPlus /> Add More Files
              </label>
            </div>
            
            {/* Display List of Files (Scanned or Uploaded) */}
            {files.length > 0 ? (
              <ul className="file-list" style={{marginTop: '10px', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '5px', backgroundColor: 'var(--bg-input)'}}>
                {files.map((file, index) => (
                  <li key={index} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid var(--border-color)'}}>
                    <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                    <button 
                        type="button" 
                        onClick={() => removeFile(index)} 
                        style={{color:'var(--danger-color)', background:'none', border:'none', cursor:'pointer', fontWeight: 'bold'}}
                    >
                        Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
                <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle:'italic', marginTop:'5px'}}>No documents attached yet.</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-full-width"
          style={{ marginTop: '20px' }}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save New Candidate'}
        </button>
      </form>
    </div>
  );
}

export default AddCandidatePage;