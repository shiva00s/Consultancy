import React, { useMemo } from "react";
import "../../css/DocumentChecker.css";
import { FiAlertTriangle, FiCheckCircle } from "react-icons/fi";

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

// 🔧 NEW: More robust emoji removal function
const cleanCategoryName = (category) => {
  if (!category) return "";
  
  // Remove ALL emojis (complete Unicode ranges), trim whitespace, handle case
  return category
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '') // Extended emoji range
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Miscellaneous Symbols (includes ✈️)
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation selectors
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Miscellaneous Symbols and Pictographs
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map Symbols
    .trim();
};

const mandatoryCategories = [
  "Aadhar Card",
  "Education Certificate",
  "Offer Letter",
  "Pan Card",
  "Visa",
];

function DocumentChecker({ candidateDocuments }) {
  const { uploadedCategories, missingMandatory } = useMemo(() => {
    // 🔧 FIXED: Create set of cleaned category names for comparison
    const uploadedSet = new Set(
      (candidateDocuments || [])
        .map((d) => cleanCategoryName(d.category || "Uncategorized"))
        .filter(Boolean)
    );

    // 🔧 FIXED: Check missing using cleaned names
    const missing = mandatoryCategories.filter((cat) => {
      const cleanCat = cleanCategoryName(cat);
      return !uploadedSet.has(cleanCat);
    });

    return {
      uploadedCategories: Array.from(uploadedSet),
      missingMandatory: missing,
    };
  }, [candidateDocuments]);

  const hasMissing = missingMandatory.length > 0;

  return (
    <div className="dchk-card">
      {/* Header */}
      <div className="dchk-header">
        <div className="dchk-title">
          <div className="dchk-emoji">📋</div>
          <div>
            <h3>Document Status Check</h3>
            <p>Instant overview of mandatory and uploaded categories.</p>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {hasMissing ? (
        <div className="dchk-banner dchk-banner-danger">
          <FiAlertTriangle />
          <span>
            ⚠️ {missingMandatory.length} mandatory document{missingMandatory.length > 1 ? 's' : ''} {missingMandatory.length > 1 ? 'are' : 'is'} missing
          </span>
        </div>
      ) : (
        <div className="dchk-banner dchk-banner-ok">
          <FiCheckCircle />
          <span>✅ All mandatory documents uploaded!</span>
        </div>
      )}

      {/* Two Columns */}
      <div className="dchk-grid">
        {/* Missing Mandatory */}
        <div className="dchk-col">
          <h4>❌ Missing Mandatory Documents</h4>
          {missingMandatory.length === 0 ? (
            <p className="dchk-none">
              ✅ No missing items. Great job!
            </p>
          ) : (
            <ul className="dchk-list">
              {missingMandatory.map((cat) => (
                <li key={cat}>{addEmojiToCategory(cat)}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Uploaded Categories */}
        <div className="dchk-col">
          <h4>✅ Uploaded Categories</h4>
          {uploadedCategories.length === 0 ? (
            <p className="dchk-none">
              📥 No uploads yet. Start by adding documents below ⬇️
            </p>
          ) : (
            <div className="dchk-cats-grid">
              {uploadedCategories.map((cat) => (
                <span key={cat} className="dchk-cat-badge">
                  {addEmojiToCategory(cat)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DocumentChecker;
