import React, { useState, useEffect } from 'react';
import { FiClock, FiUser, FiEdit, FiPlus, FiTrash2, FiFileText } from 'react-icons/fi';
import '../../css/CandidateHistory.css'; // <-- 1. IMPORT THE NEW CSS FILE

// Helper to format the date and time (Fixed for UTC)
const formatTimestamp = (isoString) => {
  if (!isoString) return 'N/A';
  
  // SQLite stores as 'YYYY-MM-DD HH:MM:SS' (UTC). 
  // We replace space with 'T' and add 'Z' to force JS to treat it as UTC.
  let safeIso = isoString;
  if (!isoString.includes('T')) {
      safeIso = isoString.replace(' ', 'T') + 'Z';
  } else if (!isoString.endsWith('Z')) {
      safeIso = isoString + 'Z';
  }

  const date = new Date(safeIso);
  
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

// Helper to get an icon based on the action
const getActionIcon = (action) => {
  if (action.includes('delete')) return <FiTrash2 style={{ color: 'var(--danger-color)' }} />;
  if (action.includes('create') || action.includes('add') || action.includes('assign')) return <FiPlus style={{ color: 'var(--success-color)' }} />;
  if (action.includes('update') || action.includes('change')) return <FiEdit style={{ color: 'var(--primary-color)' }} />;
  return <FiFileText />;
};

function CandidateHistory({ candidateId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      
      const res = await window.electronAPI.getAuditLogForCandidate({ candidateId });
      
      if (res.success) {
        setHistory(res.data);
      } else {
        setError(res.error || 'Failed to fetch history.');
      }
      setLoading(false);
    };

    fetchHistory();
  }, [candidateId]);

  if (loading) return <p>Loading history...</p>;
  if (error) return <p style={{ color: 'var(--danger-color)' }}>Error: {error}</p>;

  return (
    <div className="history-timeline-container">
      {history.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          No history found for this candidate.
        </p>
      ) : (
        <ul className="timeline-list">
          {history.map((log) => (
            <li className="timeline-item" key={log.id}>
              <div className="timeline-icon">
                {getActionIcon(log.action)}
              </div>
              <div className="timeline-content">
                <div className="timeline-header">
                  <strong>{log.action.replace(/_/g, ' ')}</strong>
                  <span className="timeline-user">
                    <FiUser /> {log.username}
                  </span>
                </div>
                <p className="timeline-details">
                  {log.details || 'No details recorded.'}
                </p>
                <span className="timeline-timestamp">
                  <FiClock /> {formatTimestamp(log.timestamp)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* --- 2. THE <style> BLOCK IS NOW REMOVED --- */}
    </div>
  );
}

export default CandidateHistory;