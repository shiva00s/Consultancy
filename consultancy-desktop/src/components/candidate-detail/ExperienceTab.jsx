import React from "react";

const card = {
  padding: "12px 14px",
  borderRadius: "10px",
  background: "var(--card-bg)",
  border: "1px solid var(--border-color)",
  marginBottom: "10px"
};
const title = { fontWeight: 600, color: "var(--text-primary)", fontSize: "14px" };
const sub = { fontSize: "12px", color: "var(--text-secondary)" };
const desc = { marginTop: "6px", fontSize: "12px", color: "var(--text-primary)" };

const ExperienceTab = ({ data = [] }) => {
  const items = Array.isArray(data) ? data : [];

  if (!items.length) {
    return (
      <div
        style={{
          padding: "16px 20px",
          background: "var(--card-bg)",
          borderRadius: "10px",
          border: "1px solid var(--border-color)",
          fontSize: "13px",
          color: "var(--text-secondary)"
        }}
      >
        No experience records for this candidate.
      </div>
    );
  }

  return (
    <div>
      {items.map((exp, idx) => (
        <div key={idx} style={card}>
          <div style={title}>{exp.role || exp.title || "-"}</div>
          <div style={sub}>
            {exp.company || "-"} • {exp.from || exp.start_date || ""}{" "}
            {exp.to || exp.end_date ? ` - ${exp.to || exp.end_date}` : ""}
          </div>
          {exp.description && <div style={desc}>{exp.description}</div>}
        </div>
      ))}
    </div>
  );
};

export default ExperienceTab;
