import React, { useState } from "react";
import {
  FiFileText,
  FiCamera,
  FiTrash2,
  FiEye,
  FiFile,
} from "react-icons/fi";
import "../css/DocumentList.css";

const categoryEmojis = {
  Passport: "🛂",
  Resume: "📄",
  Photograph: "🖼️",
  "Education Certificate": "🎓",
  "Experience Letter": "🏢",
  "Offer Letter": "📜",
  Visa: "✈️",
  "Aadhar Card": "🪪",
  "Pan Card": "💳",
  "Medical Certificate": "🏥",
  "Driving License": "🚘",
  Uncategorized: "📁",
};

function DocumentList({
  groupedDocuments,
  documentCategories,
  onChangeCategory,
  onView,
  onDelete,
}) {
  const [previewCache, setPreviewCache] = useState({});
  const [hoveredDoc, setHoveredDoc] = useState(null);

  const hasDocuments =
    groupedDocuments && Object.keys(groupedDocuments).length > 0;

  // Get file type category
  const getFileCategory = (fileType, fileName) => {
    if (!fileType && !fileName) return "other";
    
    const type = fileType?.toLowerCase() || "";
    const name = fileName?.toLowerCase() || "";

    if (type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name)) {
      return "image";
    }
    if (type === "application/pdf" || name.endsWith(".pdf")) {
      return "pdf";
    }
    if (type.startsWith("text/") || /\.(txt|csv|log)$/i.test(name)) {
      return "text";
    }
    if (
      type.includes("word") ||
      type.includes("document") ||
      /\.(doc|docx)$/i.test(name)
    ) {
      return "document";
    }
    if (
      type.includes("sheet") ||
      type.includes("excel") ||
      /\.(xls|xlsx)$/i.test(name)
    ) {
      return "spreadsheet";
    }
    return "other";
  };

  // Fetch file preview
  const fetchPreview = async (doc) => {
  console.log('🔍 Fetching preview for:', doc.fileName, doc.id);
  
  if (previewCache[doc.id]) {
    console.log('✅ Using cached preview for:', doc.fileName);
    return;
  }

  const fileCategory = getFileCategory(doc.fileType, doc.fileName);
  console.log('📁 File category detected:', fileCategory);

  try {
    // For images - get base64
    if (fileCategory === "image") {
      console.log('🖼️ Fetching image base64 for:', doc.filePath);
      
      const res = await window.electronAPI.getImageBase64({
        filePath: doc.filePath,
      });

      console.log('📥 Response received:', res.success ? '✅ Success' : '❌ Failed', res);

      if (res.success) {
        setPreviewCache((prev) => ({
          ...prev,
          [doc.id]: {
            type: "image",
            data: res.data,
          },
        }));
        console.log('✅ Image preview cached successfully');
      } else {
        console.error('❌ Failed to load image:', res.error);
      }
    }
    // For PDFs
    else if (fileCategory === "pdf") {
      console.log('📄 Setting PDF preview');
      setPreviewCache((prev) => ({
        ...prev,
        [doc.id]: {
          type: "pdf",
          data: doc.fileName,
          fileSize: doc.fileSize || "Unknown size",
        },
      }));
    }
    // For text files
    else if (fileCategory === "text") {
      console.log('📝 Text file detected - treating as generic file');
      setPreviewCache((prev) => ({
        ...prev,
        [doc.id]: {
          type: "file",
          data: doc.fileName,
          fileType: "Text Document",
          fileSize: doc.fileSize || "Unknown size",
        },
      }));
    }
    // For other files
    else {
      console.log('📎 Generic file preview');
      setPreviewCache((prev) => ({
        ...prev,
        [doc.id]: {
          type: "file",
          data: doc.fileName,
          fileType: doc.fileType || "Unknown",
          fileSize: doc.fileSize || "Unknown size",
        },
      }));
    }
  } catch (error) {
    console.error('❌ Error loading preview:', error);
  }
};


  const handleMouseEnter = (doc) => {
  console.log('🖱️ Mouse Enter:', doc.fileName, 'ID:', doc.id);
  setHoveredDoc(doc.id);
  fetchPreview(doc);
};

const handleMouseLeave = () => {
  console.log('🖱️ Mouse Leave');
  setHoveredDoc(null);
};

  // Render preview content
  const renderPreviewContent = (preview) => {
    if (!preview) return null;

    switch (preview.type) {
      case "image":
        return (
          <div
            className="preview-image"
            style={{ backgroundImage: `url(${preview.data})` }}
          />
        );

      case "pdf":
        return (
          <div className="preview-pdf">
            <div className="preview-icon">📄</div>
            <div className="preview-info">
              <strong>PDF Document</strong>
              <p>{preview.data}</p>
              <small>{preview.fileSize}</small>
            </div>
          </div>
        );

      case "text":
        return (
          <div className="preview-text">
            <div className="preview-icon">📝</div>
            <pre>{preview.data}</pre>
          </div>
        );

      case "file":
        return (
          <div className="preview-file">
            <div className="preview-icon">📎</div>
            <div className="preview-info">
              <strong>{preview.data}</strong>
              <p>{preview.fileType}</p>
              <small>{preview.fileSize}</small>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="doclist-card module-list-card">
      <header className="doclist-header">
        <div className="doclist-title">
          <span className="doclist-emoji">📂</span>
          <div>
            <h3>Documents Uploaded</h3>
            <p>Quickly review, preview, and manage all files.</p>
          </div>
        </div>
      </header>

      {!hasDocuments ? (
        <div className="doclist-empty">
          <span>😶 No documents uploaded for this candidate.</span>
        </div>
      ) : (
        <div className="doclist-grid">
          {Object.keys(groupedDocuments).map((category) => {
            const docs = groupedDocuments[category];
            const emoji = categoryEmojis[category] || "📁";

            return (
              <section key={category} className="doclist-category">
                <header className="doclist-category-header">
                  <span className="doclist-category-emoji">{emoji}</span>
                  <div>
                    <h4>{category}</h4>
                    <small>
                      {docs.length} file{docs.length > 1 ? "s" : ""}
                    </small>
                  </div>
                </header>

                <div className="doclist-items">
                  {docs.map((doc) => {
                    const fileCategory = getFileCategory(
                      doc.fileType,
                      doc.fileName
                    );
                    const preview = previewCache[doc.id];
                    const isHovered = hoveredDoc === doc.id;
console.log('🔍 Is Hovered:', isHovered, 'Doc ID:', doc.id, 'Hovered ID:', hoveredDoc);

                    return (
                      <div
                        key={doc.id}
                        className="doclist-item"
                        onMouseEnter={() => handleMouseEnter(doc)}
                        onMouseLeave={handleMouseLeave}
                      >
                        <div className="doclist-item-main">
                          <div className="doclist-icon">
                            {fileCategory === "image" ? (
                              <FiCamera />
                            ) : fileCategory === "pdf" ? (
                              <FiFileText />
                            ) : (
                              <FiFile />
                            )}
                          </div>
                          <div className="doclist-text">
                            <span className="doclist-name" title={doc.fileName}>
                              {doc.fileName}
                            </span>
                            <span className="doclist-meta">
                              {doc.fileType || "Unknown type"}
                            </span>
                          </div>
                        </div>

                        <div className="doclist-controls">
                          <select
                            className="doclist-select"
                            value={doc.category}
                            onChange={(e) =>
                              onChangeCategory(doc.id, e.target.value)
                            }
                          >
                            {documentCategories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>

                          <div className="doclist-actions">
                            <button
                              type="button"
                              className="doclist-btn doclist-btn-primary"
                              title="View"
                              onClick={() => onView(doc)}
                            >
                              <FiEye />
                            </button>
                            <button
                              type="button"
                              className="doclist-btn doclist-btn-danger"
                              title="Delete"
                              onClick={() => onDelete(doc.id, doc.fileName)}
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </div>

                        {/* 🖼️ UNIVERSAL FILE PREVIEW TOOLTIP */}
    {isHovered && preview ? (
      <div className="doclist-preview-tooltip">
        {renderPreviewContent(preview)}
      </div>
    ) : isHovered && !preview ? (
      <div className="doclist-preview-tooltip">
        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
          Loading preview...
        </div>
      </div>
    ) : null}
  </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DocumentList;
