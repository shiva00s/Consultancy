import React from 'react';
import { FiPieChart, FiAlertTriangle } from 'react-icons/fi';
// NOTE: Recharts/Chart.js integration would go here. We use a mock component.

const getColor = (status) => {
    // Read theme variables from :root at runtime so charts follow current theme.
    // We intentionally do not include hardcoded hex fallbacks here so the
    // chart strictly follows app theme variables (ensure `--*` vars are defined).
    const root = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const primary = root ? root.getPropertyValue('--primary-color').trim() : '';
    const warning = root ? root.getPropertyValue('--warning-color').trim() : '';
    const purple = root ? root.getPropertyValue('--purple-color').trim() : '';
    const cyan = root ? root.getPropertyValue('--cyan-color').trim() : '';
    const success = root ? root.getPropertyValue('--success-color').trim() : '';
    const danger = root ? root.getPropertyValue('--danger-color').trim() : '';
    const grey = root ? root.getPropertyValue('--secondary-color').trim() : '';

    switch (status) {
        case 'New': return primary || '';
        case 'Documents Collected': return warning || '';
        case 'Visa Applied': return purple || '';
        case 'In Progress': return cyan || '';
        case 'Completed': return success || '';
        case 'Rejected': return danger || '';
        default: return grey || '';
    }
};

function StatusPieChart({ data }) {
    const total = data.reduce((sum, item) => sum + item.count, 0);

    if (total === 0) return (
        <p className="form-message neutral" style={{textAlign: 'center'}}><FiAlertTriangle /> No candidate data available for charting.</p>
    );

    return (
        <div style={{ padding: '15px' }}>
            {/* Mock Visualization Area */}
            <div 
                style={{
                    width: '100%', 
                    height: '250px', 
                    border: '1px dashed var(--border-color)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    borderRadius: 'var(--border-radius)',
                    backgroundColor: 'var(--bg-secondary)'
                }}
                title="Placeholder for Status Pie Chart (Recharts/Chart.js)"
            >
                <FiPieChart style={{fontSize: '3rem', color: 'var(--primary-color)'}}/>
            </div>
            
            <h4 style={{marginTop: '1.5rem', marginBottom: '0.75rem'}}>Status Distribution:</h4>
            <ul className="report-list">
                {data.map(item => {
                    const percentage = total > 0 ? ((item.count / total) * 100).toFixed(1) : 0;
                    return (
                        <li key={item.status} style={{borderLeft: `4px solid ${getColor(item.status)}`}}>
                            <span>{item.status || 'N/A'}</span>
                            <strong className="report-list-value">
                                {item.count} ({percentage}%)
                            </strong>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default StatusPieChart;