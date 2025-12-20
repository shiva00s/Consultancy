import React, { useState } from "react";
import {
  FiFileText,
  FiCamera,
  FiTrash2,
  FiEye,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiEdit,
  FiSave,
  FiAlertCircle,
} from "react-icons/fi";
import "../css/DocumentList.css";
import ConfirmDialog from './common/ConfirmDialog';

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
  onRename,
}) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageCache, setImageCache] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [localNames, setLocalNames] = useState({});

  const hasDocuments =
    groupedDocuments && Object.keys(groupedDocuments).length > 0;

  // Get all images for gallery
  const getAllImages = () => {
    const images = [];
    if (!groupedDocuments) return images;
    
    Object.values(groupedDocuments).forEach((docs) => {
      docs.forEach((doc) => {
        if (doc.fileType?.startsWith("image/")) {
          images.push(doc);
        }
      });
    });
    return images;
  };

  const allImages = getAllImages();

  // Load image for gallery
  const loadImage = async (doc) => {
    if (imageCache[doc.id]) return imageCache[doc.id];

    try {
      const res = await window.electronAPI.getImageBase64({
        filePath: doc.filePath,
      });
      if (res.success) {
        setImageCache((prev) => ({ ...prev, [doc.id]: res.data }));
        return res.data;
      }
    } catch (error) {
      console.error("Error loading image:", error);
    }
    return null;
  };

  // Open gallery
  const openGallery = async (doc) => {
    const imageIndex = allImages.findIndex((img) => img.id === doc.id);
    if (imageIndex !== -1) {
      setCurrentImageIndex(imageIndex);
      await loadImage(doc);
      setGalleryOpen(true);
    } else {
      onView(doc); // Fallback to original view for non-images
    }
  };

  // Navigate gallery
  const navigateGallery = async (direction) => {
    const newIndex =
      direction === "next"
        ? (currentImageIndex + 1) % allImages.length
        : (currentImageIndex - 1 + allImages.length) % allImages.length;
    setCurrentImageIndex(newIndex);
    await loadImage(allImages[newIndex]);
  };

  // Close gallery on ESC
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (!galleryOpen) return;
      if (e.key === "Escape") setGalleryOpen(false);
      if (e.key === "ArrowRight") navigateGallery("next");
      if (e.key === "ArrowLeft") navigateGallery("prev");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [galleryOpen, currentImageIndex]);

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
                    const isImage = doc.fileType?.startsWith("image/");

                    return (
                      <div key={doc.id} className="doclist-item">
                        <div className="doclist-item-main">
                          <div className={`doclist-icon ${isImage ? 'is-image' : ''}`}>
                            {isImage ? <FiCamera /> : <FiFileText />}
                          </div>
                          <div className="doclist-text">
                            <span className="doclist-name" title={localNames[doc.id] || doc.fileName}>
                              {localNames[doc.id] || doc.fileName}
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
                              className="doclist-btn"
                              title="Rename"
                              onClick={() => {
                                setEditingId(doc.id);
                                setEditingValue(localNames[doc.id] || doc.fileName);
                              }}
                            >
                              <FiEdit />
                            </button>

                            <button
                              type="button"
                              className="doclist-btn doclist-btn-primary"
                              title={isImage ? "View in Gallery" : "View"}
                              onClick={() =>
                                isImage ? openGallery(doc) : onView(doc)
                              }
                            >
                              <FiEye />
                            </button>

                            <button
                              type="button"
                              className="doclist-btn doclist-btn-danger"
                              title="Delete"
                              onClick={() => {
                                setConfirmTarget({ id: doc.id, name: localNames[doc.id] || doc.fileName });
                                setConfirmOpen(true);
                              }}
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ✨ PREMIUM IMAGE GALLERY MODAL */}
      {galleryOpen && allImages.length > 0 && (
        <div className="gallery-overlay" onClick={() => setGalleryOpen(false)}>
          <div className="gallery-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="gallery-header">
              <div className="gallery-info">
                <h3>{allImages[currentImageIndex].fileName}</h3>
                <p>
                  {currentImageIndex + 1} of {allImages.length} images
                </p>
              </div>
              <button
                className="gallery-close"
                onClick={() => setGalleryOpen(false)}
              >
                <FiX size={24} />
              </button>
            </div>

            {/* Main Image */}
            <div className="gallery-content">
              {imageCache[allImages[currentImageIndex].id] ? (
                <img
                  src={imageCache[allImages[currentImageIndex].id]}
                  alt={allImages[currentImageIndex].fileName}
                  className="gallery-image"
                />
              ) : (
                <div className="gallery-loading">Loading image...</div>
              )}
            </div>

            {/* Navigation */}
            {allImages.length > 1 && (
              <>
                <button
                  className="gallery-nav gallery-nav-prev"
                  onClick={() => navigateGallery("prev")}
                >
                  <FiChevronLeft size={32} />
                </button>
                <button
                  className="gallery-nav gallery-nav-next"
                  onClick={() => navigateGallery("next")}
                >
                  <FiChevronRight size={32} />
                </button>
              </>
            )}

            {/* Thumbnail Strip */}
            <div className="gallery-thumbnails">
              {allImages.map((img, idx) => (
                <div
                  key={img.id}
                  className={`gallery-thumb ${
                    idx === currentImageIndex ? "active" : ""
                  }`}
                  onClick={async () => {
                    setCurrentImageIndex(idx);
                    await loadImage(img);
                  }}
                >
                  <FiCamera size={16} />
                  <span>{img.fileName.substring(0, 15)}...</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title={confirmTarget ? `Delete ${confirmTarget.name}?` : 'Delete Document?'}
        message={confirmTarget ? `Are you sure you want to permanently delete "${confirmTarget.name}"? This action cannot be undone. 🗑️` : 'Are you sure?'}
        isDanger={true}
        confirmText="Delete"
        cancelText="Cancel"
        confirmIcon="🗑️"
        cancelIcon="❌"
        onConfirm={async () => {
          if (confirmTarget) {
            await onDelete(confirmTarget.id, confirmTarget.name);
          }
          setConfirmOpen(false);
          setConfirmTarget(null);
        }}
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmTarget(null);
        }}
      />

      {/* Inline rename input overlay (keeps existing API intact) */}
      {editingId && (
        <div className="doclist-inline-edit" aria-hidden={false}>
          <div className="doclist-inline-box">
            <input
              type="text"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              className="doclist-inline-input"
            />
            <div className="doclist-inline-actions">
              <button
                className="doclist-btn doclist-btn-primary"
                onClick={async () => {
                  const id = editingId;
                  const newName = editingValue.trim();
                  if (onRename && typeof onRename === 'function') {
                    await onRename(id, newName);
                  } else {
                    // local only fallback
                    setLocalNames((prev) => ({ ...prev, [id]: newName }));
                  }
                  setEditingId(null);
                  setEditingValue('');
                }}
                title="Save"
              >
                <FiSave />
              </button>
              <button
                className="doclist-btn"
                onClick={() => {
                  setEditingId(null);
                  setEditingValue('');
                }}
                title="Cancel"
              >
                <FiX />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentList;