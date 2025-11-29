import React from "react";
import { FiUser, FiArrowLeft } from "react-icons/fi";

const CandidateHeaderBar = ({ candidate, formData, onBack }) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
        paddingBottom: "15px",
        borderBottom: "1px solid var(--border-color)"
      }}
    >
      <button
        onClick={onBack}
        className="btn btn-secondary back-button"
        style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: "8px" }}
      >
        <FiArrowLeft /> Back to Search
      </button>

      <div style={{ textAlign: "right" }}>
        <h1
          style={{
            margin: "0 0 5px 0",
            fontSize: "1.8rem",
            color: "var(--text-primary)"
          }}
        >
          <FiUser style={{ marginRight: "10px", verticalAlign: "middle" }} />
          {formData?.name || candidate.name}
        </h1>
        <div
          style={{
            display: "flex",
            gap: "15px",
            justifyContent: "flex-end",
            fontSize: "0.9rem",
            color: "var(--text-secondary)"
          }}
        >
          <span>
            <strong>ID:</strong> #{candidate.id}
          </span>
          <span>
            <strong>Passport:</strong> {formData?.passportNo || candidate.passportNo}
          </span>
          <span
            className="badge neutral"
            style={{
              padding: "2px 8px",
              borderRadius: "4px",
              background: "var(--bg-secondary)"
            }}
          >
            {formData?.status || candidate.status}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CandidateHeaderBar;
