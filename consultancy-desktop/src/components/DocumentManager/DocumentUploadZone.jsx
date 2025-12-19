import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUpload, FiX, FiFile, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import './DocumentUploadZone.css';

const DocumentUploadZone = ({ categories, onUpload, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  // File validation
  const validateFile = (file, category) => {
    const maxSize = 5 * 1024 * 1024; // 5MB default
    const errors = [];

    if (file.size > maxSize) {
      errors.push('File size exceeds 5MB');
    }

    // Add more validations based on category
    const cat = categories.find(c => c.id === category);
    if (cat?.acceptedTypes) {
      const fileExt = '.' + file.name.split('.').pop().toLowerCase();
      if (!cat.acceptedTypes.includes(fileExt)) {
        errors.push(`Only ${cat.acceptedTypes.join(', ')} files allowed`);
      }
    }

    return errors;
  };

  // Auto-detect category from filename
  const detectCategory = (filename) => {
    const lower = filename.toLowerCase();
    
    if (lower.includes('resume') || lower.includes('cv')) return 'resume';
    if (lower.includes('aadhar') || lower.includes('aadhaar')) return 'aadhar';
    if (lower.includes('pan')) return 'pan';
    if (lower.includes('driving') || lower.includes('license')) return 'driving';
    if (lower.includes('photo') || lower.includes('passport')) return 'photograph';
    if (lower.includes('education') || lower.includes('degree') || lower.includes('certificate')) return 'education';
    if (lower.includes('experience') || lower.includes('employment')) return 'experience';
    if (lower.includes('offer')) return 'offer';
    if (lower.includes('visa')) return 'visa';
    if (lower.includes('medical')) return 'medical';
    
    return 'uncategorized';
  };

  // Handle file drop
  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map(file => {
      const detectedCategory = selectedCategory || detectCategory(file.name);
      const errors = validateFile(file, detectedCategory);
      
      return {
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        category: detectedCategory,
        errors,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        status: errors.length > 0 ? 'error' : 'ready'
      };
    });

    setFiles(prev => [...prev, ...newFiles]);
  }, [selectedCategory, categories]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple: true
  });

  // Remove file
  const removeFile = (fileId) => {
    setFiles(files.filter(f => f.id !== fileId));
  };

  // Update file category
  const updateFileCategory = (fileId, newCategory) => {
    setFiles(files.map(f => {
      if (f.id === fileId) {
        const errors = validateFile(f.file, newCategory);
        return {
          ...f,
          category: newCategory,
          errors,
          status: errors.length > 0 ? 'error' : 'ready'
        };
      }
      return f;
    }));
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Handle upload
  const handleUpload = async () => {
    const validFiles = files.filter(f => f.status === 'ready');
    if (validFiles.length === 0) {
      alert('No valid files to upload');
      return;
    }

    setUploading(true);

    // Simulate upload progress (replace with actual upload logic)
    for (const fileData of validFiles) {
      try {
        // Update progress
        setUploadProgress(prev => ({ ...prev, [fileData.id]: 0 }));

        // Simulate progress
        for (let i = 0; i <= 100; i += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          setUploadProgress(prev => ({ ...prev, [fileData.id]: i }));
        }

        // Mark as completed
        setFiles(prev => prev.map(f => 
          f.id === fileData.id ? { ...f, status: 'completed' } : f
        ));
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === fileData.id ? { ...f, status: 'error', errors: ['Upload failed'] } : f
        ));
      }
    }

    // Call parent upload handler
    await onUpload(validFiles.map(f => f.file), validFiles[0]?.category);
    
    setUploading(false);
    setUploadProgress({});
    
    // Close after successful upload
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  const readyCount = files.filter(f => f.status === 'ready').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <div className="upload-zone-overlay" onClick={onClose}>
      <div className="upload-zone-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="upload-header">
          <div>
            <h3>📤 Upload Documents</h3>
            <p>Drag and drop files or click to browse</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        {/* Category Selector */}
        <div className="category-selector">
          <label>Default Category (Optional):</label>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Auto-detect from filename</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Dropzone */}
        <div 
          {...getRootProps()} 
          className={`dropzone ${isDragActive ? 'active' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="dropzone-content">
            <FiUpload className="upload-icon" />
            {isDragActive ? (
              <p className="drop-text">Drop files here...</p>
            ) : (
              <>
                <p className="drop-text">Drag & drop files here</p>
                <p className="drop-subtext">or click to browse</p>
                <div className="file-types">
                  Accepted: PDF, DOC, DOCX, JPG, PNG (Max 5MB)
                </div>
              </>
            )}
          </div>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="file-list">
            <div className="file-list-header">
              <h4>Files to Upload ({files.length})</h4>
              {errorCount > 0 && (
                <span className="error-count">⚠️ {errorCount} errors</span>
              )}
            </div>

            <div className="file-items">
              {files.map(fileData => (
                <div 
                  key={fileData.id} 
                  className={`file-item ${fileData.status}`}
                >
                  {/* Preview */}
                  <div className="file-preview">
                    {fileData.preview ? (
                      <img src={fileData.preview} alt={fileData.name} />
                    ) : (
                      <div className="file-icon-placeholder">
                        <FiFile />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="file-details">
                    <h5>{fileData.name}</h5>
                    <div className="file-meta">
                      <span>{formatFileSize(fileData.size)}</span>
                      <span>•</span>
                      <span>{fileData.type}</span>
                    </div>

                    {/* Category Selector */}
                    <select
                      value={fileData.category}
                      onChange={(e) => updateFileCategory(fileData.id, e.target.value)}
                      disabled={uploading}
                      className="file-category-select"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </select>

                    {/* Errors */}
                    {fileData.errors.length > 0 && (
                      <div className="file-errors">
                        {fileData.errors.map((error, idx) => (
                          <div key={idx} className="error-message">
                            <FiAlertCircle /> {error}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Progress */}
                    {uploadProgress[fileData.id] !== undefined && (
                      <div className="upload-progress">
                        <div 
                          className="progress-bar"
                          style={{ width: `${uploadProgress[fileData.id]}%` }}
                        />
                        <span className="progress-text">
                          {uploadProgress[fileData.id]}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div className="file-status">
                    {fileData.status === 'ready' && !uploading && (
                      <button 
                        className="remove-btn"
                        onClick={() => removeFile(fileData.id)}
                      >
                        <FiX />
                      </button>
                    )}
                    {fileData.status === 'completed' && (
                      <FiCheckCircle className="status-icon success" />
                    )}
                    {fileData.status === 'error' && (
                      <FiAlertCircle className="status-icon error" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="upload-actions">
          <button 
            className="btn-secondary" 
            onClick={onClose}
            disabled={uploading}
          >
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleUpload}
            disabled={readyCount === 0 || uploading}
          >
            {uploading ? (
              <>
                <div className="spinner" />
                Uploading...
              </>
            ) : (
              <>
                <FiUpload />
                Upload {readyCount} {readyCount === 1 ? 'File' : 'Files'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentUploadZone;

