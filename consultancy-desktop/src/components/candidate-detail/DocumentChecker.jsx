import React, { useEffect, useMemo, useState } from "react";
import "../../css/DocumentChecker.css";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiRefreshCw,
} from "react-icons/fi";

/* ===============================
   🧠 CATEGORY → EMOJI MAP
   =============================== */
const emojiMap = {
  "Aadhar Card": "🆔",
  "Pan Card": "💳",
  "Passport": "🛂",
  "Visa": "✈️",
  "Education Certificate": "🎓",
  "Experience Letter": "💼",
  "Offer Letter": "📋",
  "Resume": "📄",
  "Photograph": "📸",
  "Medical Certificate": "🏥",
  "Driving License": "🚗",
  Uncategorized: "📂",
};

/* ===============================
   🔧 CLEAN CATEGORY NAME
   =============================== */
const cleanCategory = (value = "") =>
  value
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .trim();

/* ===============================
   MAIN COMPONENT
   =============================== */
function DocumentChecker({ candidateDocuments = [], user }) {
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* ===============================
     🔄 FETCH REQUIRED DOCS
     =============================== */
  const fetchRequiredDocs = async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getRequiredDocuments();
      if (res?.success) {
        setRequiredDocs(res.data || []);
      } else {
        setRequiredDocs([]);
      }
    } catch {
      setRequiredDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequiredDocs();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRequiredDocs();
    setRefreshing(false);
  };

  /* ===============================
     🧮 COMPUTED STATUS
     =============================== */
  const { uploadedSet, missingList } = useMemo(() => {
    const uploaded = new Set(
      candidateDocuments
        .map((d) => cleanCategory(d.category || "Uncategorized"))
        .filter(Boolean)
    );

    const required = requiredDocs.map((r) =>
      cleanCategory(r.name || "")
    );

    const missing = required.filter((r) => !uploaded.has(r));

    return {
      uploadedSet: uploaded,
      missingList: missing,
    };
  }, [candidateDocuments, requiredDocs]);

  const allDone =
    requiredDocs.length > 0 && missingList.length === 0;

  /* ===============================
     ⏳ LOADING STATE
     =============================== */
  if (loading) {
    return (
      <div className="dchk-card">
        <div className="dchk-header">
          <div className="dchk-title">
            <FiRefreshCw className="spin-animation" />
            <div>
              <h3>📋 Document Checker</h3>
              <p>⏳ Loading required documents…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ===============================
     🚫 NO REQUIREMENTS SET
     =============================== */
  if (requiredDocs.length === 0) {
    return (
      <div className="dchk-card">
        <div className="dchk-header">
          <div className="dchk-title">
            <span className="dchk-emoji">⚙️</span>
            <div>
              <h3>📋 Document Checker</h3>
              <p>
                No required documents configured yet
              </p>
            </div>
          </div>

          <button
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh"
          >
            <FiRefreshCw
              className={refreshing ? "spin-animation" : ""}
            />
          </button>
        </div>

        <div className="dchk-none">
          📂 Go to <strong>Document Requirement Manager</strong>{" "}
          and configure mandatory documents.
        </div>
      </div>
    );
  }

  /* ===============================
     ✅ MAIN RENDER
     =============================== */
  return (
    <div className="dchk-card">
      {/* HEADER */}
      <div className="dchk-header">
        <div className="dchk-title">
          <span className="dchk-emoji">🧠</span>
          <div>
            <h3>📋 Document Checker</h3>
            <p>
              Auto-validated against Requirement Manager
            </p>
          </div>
        </div>

        <button
          className="refresh-btn"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh"
        >
          <FiRefreshCw
            className={refreshing ? "spin-animation" : ""}
          />
        </button>
      </div>

      {/* STATUS BANNER */}
      {allDone ? (
        <div className="dchk-banner dchk-banner-ok">
          <FiCheckCircle />
          🎉 All required documents uploaded successfully!
        </div>
      ) : (
        <div className="dchk-banner dchk-banner-danger">
          <FiAlertTriangle />
          ⚠️ {missingList.length} required document(s)
          missing
        </div>
      )}

      {/* GRID */}
      <div className="dchk-grid">
        {/* REQUIRED */}
        <div className="dchk-col">
          <h4>📌 Required Documents</h4>
          <ul className="dchk-list">
            {requiredDocs.map((doc) => {
              const name = cleanCategory(doc.name);
              const emoji = emojiMap[name] || "📄";
              const isMissing = missingList.includes(name);

              return (
                <li
                  key={doc.id}
                  style={{
                    borderLeftColor: isMissing
                      ? "#ef4444"
                      : "#22c55e",
                  }}
                >
                  {emoji} {name}{" "}
                  {isMissing ? "❌" : "✅"}
                </li>
              );
            })}
          </ul>
        </div>

        {/* UPLOADED */}
        <div className="dchk-col">
          <h4>📤 Uploaded Categories</h4>

          {uploadedSet.size === 0 ? (
            <p className="dchk-none">
              📭 No documents uploaded yet
            </p>
          ) : (
            <div className="dchk-cats">
              {[...uploadedSet].map((cat) => (
                <div key={cat}>
                  {emojiMap[cat] || "📄"} {cat}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DocumentChecker;
