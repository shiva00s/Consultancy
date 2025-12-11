import React, { useState, useRef, useMemo } from "react";
import {
  FiFileText,
  FiCamera,
  FiTrash2,
  FiUpload,
  FiEye,
  FiDownload,
  FiAlertTriangle,
  FiCheckCircle,
} from "react-icons/fi";
import toast from "react-hot-toast";
import DocumentViewer from "../DocumentViewer";
import { readFileAsBuffer } from "../../utils/file";
import "../../css/CandidateDocuments.css";
import DocumentChecker from "./DocumentChecker";

const documentCategories = [
  "Uncategorized",
  "Passport",
  "Resume",
  "Photograph",
  "Education",
  "Experience Letter",
  "Pan",
  "Offer Letter",
  "Visa",
  "Other", // <-- ADDED 'Experience Letter' and 'Pan'
];

function CandidateDocuments({
  user,
  candidateId,
  documents,
  onDocumentsUpdate,
}) {
  const [newFiles, setNewFiles] = useState([]);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("Uncategorized");
  const fileInputRef = useRef(null);

  // Group documents by category for display
  const groupedDocuments = useMemo(() => {
    if (!documents) return {};
    return documents.reduce((acc, doc) => {
      const category = doc.category || "Uncategorized";
      if (!acc[category]) acc[category] = [];
      acc[category].push(doc);
      return acc;
    }, {});
  }, [documents]);

  // --- HANDLERS ---
  const handleFileChange = (e) => {
    setNewFiles(Array.from(e.target.files));
  };

  const handleAddDocuments = async () => {
    if (newFiles.length === 0) return;
    setIsUploading(true);
    let toastId = toast.loading("Uploading documents...");

    try {
      const fileDataPromises = newFiles.map(async (file) => {
        const buffer = await readFileAsBuffer(file);
        return {
          name: file.name,
          type: file.type,
          buffer: buffer,
          category: uploadCategory,
        };
      });
      const fileData = await Promise.all(fileDataPromises);

      const res = await window.electronAPI.addDocuments({
        user, // --- INJECTED ---
        candidateId,
        files: fileData,
      });

      if (res.success) {
        onDocumentsUpdate(res.newDocs); // Pass new documents back up
        setNewFiles([]);
        setUploadCategory("Uncategorized");
        if (fileInputRef.current) fileInputRef.current.value = null;
        toast.success("Documents added!", { id: toastId });
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`, { id: toastId });
    }
    setIsUploading(false);
  };

  const handleDeleteDocument = async (docId, fileName) => {
  if (
    !window.confirm(
      `Are you sure you want to move file "${fileName}" to the Recycle Bin?`
    )
  ) {
    return;
  }

  try {
    const res = await window.electronAPI.deleteDocument({ 
      user, 
      docId 
    });
    
    if (res.success) {
      onDocumentsUpdate([], docId); // Pass docId to delete in parent
      toast.success("Document moved to Recycle Bin.");
    } else {
      toast.error(res.error || "Failed to delete document");
    }
  } catch (error) {
    toast.error(`Error: ${error.message}`);
  }
};


  const handleChangeCategory = async (docId, newCategory, fileName) => {
    const res = await window.electronAPI.updateDocumentCategory({
      user,
      docId,
      category: newCategory,
    });
    if (res.success) {
      onDocumentsUpdate([{ id: docId, category: newCategory }], null, true); // Update category in parent
      toast.success(`Category for ${fileName} updated to ${newCategory}.`);
    } else {
      toast.error("Failed to update category.");
    }
  };

  const openFile = (filePath) => {
    window.electronAPI.openFileExternally({ path: filePath });
  };

  const viewFile = (doc) => {
    const isViewable =
      doc.fileType === "application/pdf" || doc.fileType?.startsWith("image/");
    if (isViewable) {
      setViewingDoc(doc);
    } else {
      openFile(doc.filePath);
    }
  };

  const hasDocuments = documents && documents.length > 0;

  return (
    <div className="document-tab-content module-vertical-stack">
      {viewingDoc && (
        <DocumentViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />
      )}

        {viewingDoc && (
            <DocumentViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />
        )}

        <DocumentChecker candidateDocuments={documents} />
        <div className="module-list-card doc-list-card">
          <h3>Documents Uploaded ({documents.length})</h3>
          <div className="doc-list-grouped">
            {!hasDocuments ? (
              <p className="doc-list-empty" style={{textAlign: 'center', color: 'var(--text-secondary)'}}>
                No documents uploaded for this candidate.
              </p>
            ) : (
               Object.keys(groupedDocuments).map((category) => (
                <div className="doc-category-group" key={category}>
                  <h4 className="doc-category-title">{category}</h4>
                  <div className="module-list document-list">
                    {groupedDocuments[category].map((doc) => (
                      <div className="doc-item" key={doc.id}>
                        <div className="doc-icon">
                          {doc.fileType?.startsWith('image/') ? ( <FiCamera /> ) : ( <FiFileText /> )}
                        </div>
                        <span className="doc-name" title={doc.fileName}>{doc.fileName}</span>

                        <div className="doc-category-select">
                          <select 
                            value={doc.category} 
                            onChange={(e) => handleChangeCategory(doc.id, e.target.value, doc.fileName)}
                          >
                            {documentCategories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                          </select>
                        </div>
                        <div className="doc-actions">
                            <button 
                                type="button" 
                               className="icon-btn"
                                title="View in App / Open Externally" 
                                onClick={() => viewFile(doc)}
                            > 
                                <FiEye /> 
                            </button>
                            <button 
                                type="button" 
                               className="icon-btn"
                                title="Move to Recycle Bin" 
                                onClick={() => handleDeleteDocument(doc.id, doc.fileName)}
                            > 
                                <FiTrash2 /> 
                            </button>
                        </div>                        
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      {/* --- ADD DOCUMENTS FORM --- */}
      <div className="module-form-card add-docs-section">
        <h3>
          <FiUpload /> Upload More Documents
        </h3>
        <form className="add-docs-form" onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label>Select File(s)</label>
            <div className="custom-file-input">
              <input
                type="file"
                id="new-files-input"
                multiple
                onChange={handleFileChange}
                ref={fileInputRef}
              />
              <label
                htmlFor="new-files-input"
                className="file-input-label btn btn-no-hover"
              >
                Choose Files
              </label>
              <span className="file-name-display">
                {newFiles.length === 0
                  ? "No file chosen"
                  : newFiles.length === 1
                    ? newFiles[0].name
                    : `${newFiles.length} files selected`}
              </span>
            </div>
          </div>
          <div className="form-group">
            <label>Assign a Category</label>
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
          <button
            className="btn"
            onClick={handleAddDocuments}
            disabled={newFiles.length === 0 || isUploading}
            style={{ gridColumn: "1 / -1" }}
          >
            {isUploading ? (
              "Uploading..."
            ) : (
              <> Upload {newFiles.length || 0} File(s) </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CandidateDocuments;
