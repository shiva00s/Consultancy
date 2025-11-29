import React from "react";

const CandidateHeader = ({ candidate, documents = [] }) => {
  const safeDocs = Array.isArray(documents) ? documents : [];

  // find first photograph document
  const photoDoc =
    safeDocs.find(
      (d) =>
        (d.category && d.category.toLowerCase() === "photograph") ||
        (d.document_type && d.document_type.toLowerCase() === "photograph") ||
        (d.document_name && d.document_name.toLowerCase().includes("photo"))
    ) || null;

  // if your backend gives a path like doc.path or doc.url, use that
  const photoUrl = photoDoc?.url || photoDoc?.path || null;

  return (
    <div
      style={{
        display: "flex",
        gap: "20px",
        marginBottom: "24px",
        padding: "20px",
        borderRadius: "10px",
        background: "var(--card-bg)",
        border: "1px solid var(--border-color)"
      }}
    >
      <div
        style={{
          width: "96px",
          height: "96px",
          borderRadius: "50%",
          background: "#444",
          overflow: "hidden",
          flexShrink: 0,
          border: "2px solid var(--border-color)"
        }}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Profile"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: 600,
              color: "var(--text-primary)"
            }}
          >
            {candidate.name || "-"}
          </h2>
          <span
            style={{
              fontSize: "12px",
              padding: "3px 8px",
              borderRadius: "999px",
              background: "var(--bg-secondary)",
              color: "var(--text-secondary)"
            }}
          >
            ID: #{candidate.id}
          </span>
        </div>
        <div
          style={{
            marginTop: "6px",
            fontSize: "13px",
            color: "var(--text-secondary)",
            display: "flex",
            gap: "16px",
            flexWrap: "wrap"
          }}
        >
          <span>
            <strong>Status:</strong> {candidate.status || "-"}
          </span>
          <span>
            <strong>Passport:</strong> {candidate.passportNo || "-"}
          </span>
          <span>
            <strong>Applied For:</strong> {candidate.Position || "-"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CandidateHeader;
