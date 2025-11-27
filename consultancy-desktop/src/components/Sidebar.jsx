import React from "react";
import { FEATURES } from "../config/permissions";
import { canView } from "../utils/role";

export default function Sidebar({ role }) {
  return (
    <div className="sidebar">
      {Object.keys(FEATURES).map((key) =>
        canView(role, key) && (
          <div key={key} className="menu-item">{FEATURES[key]}</div>
        )
      )}
    </div>
  );
}
