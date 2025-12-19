import React, { useState, useRef } from "react";
import { FiUploadCloud, FiFilePlus, FiTrash2 } from "react-icons/fi";
import ConfirmDialog from "./common/ConfirmDialog";
import "../css/DocumentUploader.css";

function DocumentUploader({
  user,
  candidateId,
  documentCategories,
  onUploaded,
}) {
  const [uploadCategory, setUploadCategory] = useState("📂 Uncategorized");
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, index: null });
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  // ✅ Smart auto-categorization based on filename
  const detectCategory = (fileName) => {
    const name = fileName.toLowerCase();

    // Resume/CV patterns
    if (
      name.includes("resume") ||
      name.includes("cv") ||
      name.includes("curriculum") ||
      name.includes("vitae")
    ) {
      return "📄 Resume/CV";
    }

    // Education Certificate patterns
    if (
      name.includes("certificate") ||
      name.includes("degree") ||
      name.includes("diploma") ||
      name.includes("transcript") ||
      name.includes("marksheet") ||
      name.includes("education")
    ) {
      return "🎓 Education Certificate";
    }

    // ID Proof patterns
    if (
      name.includes("passport") ||
      name.includes("aadhar") ||
      name.includes("aadhaar") ||
      name.includes("pan") ||
      name.includes("driver") ||
      name.includes("license") ||
      name.includes("id_proof") ||
      name.includes("idproof") ||
      name.includes("national_id")
    ) {
      return "🆔 ID Proof";
    }

    // Passport Photo patterns
    if (
      name.includes("photo") ||
      name.includes("passport_photo") ||
      name.includes("passport_size") ||
      name.includes("photograph")
    ) {
      return "📸 Passport Photos";
    }

    // Visa Document patterns
    if (
      name.includes("visa") ||
      name.includes("travel") ||
      name.includes("immigration") ||
      name.includes("entry_permit")
    ) {
      return "✈️ Visa Documents";
    }

    // Employment Records patterns
    if (
      name.includes("employment") ||
      name.includes("experience") ||
      name.includes("offer_letter") ||
      name.includes("offerletter") ||
      name.includes("appointment") ||
      name.includes("salary") ||
      name.includes("payslip") ||
      name.includes("relieving") ||
      name.includes("service")
    ) {
      return "💼 Employment Records";
    }

    // Medical Reports patterns
    if (
      name.includes("medical") ||
      name.includes("health") ||
      name.includes("report") ||
      name.includes("test") ||
      name.includes("prescription") ||
      name.includes("lab") ||
      name.includes("xray") ||
      name.includes("scan")
    ) {
      return "🏥 Medical Reports";
    }

    // Default to Uncategorized
    return "📂 Uncategorized";
  };

  // ✅ Read file as buffer
  const readFileAsBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result;
        const buffer = new Uint8Array(arrayBuffer);
        resolve(buffer);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  };

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

  // ✅ Open delete confirmation dialog
  const handleDeleteClick = (index) => {
    setDeleteDialog({ open: true, index });
  };

  // ✅ Confirm and remove file
  const handleDeleteConfirm = () => {
    const { index } = deleteDialog;
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setDeleteDialog({ open: false, index: null });
  };

  // ✅ Cancel delete
  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, index: null });
  };

  const clearFiles = () => setFiles([]);

  const handleUpload = async () => {
    if (!files.length || isUploading) return;

    setIsUploading(true);

    try {
      // ✅ Auto-categorize each file based on its name
      const fileDataPromises = files.map(async (file) => {
        const buffer = await readFileAsBuffer(file);
        const autoCategory = detectCategory(file.name);

        return {
          name: file.name,
          type: file.type,
          buffer: Array.from(buffer),
          // ✅ Use auto-detected category if uploadCategory is "Uncategorized"
          category:
            uploadCategory === "📂 Uncategorized"
              ? autoCategory
              : uploadCategory,
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
      alert(`Upload failed: ${err.message}`);
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

  // ✅ Show detected category for each file
  const getFileCategory = (fileName) => {
    if (uploadCategory !== "📂 Uncategorized") {
      return uploadCategory;
    }
    return detectCategory(fileName);
  };

  return (
    <div className="du-card module-form-card">
      {/* ✅ Confirm Delete Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        title="🗑️ Remove File"
        message={
          deleteDialog.index !== null && files[deleteDialog.index]
            ? `Are you sure you want to remove "${files[deleteDialog.index].name}" from the upload list?`
            : "Are you sure you want to remove this file from the upload list?"
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      <header className="du-header">
        <div className="du-title">
          <span className="du-emoji">📤</span>
          <div>
            <h3>📄 Upload Documents</h3>
            <p>🎯 Drop files or browse. Auto-categorized by filename.</p>
          </div>
        </div>
      </header>

      <div className="du-body">
        <div className="du-field">
          <label>📂 Override Category (Optional)</label>
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
          <small
            style={{
              color: "#94a3b8",
              fontSize: "0.85rem",
              marginTop: "4px",
              display: "block",
            }}
          >
            💡 Leave as "Uncategorized" for automatic detection
          </small>
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
                <FiTrash2 /> 🗑️ Clear All
              </button>
            </div>
            <ul className="du-files-list">
              {files.map((f, idx) => (
                <li key={`${f.name}-${idx}`}>
                  <div className="du-file-info">
                    <span className="du-file-name">📄 {f.name}</span>
                    <span className="du-file-category">
                      🏷️ {getFileCategory(f.name)}
                    </span>
                    <span className="du-file-size">
                      💾 {formatSize(f.size)}
                    </span>
                  </div>
                  {/* ✅ Individual Delete Button */}
                  <button
                    type="button"
                    className="du-file-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(idx);
                    }}
                    title="Remove file"
                  >
                    <FiTrash2 />
                  </button>
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
