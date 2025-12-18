import React, { useState, useCallback, useEffect } from 'react';
import { readFileAsBuffer } from '../utils/file';
import { FiPlus, FiTrash2, FiUser, FiRefreshCw, FiCamera, FiCreditCard, FiBook } from 'react-icons/fi';
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
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);

  const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));

  // FETCH JOB POSITIONS ON LOAD
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
    setPhotoPreview(null);
    setPhotoFile(null);
    setErrors({});
    setResetKey(prev => prev + 1);
    toast('✨ Form fully reset');
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
        toast.success('✅ Aadhaar image attached 📎');
      }
      closeModal();
    });
  }, []);

  // PHOTO UPLOAD HANDLER
  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('❌ Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('❌ Photo size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target.result);
      setPhotoFile(file);
      toast.success('✅ Photo selected 📸');
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoPreview(null);
    setPhotoFile(null);
    toast('🗑️ Photo removed');
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
      toast.success('✅ Passport image attached 🛄');
    } else if (data.filePath) {
      const mockFile = {
        name: data.filePath.split(/[/\\]/).pop(),
        path: data.filePath,
        type: 'image/jpeg',
      };
      setFiles((prev) => [...prev, mockFile]);
      toast.success('✅ Passport image attached 🛄');
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
          const readRes = await window.electronAPI.readAbsoluteFileBuffer({ filePath: file.path });
          if (!readRes.success) {
            throw new Error(`Failed to read scanned file: ${readRes.error}`);
          }
          buffer = readRes.buffer;
          fileType = readRes.type || file.type;
        } else {
          buffer = await readFileAsBuffer(file);
        }

        return { name: file.name, type: fileType, buffer };
      });

      const fileData = await Promise.all(fileDataPromises);

      const result = await window.electronAPI.saveCandidateMulti({
        user,
        textData,
        files: fileData,
      });

      if (result.success) {
        toast.success(`✅ Candidate saved! ID: ${result.id}`);

        // UPLOAD CANDIDATE PHOTO AFTER SUCCESSFUL SAVE
        if (photoFile && result.data?.candidateId) {
          try {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const photoResult = await window.electronAPI.uploadCandidatePhoto({
                candidateId: result.data.candidateId,
                fileBuffer: Array.from(new Uint8Array(reader.result)),
                fileName: photoFile.name
              });
              if (photoResult.success) {
                toast.success('📷 Photo uploaded successfully!');
              } else {
                toast.error('❌ Failed to upload photo: ' + photoResult.error);
              }
            };
            reader.readAsArrayBuffer(photoFile);
          } catch (error) {
            console.error('Photo upload error:', error);
            toast.error('❌ Failed to upload photo');
          }
        }

        handleReset();
      } else if (result.errors) {
        setErrors(result.errors);
        toast.error('⚠️ Please fix the highlighted fields');
      } else {
        toast.error(`❌ Error: ${result.error}`);
      }
    } catch (err) {
      toast.error(`❌ Unexpected error: ${err.message}`);
    }

    setIsSaving(false);
  };

  return (
    <div className="add-candidate-container fade-in">
      {/* ========== HEADER WITH PROFILE PHOTO PREVIEW ========== */}
      <header className="add-candidate-header slide-up">
        <div className="header-left">
          {/* 🔥 CIRCULAR PHOTO PREVIEW - Replaces Avatar Icon */}
          {photoPreview ? (
            <div className="avatar-circle" style={{ 
              backgroundImage: `url(${photoPreview})`, 
              backgroundSize: 'cover', 
              backgroundPosition: 'center' 
            }}></div>
          ) : (
            <div className="avatar-circle">
              <FiUser size={28} />
            </div>
          )}
          
          <div>
            <h1>✨ Add Candidate</h1>
            <p className="header-subtitle">Fill the details below to register a new candidate</p>
          </div>
        </div>

        {/* ========== ACTION BUTTONS ========== */}
        <div className="header-actions">
          {/* 📸 PHOTO UPLOAD BUTTON */}
          <label className="scanner-btn photo-btn">
            <FiCamera size={16} />
            <span>📸 Add Photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{ display: 'none' }}
            />
          </label>

          {/* 🆔 SCAN AADHAAR QR BUTTON */}
          <button
            type="button"
            className="scanner-btn aadhaar-btn"
            onClick={() => openScanner('aadhaar')}
          >
            <FiCreditCard size={16} />
            <span>🆔 Scan Aadhaar QR</span>
          </button>

          {/* 🛂 SCAN PASSPORT MRZ BUTTON */}
          <button
            type="button"
            className="scanner-btn passport-btn"
            onClick={() => openScanner('passport')}
          >
            <FiBook size={16} />
            <span>🛂 Scan Passport MRZ</span>
          </button>

          {/* 🔄 RESET BUTTON */}
          <button type="button" className="header-reset-btn" onClick={handleReset}>
            <FiRefreshCw size={16} />
            <span>🔄 Reset</span>
          </button>
        </div>
      </header>

      {/* ========== FORM CARD ========== */}
      <form className="candidate-form-card slide-up-delay card-elevated" onSubmit={handleSubmit}>
        <div className="form-grid-5">
          {/* 👤 NAME */}
          <div className={`form-group ${errors.name ? 'error' : ''}`}>
            <label>👤 Name *</label>
            <input
              type="text"
              name="name"
              value={textData.name}
              onChange={handleTextChange}
              placeholder="Enter full name"
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          {/* 📞 CONTACT */}
          <div className={`form-group ${errors.contact ? 'error' : ''}`}>
            <label>📞 Contact *</label>
            <input
              type="text"
              name="contact"
              value={textData.contact}
              onChange={handleTextChange}
              placeholder="Enter contact number"
            />
            {errors.contact && <span className="error-text">{errors.contact}</span>}
          </div>

          {/* 🎂 DATE OF BIRTH */}
          <div className={`form-group ${errors.dob ? 'error' : ''}`}>
            <label>🎂 Date of Birth</label>
            <input
              type="date"
              name="dob"
              value={textData.dob}
              onChange={handleTextChange}
            />
            {errors.dob && <span className="error-text">{errors.dob}</span>}
          </div>

          {/* 🆔 AADHAAR NUMBER */}
          <div className={`form-group ${errors.aadhar ? 'error' : ''}`}>
            <label>🆔 Aadhaar Number</label>
            <input
              type="text"
              name="aadhar"
              value={textData.aadhar}
              onChange={handleTextChange}
              placeholder="Enter 12-digit Aadhaar"
            />
            {errors.aadhar && <span className="error-text">{errors.aadhar}</span>}
          </div>

          {/* 📋 STATUS */}
          <div className={`form-group ${errors.status ? 'error' : ''}`}>
            <label>📋 Status *</label>
            <select name="status" value={textData.status} onChange={handleTextChange}>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Shortlisted">Shortlisted</option>
              <option value="Selected">Selected</option>
              <option value="Deployed">Deployed</option>
            </select>
            {errors.status && <span className="error-text">{errors.status}</span>}
          </div>

          {/* 🎓 EDUCATION */}
          <div className={`form-group ${errors.education ? 'error' : ''}`}>
            <label>🎓 Education</label>
            <input
              type="text"
              name="education"
              value={textData.education}
              onChange={handleTextChange}
              placeholder="Enter education details"
            />
            {errors.education && <span className="error-text">{errors.education}</span>}
          </div>

          {/* 💼 EXPERIENCE */}
          <div className={`form-group ${errors.experience ? 'error' : ''}`}>
            <label>💼 Experience (Years)</label>
            <input
              type="number"
              name="experience"
              value={textData.experience}
              onChange={handleTextChange}
              placeholder="Years of experience"
            />
            {errors.experience && <span className="error-text">{errors.experience}</span>}
          </div>

          {/* 🛂 PASSPORT NUMBER */}
          <div className={`form-group ${errors.passportNo ? 'error' : ''}`}>
            <label>🛂 Passport Number</label>
            <input
              type="text"
              name="passportNo"
              value={textData.passportNo}
              onChange={handleTextChange}
              placeholder="Enter passport number"
            />
            {errors.passportNo && <span className="error-text">{errors.passportNo}</span>}
          </div>

          {/* 📅 PASSPORT EXPIRY */}
          <div className={`form-group ${errors.passportExpiry ? 'error' : ''}`}>
            <label>📅 Passport Expiry</label>
            <input
              type="date"
              name="passportExpiry"
              value={textData.passportExpiry}
              onChange={handleTextChange}
            />
            {errors.passportExpiry && <span className="error-text">{errors.passportExpiry}</span>}
          </div>

          {/* 💼 POSITION */}
          <div className={`form-group ${errors.Position ? 'error' : ''}`}>
            <label>💼 Position</label>
            <CustomDropdown
              key={resetKey}
              name="Position"
              value={textData.Position}
              onChange={handleTextChange}
              options={jobPositions}
              placeholder="Select or type position"
            />
            {errors.Position && <span className="error-text">{errors.Position}</span>}
          </div>

          {/* 📝 NOTES */}
          <div className="form-group full-width">
            <label>📝 Notes</label>
            <textarea
              name="notes"
              value={textData.notes}
              onChange={handleTextChange}
              placeholder="Additional notes or comments"
            />
          </div>
        </div>

        {/* ========== DOCUMENTS SECTION ========== */}
        <div className="documents-section">
          <h2>📎 Attach Documents</h2>
          
          <div className="custom-file-input">
            <label className="file-input-label">
              <FiPlus size={18} />
              <span>Add Files</span>
            </label>
            <input type="file" multiple onChange={handleFileChange} />
          </div>

          {files.length === 0 ? (
            <p className="file-empty-hint">💡 No documents attached yet</p>
          ) : (
            <div className="file-grid">
              {files.map((file, index) => (
                <div key={index} className="file-chip">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={() => removeFile(index)}
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ========== SUBMIT BUTTON ========== */}
        <button type="submit" className="primary-btn full-width-btn" disabled={isSaving}>
          {isSaving ? (
            <>
              <FiRefreshCw className="spin-icon" size={20} />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <FiPlus size={20} />
              <span>💾 Save Candidate</span>
            </>
          )}
        </button>
      </form>

      {/* ========== SCANNER MODAL ========== */}
      {showModal && (
        <ScannerModal
          type={modalType}
          onClose={closeModal}
          onAadhaarData={handleQRData}
          onPassportData={handlePassportData}
        />
      )}
    </div>
  );
}

export default AddCandidatePage;
