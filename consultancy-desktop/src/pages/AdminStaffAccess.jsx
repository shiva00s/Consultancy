import React, { useState } from "react";
import { FEATURES, ADMIN_ALLOWED, STAFF_ALLOWED } from "../config/permissions";

export default function AdminStaffAccess() {
  const allowedByAdmin = Object.keys(ADMIN_ALLOWED).filter(k => ADMIN_ALLOWED[k]);
  const [state, setState] = useState(STAFF_ALLOWED);

  const toggle = (key) => {
    if (!ADMIN_ALLOWED[key]) return;

    const updated = { ...state, [key]: !state[key] };
    setState(updated);
    localStorage.setItem("STAFF_ALLOWED", JSON.stringify(updated));
  };

  return (
    <div className="p-4">
      <h2>Staff Access</h2>

      {allowedByAdmin.map((f) => (
        <div key={f} className="flex items-center gap-2 py-2">
          <input type="checkbox" checked={state[f] || false} onChange={() => toggle(f)} />
          <label>{FEATURES[f]}</label>
        </div>
      ))}
    </div>
  );
}
