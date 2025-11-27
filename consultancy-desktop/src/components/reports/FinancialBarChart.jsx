import React from 'react';
import { FiBarChart2, FiAlertTriangle } from 'react-icons/fi';
import { formatCurrency } from '../../utils/format';
// NOTE: Recharts/Chart.js integration would go here. We use a mock component.

function FinancialBarChart({ data }) {
    if (data.length === 0) return (
        <p className="form-message neutral" style={{textAlign: 'center'}}><FiAlertTriangle /> No significant pending balances to chart.</p>
    );
    
    // Determine the highest pending balance for scaling the mock bars
    const maxBalance = Math.max(...data.map(item => item.pendingBalance));

    return (
        <div style={{ padding: '15px' }}>
            
            <div 
                style={{
                    width: '100%', 
                    height: '250px', 
                    border: '1px dashed var(--border-color)', 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-end',
                    padding: '10px',
                    borderRadius: 'var(--border-radius)',
                    backgroundColor: 'var(--bg-secondary)'
                }}
                title="Placeholder for Financial Bar Chart (Recharts/Chart.js)"
            >
                {data.map(item => {
                    const widthPercent = (item.pendingBalance / maxBalance) * 90; // Scale to max 90%
                    return (
                        <div key={item.name} style={{ width: '100%', marginBottom: '5px' }}>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                {item.name}: {formatCurrency(item.pendingBalance)}
                            </p>
                            <div 
                                style={{
                                    height: '10px', 
                                    width: `${widthPercent}%`, 
                                    backgroundColor: 'var(--danger-color)', 
                                    borderRadius: '5px'
                                }}
                            ></div>
                        </div>
                    );
                })}
            </div>

            <h4 style={{marginTop: '1.5rem', marginBottom: '0.75rem'}}>Top Pending Balances:</h4>
            <ul className="report-list">
                {data.map(item => (
                    <li key={item.name}>
                        <span>{item.name}</span>
                        <strong className="report-list-value danger-text">
                            {formatCurrency(item.pendingBalance)}
                        </strong>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default FinancialBarChart;