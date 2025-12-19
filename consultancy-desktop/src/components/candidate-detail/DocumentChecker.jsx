import React, { useState, useEffect, useMemo } from "react";
import "../../css/DocumentChecker.css";
import { FiAlertTriangle, FiCheckCircle, FiRefreshCw } from "react-icons/fi";

// Emoji mapping for all categories
const categoryEmojiMap = {
  "Aadhar Card": "🆔",
  "Driving License": "🚗",
  "Education Certificate": "🎓",
  "Experience Letter": "💼",
  "Medical": "🏥",
  "Medical Certificate": "🏥",
  "Offer Letter": "📋",
  "Pan Card": "💳",
  "Passport": "🛂",
  "Photograph": "📸",
  "Resume": "📄",
  "Travel": "✈️",
  "Uncategorized": "📂",
  "Visa": "✈️"
};

// Helper function to add emoji to category
const addEmojiToCategory = (category) => {
  const cleanCategory = cleanCategoryName(category);
  const emoji = categoryEmojiMap[cleanCategory] || "📄";
  return `${emoji} ${cleanCategory}`;
};

// 🔧 Robust emoji removal function
const cleanCategoryName = (category) => {
  if (!category) return "";
  return category
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .trim();
};

function DocumentChecker({ candidateDocuments, user }) {
  // ✅ DYNAMIC STATE - Fetch from DocumentRequirementManager
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ✅ FETCH REQUIRED DOCUMENTS DYNAMICALLY
  const fetchRequiredDocuments = async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getRequiredDocuments();
      if (res.success) {
        setRequiredDocs(res.data || []);
      } else {
        console.error("Failed to fetch requirements:", res.error);
        setRequiredDocs([]);
      }
    } catch (error) {
      console.error("Error fetching requirements:", error);
      setRequiredDocs([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FETCH ON MOUNT
  useEffect(() => {
    fetchRequiredDocuments();
  }, []);

  // ✅ REFRESH BUTTON HANDLER
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRequiredDocuments();
    setRefreshing(false);
  };

  // ✅ COMPUTE UPLOADED AND MISSING CATEGORIES
  const { uploadedCategories, missingMandatory } = useMemo(() => {
    const uploadedSet = new Set(
      (candidateDocuments || [])
        .map((d) => cleanCategoryName(d.category || "Uncategorized"))
        .filter(Boolean)
    );

    // Extract category names from required documents
    const mandatory = requiredDocs.map(doc => cleanCategoryName(doc.name));
    const missing = mandatory.filter((cat) => !uploadedSet.has(cat));

    return {
      uploadedCategories: Array.from(uploadedSet),
      missingMandatory: missing,
    };
  }, [candidateDocuments, requiredDocs]);

  const hasMissing = missingMandatory.length > 0;

  // ✅ LOADING STATE
  if (loading) {
    return (
      <div className="dchk-card">
        <div className="dchk-header">
          <div className="dchk-title">
            <FiRefreshCw className="spin-animation" />
            <div>
              <h3>📋 Document Checker</h3>
              <p>⏳ Loading requirements from manager...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ✅ NO REQUIREMENTS CONFIGURED YET
  if (requiredDocs.length === 0) {
    return (
      <div className="dchk-card">
        <div className="dchk-header">
          <div className="dchk-title">
            <span className="dchk-emoji">⚙️</span>
            <div>
              <h3>📋 Document Checker</h3>
              <p>⚡ Real-time validation against Document Requirement Manager</p>
            </div>
          </div>
          <button
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh requirements"
          >
            <FiRefreshCw className={refreshing ? "spin-animation" : ""} />
          </button>
        </div>
        
        <div className="empty-requirements-state">
          <p className="empty-icon">📂</p>
          <p className="empty-title">No Requirements Configured</p>
          <p className="empty-desc">
            Go to <strong>Document Requirement Manager</strong> tab to set up mandatory documents for candidates.
          </p>
        </div>
      </div>
    );
  }

  // ✅ MAIN CHECKER VIEW
  return (
    <div className="dchk-card">
      <div className="dchk-header">
        <div className="dchk-title">
          <span className="dchk-emoji">📋</span>
          <div>
            <h3>Document Checker</h3>
            <p>⚡ Instant overview of mandatory ({requiredDocs.length}) and uploaded categories</p>
          </div>
        </div>
        <button
          className="refresh-btn"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh requirements from manager"
        >
          <FiRefreshCw className={refreshing ? "spin-animation" : ""} />
        </button>
      </div>

      {/* ✅ STATUS BANNER */}
      <div className={`dchk-banner ${hasMissing ? "dchk-banner-danger" : "dchk-banner-ok"}`}>
        {hasMissing ? (
          <>
            <FiAlertTriangle />
            <span>⚠️ {missingMandatory.length} required document(s) missing</span>
          </>
        ) : (
          <>
            <FiCheckCircle />
            <span>✅ All {requiredDocs.length} required documents are uploaded!</span>
          </>
        )}
      </div>

      {/* ✅ GRID LAYOUT */}
      <div className="dchk-grid">
        {/* LEFT COLUMN - UPLOADED CATEGORIES */}
        <div className="dchk-col">
          <h4>✅ Uploaded Categories ({uploadedCategories.length})</h4>
          {uploadedCategories.length === 0 ? (
            <p className="dchk-none">
              📥 No uploads yet. Start by adding documents below ⬇️
            </p>
          ) : (
            <p className="dchk-cats">
              {uploadedCategories.map(addEmojiToCategory).join(" • ")}
            </p>
          )}
        </div>

        {/* RIGHT COLUMN - MISSING MANDATORY */}
        <div className="dchk-col">
          <h4>
            {hasMissing
              ? `⚠️ Missing Mandatory (${missingMandatory.length}/${requiredDocs.length})`
              : `✅ All Required Complete (${requiredDocs.length}/${requiredDocs.length})`}
          </h4>
          {!hasMissing ? (
            <p className="dchk-none" style={{ borderColor: "#22c55e", color: "#86efac" }}>
              🎉 No missing items. Great job!
            </p>
          ) : (
            <ul className="dchk-list">
              {missingMandatory.map((cat) => (
                <li key={cat}>{addEmojiToCategory(cat)}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default DocumentChecker;
