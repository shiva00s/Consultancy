import React, { useState } from 'react';
import { readFileAsBuffer } from '../utils/file';
import { FiPlus, FiTrash2, FiUser, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import useAuthStore from '../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import AadharQRScanner from '../components/tools/AadharQRScanner';
import PassportScanner from '../components/tools/PassportScanner';
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
  notes: '',
  Position: '',
};

function AddCandidatePage() {
  const [textData, setTextData] = useState(initialTextData);
  const [files, setFiles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [resetKey, setResetKey] = useState(0);
  const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));

  const handleReset = () => {
  setTextData(initialTextData);
  setFiles([]);
  setErrors({});
  setResetKey(prev => prev + 1); // 🔥 FORCE FULL RESET
  toast('Form fully reset ✨');
};


  const handleQRData = (data, fileObject) => {
    if (!data || !data.uid) return;
    setTextData((prev) => ({
      ...prev,
      name: data.name || prev.name,
      aadhar: data.uid,
      dob:
        !prev.dob && data.yob
          ? `${data.yob}-01-01`
          : data.dob || prev.dob,
      notes:
        prev.notes +
        (prev.notes ? '\n' : '') +
        `[Verified Address]: ${data.co}, ${data.vtc}, ${data.pc}`,
    }));
    setErrors((prev) => ({ ...prev, aadhar: null }));
    if (fileObject) {
      setFiles((prev) => [...prev, fileObject]);
      toast.success('Aadhaar image attached 📎');
    }
  };

  const handlePassportData = (data) => {
    if (!data || !data.passport || !data.passport.passportNo) return;
    setTextData((prev) => ({
      ...prev,
      passportNo: data.passport.passportNo || prev.passportNo,
      passportExpiry: sanitizeDate(data.passport.expiry) || prev.passportExpiry,
      dob: sanitizeDate(data.passport.dob) || prev.dob,
    }));

    if (data.fileObject) {
      setFiles((prev) => [...prev, data.fileObject]);
      toast.success('Passport image attached 🛄');
    } else if (data.filePath) {
      const mockFile = {
        name: data.filePath.split(/[/\\]/).pop(),
        path: data.filePath,
        type: 'image/jpeg',
      };
      setFiles((prev) => [...prev, mockFile]);
      toast.success('Passport image attached 🛄');
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
        toast.success(`Candidate saved ✅ ID: ${result.id}`);
        handleReset();
      } else if (result.errors) {
        setErrors(result.errors);
        toast.error('Please fix the highlighted fields ⚠️');
      } else {
        toast.error(`Error: ${result.error}`);
      }
    } catch (err) {
      toast.error(`Unexpected error: ${err.message}`);
    }

    setIsSaving(false);
  };

  return (
    <div className="add-candidate-container">
      <header className="add-candidate-header">
        <div className="header-left">
          <div className="avatar-circle">
            <FiUser />
          </div>
          <div>
            <h1>New Candidate 🚀</h1>
            <p className="header-subtitle">
              Aadhaar, Passport and details side by side, documents in a smart grid below.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="header-reset-btn"
          onClick={handleReset}
        >
          <FiRefreshCw className="spin-icon" />
          Reset all
        </button>
      </header>

      {/* 3 equal columns: Aadhaar | Passport | Form */}
      <div className="add-candidate-main three-columns">
        {/* Aadhaar */}
        <section className="ocr-card">
          <div className="ocr-card-header">
            <span className="ocr-pill aadhaar-pill" />
            <div>
              <h2>Offline Aadhaar 🔐</h2>
              <p>Scan secure QR to verify Aadhaar, DOB and address.</p>
            </div>
          </div>
          <div className="ocr-inner">
            <h3>Upload Aadhaar QR</h3>
            <p>Drop or select a QR image. Data will auto‑fill the form.</p>
            <AadharQRScanner key={`aadhaar-${resetKey}`} onScanSuccess={handleQRData} />
          </div>
        </section>

        {/* Passport */}
        <section className="ocr-card">
          <div className="ocr-card-header">
            <span className="ocr-pill passport-pill" />
            <div>
              <h2>Auto‑Scan Passport 🛄</h2>
              <p>Read MRZ to extract passport number, expiry and DOB.</p>
            </div>
          </div>
          <div className="ocr-inner">
            <h3>Upload Passport</h3>
            <p>Use a clear MRZ photo for best accuracy.</p>
            <PassportScanner key={`passport-${resetKey}`} onScanSuccess={handlePassportData} />
          </div>
        </section>

        {/* Form */}
        <form className="candidate-form-card" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className={`form-group ${errors.name ? 'error' : ''}`}>
              <label>👤 Name</label>
              <input
                type="text"
                name="name"
                value={textData.name}
                onChange={handleTextChange}
                placeholder="Candidate full name"
              />
              {errors.name && <p className="error-text">{errors.name}</p>}
            </div>

            <div className={`form-group ${errors.passportNo ? 'error' : ''}`}>
              <label>🛂 Passport No</label>
              <input
                type="text"
                name="passportNo"
                value={textData.passportNo}
                onChange={handleTextChange}
              />
              {errors.passportNo && (
                <p className="error-text">{errors.passportNo}</p>
              )}
            </div>

            <div className={`form-group ${errors.passportExpiry ? 'error' : ''}`}>
              <label>📅 Passport Expiry</label>
              <input
                type="date"
                name="passportExpiry"
                value={sanitizeDate(textData.passportExpiry)}
                onChange={handleTextChange}
              />
              {errors.passportExpiry && (
                <p className="error-text">{errors.passportExpiry}</p>
              )}
            </div>

            <div className="form-group">
              <label>🎓 Education</label>
              <input
                type="text"
                name="education"
                value={textData.education}
                onChange={handleTextChange}
                placeholder="e.g., B.Tech, MCA"
              />
            </div>

            <div className={`form-group ${errors.experience ? 'error' : ''}`}>
              <label>💼 Experience (years)</label>
              <input
                type="number"
                name="experience"
                value={textData.experience}
                onChange={handleTextChange}
              />
              {errors.experience && (
                <p className="error-text">{errors.experience}</p>
              )}
            </div>

            <div className={`form-group ${errors.contact ? 'error' : ''}`}>
              <label>📞 Contact</label>
              <input
                type="text"
                name="contact"
                value={textData.contact}
                onChange={handleTextChange}
              />
              {errors.contact && (
                <p className="error-text">{errors.contact}</p>
              )}
            </div>

            <div className={`form-group ${errors.aadhar ? 'error' : ''}`}>
              <label>🔑 Aadhaar Number</label>
              <input
                type="text"
                name="aadhar"
                value={textData.aadhar}
                onChange={handleTextChange}
              />
              {errors.aadhar && (
                <p className="error-text">{errors.aadhar}</p>
              )}
            </div>

            <div className={`form-group ${errors.Position ? 'error' : ''}`}>
              <label>🎯 Position</label>
              <input
                type="text"
                name="Position"
                value={textData.Position}
                onChange={handleTextChange}
                placeholder="Role applied for"
              />
              {errors.Position && (
                <p className="error-text">{errors.Position}</p>
              )}
            </div>

            <div className={`form-group ${errors.dob ? 'error' : ''}`}>
              <label>🎂 Date of Birth</label>
              <input
                type="date"
                name="dob"
                value={sanitizeDate(textData.dob)}
                onChange={handleTextChange}
              />
              {errors.dob && <p className="error-text">{errors.dob}</p>}
            </div>

            <div className="form-group full-width">
              <label>📌 Status</label>
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

            <div className="form-group full-width">
              <label>📝 Notes</label>
              <textarea
                name="notes"
                value={textData.notes}
                onChange={handleTextChange}
                placeholder="Extra info or verified address..."
              />
            </div>
          </div>

          <button
            type="submit"
            className="primary-btn full-width-btn"
            disabled={isSaving}
          >
            {isSaving ? 'Saving… ⏳' : 'Save New Candidate 💾'}
          </button>
        </form>
      </div>

      {/* Attached documents 3‑column grid */}
      <section className="documents-section">
        <h2>Attached Documents (from scan or upload) 📎</h2>

        <div className="custom-file-input">
          <input
            type="file"
            id="add-candidate-files"
            multiple
            onChange={handleFileChange}
          />
          <label htmlFor="add-candidate-files" className="file-input-label">
            <FiPlus /> Add More Files
          </label>
        </div>

        {files.length > 0 ? (
          <div className="file-grid">
            {files.map((file, index) => (
              <div className="file-chip" key={index}>
                <span className="file-name">
                  {file.name}
                  {typeof file.size === 'number' && (
                    <span className="file-size">
                      {' '}
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="remove-file-btn"
                  onClick={() => removeFile(index)}
                >
                  <FiTrash2 /> 
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="file-empty-hint">No documents attached yet. Start by adding a file 📂</p>
        )}
      </section>
    </div>
  );
}

export default AddCandidatePage;
