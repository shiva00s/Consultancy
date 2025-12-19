import React, { useState, useRef } from "react";
import {
  FiUploadCloud,
  FiFilePlus,
  FiTrash2,
} from "react-icons/fi";
import "../css/DocumentUploader.css";

function DocumentUploader({
  user,
  candidateId,
  documentCategories,
  onUploaded,       // (newDocs) => void
  readFileAsBuffer, // util
}) {
  const [uploadCategory, setUploadCategory] = useState("📂 Uncategorized");
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  const handleFileSelect = (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    setFiles((prev) => [...prev, ...list]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove("du-drop-over");
    const list = Array.from(e.dataTransfer.files || []);
    if (!list.length) return;
    setFiles((prev) => [...prev, ...list]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.add("du-drop-over");
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove("du-drop-over");
  };

  const clearFiles = () => setFiles([]);

  const handleUpload = async () => {
    if (!files.length || isUploading) return;

    setIsUploading(true);

    try {
      const fileDataPromises = files.map(async (file) => {
        const buffer = await readFileAsBuffer(file);
        return {
          name: file.name,
          type: file.type,
          buffer,
          category: uploadCategory,
        };
      });

      const fileData = await Promise.all(fileDataPromises);

      const res = await window.electronAPI.addDocuments({
        user,
        candidateId,
        files: fileData,
      });

      if (!res.success) {
        throw new Error(res.error || "Upload failed");
      }

      onUploaded(res.newDocs);
      setFiles([]);
      setUploadCategory("📂 Uncategorized");
      if (fileInputRef.current) fileInputRef.current.value = null;
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="du-card module-form-card">
      <header className="du-header">
        <div className="du-title">
          <span className="du-emoji">📤</span>
          <div>
            <h3>📄 Upload Documents</h3>
            <p>🎯 Drop files or browse. Assign a category and upload.</p>
          </div>
        </div>
      </header>

      <div className="du-body">
        <div className="du-field">
          <label>📂 Document Category</label>
          <select
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
          >
            {documentCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div
          ref={dropRef}
          className="du-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <FiUploadCloud className="du-drop-icon" />
          <div className="du-drop-text">
            <span>🎯 Drag &amp; drop files here</span>
            <small>💡 or click to browse from your computer</small>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
        </div>

        {files.length > 0 && (
          <div className="du-files">
            <div className="du-files-header">
              <span className="du-files-title">
                <FiFilePlus /> 📋 Selected files ({files.length})
              </span>
              <button
                type="button"
                className="du-mini-btn"
                onClick={clearFiles}
              >
                <FiTrash2 /> 🗑️ Clear
              </button>
            </div>
            <ul className="du-files-list">
              {files.map((f, idx) => (
                <li key={`${f.name}-${idx}`}>
                  <span className="du-file-name">📄 {f.name}</span>
                  <span className="du-file-size">
                    💾 {formatSize(f.size)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <footer className="du-footer">
        <button
          type="button"
          className="du-upload-btn"
          onClick={handleUpload}
          disabled={!files.length || isUploading}
        >
          <FiUploadCloud />
          <span>
            {isUploading
              ? "⏳ Uploading..."
              : `✅ Upload ${files.length || 0} file(s)`}
          </span>
        </button>
      </footer>
    </div>
  );
}

export default DocumentUploader;
