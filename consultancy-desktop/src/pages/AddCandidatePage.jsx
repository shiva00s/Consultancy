import React, { useState, useCallback, useEffect } from 'react';
import { readFileAsBuffer } from '../utils/file';
import { FiPlus, FiTrash2, FiUser, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import useAuthStore from '../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import ScannerModal from '../components/tools/ScannerModal';
import '../css/AddCandidatePage.css';
import CustomDropdown from '../components/tools/CustomDropdown';

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
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [jobPositions, setJobPositions] = useState([]);
  const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));

  // ✅ FETCH JOB POSITIONS ON LOAD
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
    setResetKey(prev => prev + 1);
    toast('Form fully reset ✨');
  };

  const openScanner = (type) => {
    setModalType(type);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType(null);
  };

  const handleQRData = useCallback((data, fileObject) => {
    if (!data || !data.uid) return;
    
    requestAnimationFrame(() => {
      setTextData((prev) => ({
        ...prev,
        name: data.name || prev.name,
        aadhar: data.uid,
        dob: !prev.dob && data.yob ? `${data.yob}-01-01` : data.dob || prev.dob,
        notes: prev.notes + (prev.notes ? '\n' : '') + `[Verified Address]: ${data.co}, ${data.vtc}, ${data.pc}`,
      }));
      
      setErrors((prev) => ({ ...prev, aadhar: null }));
      
      if (fileObject) {
        setFiles((prev) => [...prev, fileObject]);
        toast.success('Aadhaar image attached 📎');
      }
      
      closeModal();
    });
  }, []);

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
    closeModal();
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
    <div className="add-candidate-container fade-in">
      <header className="add-candidate-header">
        <div className="header-left">
          <div className="avatar-circle">
            <FiUser size={20} />
          </div>
          <div>
            <h1>New Candidate 🚀</h1>
            <p className="header-subtitle">
              Scan documents or manually fill the form. All data auto-saved below.
            </p>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="scanner-btn aadhaar-btn"
            onClick={() => openScanner('aadhaar')}
          >
            🔐 Scan Aadhaar
          </button>
          <button
            type="button"
            className="scanner-btn passport-btn"
            onClick={() => openScanner('passport')}
          >
            🛄 Scan Passport
          </button>
          <button
            type="button"
            className="header-reset-btn"
            onClick={handleReset}
          >
            <FiRefreshCw size={16} />
            Reset
          </button>
        </div>
      </header>

      <form className="candidate-form-card card-elevated slide-up" onSubmit={handleSubmit}>
        <div className="form-grid-5">
          <div className={`form-group ${errors.name ? 'error' : ''}`}>
            <label>👤 Name</label>
            <input
              type="text"
              name="name"
              value={textData.name}
              onChange={handleTextChange}
              placeholder="Full name"
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
              placeholder="e.g., M1234567"
            />
            {errors.passportNo && <p className="error-text">{errors.passportNo}</p>}
          </div>

          <div className="form-group">
            <label>📅 Passport Expiry</label>
            <input
              type="date"
              name="passportExpiry"
              value={sanitizeDate(textData.passportExpiry)}
              onChange={handleTextChange}
            />
          </div>

          <div className="form-group">
            <label>🎓 Education</label>
            <input
              type="text"
              name="education"
              value={textData.education}
              onChange={handleTextChange}
              placeholder="e.g., B.Tech"
            />
          </div>

          <div className="form-group">
            <label>💼 Experience</label>
            <input
              type="text"
              name="experience"
              value={textData.experience}
              onChange={handleTextChange}
              placeholder="Years"
            />
          </div>

          <div className={`form-group ${errors.contact ? 'error' : ''}`}>
            <label>📞 Contact</label>
            <input
              type="text"
              name="contact"
              value={textData.contact}
              onChange={handleTextChange}
              placeholder="Phone"
            />
            {errors.contact && <p className="error-text">{errors.contact}</p>}
          </div>

          <div className={`form-group ${errors.aadhar ? 'error' : ''}`}>
            <label>🪪 Aadhaar</label>
            <input
              type="text"
              name="aadhar"
              value={textData.aadhar}
              onChange={handleTextChange}
              placeholder="12 digits"
            />
            {errors.aadhar && <p className="error-text">{errors.aadhar}</p>}
          </div>

          <div className={`form-group ${errors.Position ? 'error' : ''}`}>
  <label>🎯 Position</label>
  <CustomDropdown
    name="Position"
    value={textData.Position}
    onChange={handleTextChange}
    options={jobPositions}
    placeholder="Select or type position"
    allowCustom={true}
  />
  {errors.Position && <p className="error-text">{errors.Position}</p>}
</div>


          <div className={`form-group ${errors.dob ? 'error' : ''}`}>
            <label>🎂 DOB</label>
            <input
              type="date"
              name="dob"
              value={sanitizeDate(textData.dob)}
              onChange={handleTextChange}
            />
            {errors.dob && <p className="error-text">{errors.dob}</p>}
          </div>

          <div className="form-group">
            <label>📊 Status</label>
            <select name="status" value={textData.status} onChange={handleTextChange}>
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
              placeholder="Additional information..."
              rows={3}
            />
          </div>
        </div>

        <button type="submit" className="primary-btn full-width-btn" disabled={isSaving}>
          {isSaving ? (
            <>
              <FiRefreshCw className="spin-icon" size={18} />
              Saving...
            </>
          ) : (
            '💾 Save Candidate'
          )}
        </button>
      </form>

      <section className="documents-section card-elevated slide-up-delay">
        <h2>📎 Attached Documents</h2>

        <div className="custom-file-input">
          <input
            type="file"
            id="add-candidate-files"
            multiple
            onChange={handleFileChange}
          />
          <label htmlFor="add-candidate-files" className="file-input-label">
            <FiPlus size={16} />
            Upload Files
          </label>
        </div>

        {files.length > 0 ? (
          <div className="file-grid">
            {files.map((file, index) => (
              <div className="file-chip" key={index}>
                <span className="file-name">
                  {file.name}
                  {typeof file.size === 'number' && (
                    <span className="file-size"> ({(file.size / 1024).toFixed(1)} KB)</span>
                  )}
                </span>
                <button
                  type="button"
                  className="remove-file-btn"
                  onClick={() => removeFile(index)}
                  title="Remove"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="file-empty-hint">📭 No documents yet</p>
        )}
      </section>

      {showModal && (
        <ScannerModal
          type={modalType}
          resetKey={resetKey}
          onClose={closeModal}
          onQRData={handleQRData}
          onPassportData={handlePassportData}
        />
      )}
    </div>
  );
}

export default AddCandidatePage;
