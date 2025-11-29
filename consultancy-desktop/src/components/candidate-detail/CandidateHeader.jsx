import React from "react";

const CandidateHeader = ({ candidate, documents = [] }) => {
  const safeDocs = Array.isArray(documents) ? documents : [];

  // pick first photo-type document
  const photoDoc =
    safeDocs.find(
      (d) =>
        (d.category && d.category.toLowerCase() === "photograph") ||
        (d.document_type && d.document_type.toLowerCase() === "photograph") ||
        (d.document_name && d.document_name.toLowerCase().includes("photo"))
    ) || null;

  // backend should expose a URL or we build it; adjust if you have a real URL field
  const photoUrl = photoDoc?.previewUrl || photoDoc?.url || null;

  return (
    <div
      className="candidate-header"
      style={{
        display: "flex",
        gap: "20px",
        marginBottom: "30px",
        padding: "20px",
        borderBottom: "2px solid var(--border-color)",
        maxWidth: "1300px"
      }}
    >
      <div
        className="avatar"
        style={{
          width: "100px",
          height: "100px",
          borderRadius: "50%",
          background: "#ddd",
          overflow: "hidden",
          flexShrink: 0
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

      <div className="info" style={{ flex: 1 }}>
        <h1
          style={{
            margin: 0,
            fontSize: "28px",
            color: "var(--text-primary)"
          }}
        >
          {candidate.name || candidate.fullName || "-"}
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "16px",
            marginTop: "8px"
          }}
        >
          {candidate.status || "Status N/A"} | ID: {candidate.id}
        </p>
      </div>

      <div
        className="actions"
        style={{ display: "flex", gap: "10px", alignItems: "center" }}
      >
        <button style={{ padding: "10px 20px", borderRadius: "6px" }}>
          Edit
        </button>
        <button
          style={{
            padding: "10px 20px",
            borderRadius: "6px",
            background: "var(--danger)",
            color: "#fff",
            border: "none"
          }}
        >
          Archive
        </button>
      </div>
    </div>
  );
};

export default CandidateHeader;
