import React from "react";
import {
  FiFileText,
  FiCamera,
  FiTrash2,
  FiEye,
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
  const hasDocuments =
    groupedDocuments &&
    Object.keys(groupedDocuments).length > 0;

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
              <section
                key={category}
                className="doclist-category"
              >
                <header className="doclist-category-header">
                  <span className="doclist-category-emoji">
                    {emoji}
                  </span>
                  <div>
                    <h4>{category}</h4>
                    <small>
                      {docs.length} file
                      {docs.length > 1 ? "s" : ""}
                    </small>
                  </div>
                </header>

                <div className="doclist-items">
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      className="doclist-item"
                    >
                      <div className="doclist-item-main">
                        <div className="doclist-icon">
                          {doc.fileType?.startsWith("image/") ? (
                            <FiCamera />
                          ) : (
                            <FiFileText />
                          )}
                        </div>
                        <div className="doclist-text">
                          <span
                            className="doclist-name"
                            title={doc.fileName}
                          >
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
                            onChangeCategory(
                              doc.id,
                              e.target.value
                            )
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
                            onClick={() =>
                              onDelete(doc.id, doc.fileName)
                            }
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
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
