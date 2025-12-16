import React, { useState, useEffect, useCallback } from 'react';
import { readFileAsBuffer } from '../utils/file';
import { FiPlus, FiTrash2, FiUser, FiRefreshCw, FiCreditCard, FiFileText } from 'react-icons/fi';
import toast from 'react-hot-toast';
import useAuthStore from '../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import ScannerModal from '../components/ScannerModal';
import '../css/AddCandidatePage.css';

const sanitizeDate = (dateString) => {
  if (!dateString) return '';
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof dateString === 'string' && isoRegex.test(dateString)) return dateString;
  return '';
};

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
  Position: '',
  notes: '',
};

function AddCandidatePage() {
  const [textData, setTextData] = useState(initialTextData);
  const [files, setFiles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [resetKey, setResetKey] = useState(0);
  const [scannerModal, setScannerModal] = useState({ open: false, type: null });
  const [jobPositions, setJobPositions] = useState([]);

  const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));

  useEffect(() => {
    const fetchJobPositions = async () => {
      try {
        const result = await window.electronAPI.getJobOrders({ user });
        if (result.success && result.data) {
          const positions = result.data
            .map((job) => job.positionTitle)
            .filter((pos, index, self) => pos && self.indexOf(pos) === index);
          setJobPositions(positions);
        }
      } catch (error) {
        console.error('Failed to fetch job positions:', error);
      }
    };
    fetchJobPositions();
  }, [user]);

 const handleReset = () => {
  setTextData(initialTextData);
  setFiles([]);
  setErrors({});
  setResetKey((prev) => prev + 1);
  
  // ✅ Defer toast to next tick
  setTimeout(() => {
    toast('✨ Form fully reset');
  }, 0);
};


  const openScanner = (type) => {
    setScannerModal({ open: true, type });
  };

  const closeScanner = () => {
    setScannerModal({ open: false, type: null });
  };

  const handleQRData = useCallback((data, fileObject) => {
  console.log('📥 Aadhaar Data:', data);
  
  if (!data || !data.uid) {
    toast.error('Invalid Aadhaar QR data');
    return;
  }

  // ✅ FIX: Convert DD-MM-YYYY to YYYY-MM-DD
  const convertDobFormat = (dobString) => {
    if (!dobString) return '';
    const ddmmyyyyRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = dobString.match(ddmmyyyyRegex);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }
    const yyyymmddRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (yyyymmddRegex.test(dobString)) {
      return dobString;
    }
    return '';
  };

  const formattedDob = data.dob 
    ? convertDobFormat(data.dob) 
    : (!data.dob && data.yob ? `${data.yob}-01-01` : '');

  // ✅ FIX: Defer state updates to avoid React warning
  requestAnimationFrame(() => {
    setTextData((prev) => ({
      ...prev,
      name: data.name || prev.name,
      aadhar: data.uid,
      dob: formattedDob || prev.dob,
      notes: prev.notes 
        ? `${prev.notes}\n[✅ Verified Aadhaar]: Name: ${data.name || 'N/A'}, UID: ${data.uid}, Address: ${data.co || ''}, ${data.vtc || ''}, ${data.pc || ''}`
        : `[✅ Verified Aadhaar]: Name: ${data.name || 'N/A'}, UID: ${data.uid}, Address: ${data.co || ''}, ${data.vtc || ''}, ${data.pc || ''}`,
    }));

    setErrors((prev) => ({ ...prev, aadhar: null, name: null, dob: null }));

    if (fileObject) {
      setFiles((prev) => {
        const exists = prev.some(f => f.name === fileObject.name && f.size === fileObject.size);
        if (exists) {
          toast('📎 Aadhaar image already attached');
          return prev;
        }
        toast.success('📎 Aadhaar image attached');
        return [...prev, fileObject];
      });
    }
  });
}, []);



  const handlePassportData = (data) => {
    console.log('📥 Passport Data:', data);
    
    if (!data || !data.passport || !data.passport.passportNo) {
      toast.error('Invalid Passport data');
      return;
    }

    const passportInfo = data.passport;

    setTextData((prev) => ({
      ...prev,
      name: passportInfo.name || prev.name,
      passportNo: passportInfo.passportNo || prev.passportNo,
      passportExpiry: sanitizeDate(passportInfo.expiry) || prev.passportExpiry,
      dob: sanitizeDate(passportInfo.dob) || prev.dob,
    }));

    setErrors((prev) => ({ ...prev, passportNo: null, name: null, dob: null }));

    if (data.fileObject) {
      setFiles((prev) => {
        const exists = prev.some(f => f.name === data.fileObject.name && f.size === data.fileObject.size);
        if (exists) {
          toast('🛄 Passport image already attached');
          return prev;
        }
        toast.success('🛄 Passport image attached');
        return [...prev, data.fileObject];
      });
    } else if (data.filePath) {
      const mockFile = {
        name: data.filePath.split(/[/\\]/).pop(),
        path: data.filePath,
        type: 'image/jpeg',
        size: 0,
      };
      setFiles((prev) => {
        const exists = prev.some(f => f.name === mockFile.name && f.path === mockFile.path);
        if (exists) {
          toast('🛄 Passport image already attached');
          return prev;
        }
        toast.success('🛄 Passport image attached');
        return [...prev, mockFile];
      });
    }
  };

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setTextData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setIsSaving(true);
    try {
      const fileDataPromises = files.map(async (file) => {
        let buffer;
        let fileType = file.type;
        if (file.path) {
          const readRes = await window.electronAPI.readAbsoluteFileBuffer({
            filePath: file.path,
          });
          if (!readRes.success) {
            throw new Error(`Failed to read scanned file: ${readRes.error}`);
          }
          buffer = readRes.buffer;
          fileType = readRes.type || file.type;
        } else {
          buffer = await readFileAsBuffer(file);
        }
        return {
          name: file.name,
          type: fileType,
          buffer,
        };
      });

      const fileData = await Promise.all(fileDataPromises);
      const result = await window.electronAPI.saveCandidateMulti({
        user,
        textData,
        files: fileData,
      });

      if (result.success) {
        toast.success(`✅ Candidate saved! ID: ${result.id}`);
        handleReset();
      } else if (result.errors) {
        setErrors(result.errors);
        toast.error('⚠️ Please fix the highlighted fields');
      } else {
        toast.error(`Error: ${result.error}`);
      }
    } catch (err) {
      toast.error(`Unexpected error: ${err.message}`);
    }
    setIsSaving(false);
  };

  return (
    <div className="add-candidate-container fade-in">
      {/* HEADER */}
      <div className="add-candidate-header">
        <div className="header-left">
          <div className="avatar-circle">
            <FiUser size={20} />
          </div>
          <div>
            <h1>
              <span className="emoji-inline">✨</span> New Candidate
            </h1>
            <p className="header-subtitle">Fill in candidate details below</p>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="scanner-btn aadhaar-btn"
            onClick={() => openScanner('aadhaar')}
            type="button"
            title="Scan Aadhaar QR"
          >
            <FiCreditCard size={16} />
            <span className="emoji-inline">🟢</span> Aadhaar
          </button>
          <button
            className="scanner-btn passport-btn"
            onClick={() => openScanner('passport')}
            type="button"
            title="Scan Passport MRZ"
          >
            <FiFileText size={16} />
            <span className="emoji-inline">🔵</span> Passport
          </button>
          <button
            className="header-reset-btn"
            onClick={handleReset}
            type="button"
            title="Reset Form"
          >
            <FiRefreshCw size={16} />
            Reset
          </button>
        </div>
      </div>

      {/* MAIN FORM */}
      <div className="candidate-form-card card-elevated slide-up">
        <form onSubmit={handleSubmit} className="form-grid-5">
          {/* Row 1 */}
          <div className={`form-group ${errors.name ? 'error' : ''}`}>
            <label>
              <span className="emoji-inline">👤</span> Name{' '}
              <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="text"
              name="name"
              value={textData.name}
              onChange={handleTextChange}
              placeholder="Full name"
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label>
              <span className="emoji-inline">🎓</span> Education
            </label>
            <input
              type="text"
              name="education"
              value={textData.education}
              onChange={handleTextChange}
              placeholder="e.g., B.Tech, MCA"
            />
          </div>

          <div className="form-group">
            <label>
              <span className="emoji-inline">💼</span> Experience (Years)
            </label>
            <input
              type="text"
              name="experience"
              value={textData.experience}
              onChange={handleTextChange}
              placeholder="e.g., 2"
            />
          </div>

          <div className={`form-group ${errors.dob ? 'error' : ''}`}>
            <label>
              <span className="emoji-inline">🎂</span> Date of Birth{' '}
              <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="date"
              name="dob"
              value={textData.dob}
              onChange={handleTextChange}
            />
            {errors.dob && <span className="error-text">{errors.dob}</span>}
          </div>

          <div className={`form-group ${errors.passportNo ? 'error' : ''}`}>
            <label>
              <span className="emoji-inline">🛂</span> Passport No{' '}
              <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="text"
              name="passportNo"
              value={textData.passportNo}
              onChange={handleTextChange}
              placeholder="e.g., M1234567"
            />
            {errors.passportNo && (
              <span className="error-text">{errors.passportNo}</span>
            )}
          </div>

          {/* Row 2 */}
          <div className="form-group">
            <label>
              <span className="emoji-inline">📅</span> Passport Expiry
            </label>
            <input
              type="date"
              name="passportExpiry"
              value={textData.passportExpiry}
              onChange={handleTextChange}
            />
          </div>

          <div className={`form-group ${errors.contact ? 'error' : ''}`}>
            <label>
              <span className="emoji-inline">📞</span> Contact{' '}
              <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="text"
              name="contact"
              value={textData.contact}
              onChange={handleTextChange}
              placeholder="Phone number"
            />
            {errors.contact && (
              <span className="error-text">{errors.contact}</span>
            )}
          </div>

          <div className={`form-group ${errors.aadhar ? 'error' : ''}`}>
            <label>
              <span className="emoji-inline">🪪</span> Aadhaar Number{' '}
              <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="text"
              name="aadhar"
              value={textData.aadhar}
              onChange={handleTextChange}
              placeholder="12-digit Aadhaar"
            />
            {errors.aadhar && (
              <span className="error-text">{errors.aadhar}</span>
            )}
          </div>

          <div className="form-group">
            <label>
              <span className="emoji-inline">📊</span> Status
            </label>
            <select name="status" value={textData.status} onChange={handleTextChange}>
              <option value="New">🟢 New</option>
              <option value="Active">🔵 Active</option>
              <option value="Inactive">⚫ Inactive</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              <span className="emoji-inline">🎯</span> Position
            </label>
            <select
              name="Position"
              value={textData.Position}
              onChange={handleTextChange}
            >
              <option value="">Role applied for</option>
              {jobPositions.map((pos, idx) => (
                <option key={idx} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>

          {/* Row 3 - Notes (Full Width) */}
          <div className="form-group full-width">
            <label>
              <span className="emoji-inline">📝</span> Notes
            </label>
            <textarea
              name="notes"
              value={textData.notes}
              onChange={handleTextChange}
              rows={3}
              placeholder="Extra info or verified address..."
            />
          </div>
        </form>
      </div>

      {/* DOCUMENTS SECTION */}
      <div className="documents-section card-elevated slide-up-delay">
        <h2>
          <span className="emoji-inline">📎</span> Documents
        </h2>

        <div className="custom-file-input">
          <input
            type="file"
            id="file-upload"
            multiple
            onChange={handleFileChange}
          />
          <label htmlFor="file-upload" className="file-input-label">
            <FiPlus size={16} />
            Upload Files
          </label>
        </div>

        {files.length > 0 ? (
          <div className="file-grid">
            {files.map((file, index) => (
              <div key={index} className="file-chip">
                <span className="file-name">{file.name}</span>
                <span className="file-size">
                  {file.size ? (file.size / 1024).toFixed(1) + ' KB' : ''}
                </span>
                <button
                  type="button"
                  className="remove-file-btn"
                  onClick={() => removeFile(index)}
                  title="Remove file"
                >
                  <FiTrash2 />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="file-empty-hint">
            <span className="emoji-inline">📭</span> No documents attached yet.
            Start by adding a file
          </p>
        )}
      </div>

      {/* SUBMIT BUTTON */}
      <button
        type="submit"
        className="primary-btn full-width-btn"
        disabled={isSaving}
        onClick={handleSubmit}
      >
        {isSaving ? (
          <>
            <FiRefreshCw className="spin-icon" size={18} />
            Saving...
          </>
        ) : (
          <>
            <span className="emoji-inline">💾</span> Save Candidate
          </>
        )}
      </button>

      {/* SCANNER MODAL */}
      <ScannerModal
        open={scannerModal.open}
        type={scannerModal.type}
        onClose={closeScanner}
        onQRData={handleQRData}
        onPassportData={handlePassportData}
        resetKey={resetKey}
      />
    </div>
  );
}

export default AddCandidatePage;
