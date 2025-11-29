import React from "react";

const chip = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  margin: "4px",
  borderRadius: "999px",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  fontSize: "12px"
};

const SkillsTab = ({ data = [] }) => {
  const skills = Array.isArray(data) ? data : [];

  if (!skills.length) {
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
        No skills added for this candidate.
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "16px 20px",
        background: "var(--card-bg)",
        borderRadius: "10px",
        border: "1px solid var(--border-color)"
      }}
    >
      {skills.map((s, i) => {
        const name = typeof s === "string" ? s : s.name || s.skill || "";
        if (!name) return null;
        return (
          <span key={i} style={chip}>
            {name}
          </span>
        );
      })}
    </div>
  );
};

export default SkillsTab;
