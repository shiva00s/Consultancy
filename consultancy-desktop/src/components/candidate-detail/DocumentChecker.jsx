import React from "react";

const DocumentChecker = ({ candidateId, documents = [] }) => {
  const safeDocs = Array.isArray(documents) ? documents : [];

  // whatever logic you already have, just use safeDocs instead of documents
  // Example simple version:

  if (safeDocs.length === 0) {
    return (
      <div style={{ padding: "12px", fontSize: "14px", color: "var(--text-secondary)" }}>
        No documents available for checks.
      </div>
    );
  }

  return (
    <div style={{ padding: "12px", fontSize: "14px" }}>
      {/* Replace with your real checks */}
      {safeDocs.map((doc) => (
        <div key={doc.id}>{doc.document_name || doc.fileName}</div>
      ))}
    </div>
  );
};

export default DocumentChecker;
