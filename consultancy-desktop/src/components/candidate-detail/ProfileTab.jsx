import React from "react";

const row = {
  display: "grid",
  gridTemplateColumns: "180px 1fr",
  gap: "6px",
  marginBottom: "10px",
  fontSize: "13px"
};
const label = { color: "var(--text-secondary)" };
const value = { color: "var(--text-primary)", fontWeight: 500 };

const PersonalInfoTab = ({ data = {} }) => {
  return (
    <div
      style={{
        padding: "16px 20px 10px",
        background: "var(--card-bg)",
        borderRadius: "10px",
        border: "1px solid var(--border-color)"
      }}
    >
      <div style={row}>
        <span style={label}>Full Name</span>
        <span style={value}>{data.name || "-"}</span>
      </div>
      <div style={row}>
        <span style={label}>Email</span>
        <span style={value}>{data.email || "-"}</span>
      </div>
      <div style={row}>
        <span style={label}>Phone</span>
        <span style={value}>{data.contact || data.phone || "-"}</span>
      </div>
      <div style={row}>
        <span style={label}>Location</span>
        <span style={value}>{data.city || data.location || "-"}</span>
      </div>
      <div style={row}>
        <span style={label}>Gender</span>
        <span style={value}>{data.gender || "-"}</span>
      </div>
      <div style={row}>
        <span style={label}>Date of Birth</span>
        <span style={value}>{data.dob || "-"}</span>
      </div>
      <div style={row}>
        <span style={label}>Education</span>
        <span style={value}>{data.education || "-"}</span>
      </div>
      <div style={row}>
        <span style={label}>Experience (years)</span>
        <span style={value}>{data.experience || "-"}</span>
      </div>
      <div style={row}>
        <span style={label}>Aadhar Number</span>
        <span style={value}>{data.aadhar || "-"}</span>
      </div>
      <div style={row}>
        <span style={label}>Notes</span>
        <span style={{ ...value, whiteSpace: "pre-wrap", fontWeight: 400 }}>
          {data.notes || "-"}
        </span>
      </div>
    </div>
  );
};

export default PersonalInfoTab;
