import React, { useMemo } from "react";
import "../../css/DocumentChecker.css";
import { FiAlertTriangle, FiCheckCircle } from "react-icons/fi";

const mandatoryCategories = [
  "Aadhar Card",
  "Education Certificate",
  "Offer Letter",
  "Pan Card",
  "Visa",
];

function DocumentChecker({ candidateDocuments }) {
  const { uploadedCategories, missingMandatory } = useMemo(() => {
    const uploadedSet = new Set(
      (candidateDocuments || [])
        .map((d) => d.category || "Uncategorized")
        .filter(Boolean)
    );

    const missing = mandatoryCategories.filter((cat) => !uploadedSet.has(cat));

    return {
      uploadedCategories: Array.from(uploadedSet),
      missingMandatory: missing,
    };
  }, [candidateDocuments]);

  const hasMissing = missingMandatory.length > 0;

  return (
    <div className="dchk-card">
      <header className="dchk-header">
        <div className="dchk-title">
          <span className="dchk-emoji">📊</span>
          <div>
            <h3>Document Status Check</h3>
            <p>Instant overview of mandatory and uploaded categories.</p>
          </div>
        </div>
      </header>

      <div
        className={
          hasMissing
            ? "dchk-banner dchk-banner-danger"
            : "dchk-banner dchk-banner-ok"
        }
      >
        {hasMissing ? (
          <>
            <FiAlertTriangle />
            <span>
              {missingMandatory.length} mandatory document
              {missingMandatory.length > 1 ? "s are" : " is"} missing
            </span>
          </>
        ) : (
          <>
            <FiCheckCircle />
            <span>All mandatory documents are present 🎉</span>
          </>
        )}
      </div>

      <div className="dchk-grid">
        <section className="dchk-col">
          <h4>Missing Mandatory Documents</h4>
          {hasMissing ? (
            <ul className="dchk-list">
              {missingMandatory.map((cat) => (
                <li key={cat}>• {cat}</li>
              ))}
            </ul>
          ) : (
            <p className="dchk-none">No missing items. Great job!</p>
          )}
        </section>

        <section className="dchk-col">
          <h4>Uploaded Categories</h4>
          {uploadedCategories.length === 0 ? (
            <p className="dchk-none">
              No uploads yet. Start by adding documents on the right ➡️
            </p>
          ) : (
            <p className="dchk-cats">
              {uploadedCategories.join(" | ")}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export default DocumentChecker;
