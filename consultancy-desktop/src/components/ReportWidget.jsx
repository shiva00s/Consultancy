import React from 'react';
import "../css/ReportWidget.css";


function ReportWidget({ icon, title, value, color }) {
  return (
    <div className={`report-widget-card ${color}`}>
      <div className="report-widget-icon">
        {icon}
      </div>
      <div className="report-widget-info">
        <p>{title}</p>
        <span>{value}</span>
      </div>
    </div>
  );
}

export default ReportWidget;