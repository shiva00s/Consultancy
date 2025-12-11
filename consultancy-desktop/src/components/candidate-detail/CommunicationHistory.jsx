import React, { useState, useEffect, useCallback } from 'react';
import { FiMail, FiClock, FiPhone, FiMessageSquare } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../LoadingSpinner';
import '../../css/EmailHistory.css'; // Reuse EmailHistory styles

const formatTimestamp = (isoString) => {
  if (!isoString) return 'N/A';
  // Attempts to parse ISO-like format and display locally
  const date = new Date(isoString.replace(' ', 'T') + 'Z');
  if (isNaN(date)) return isoString;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

function CommunicationHistory({ candidateId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCommunicationHistory = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch communication logs (WhatsApp, Calls, Emails via logCommunication handler)
      const res = await window.electronAPI.getCommLogs({ candidateId });
      if (res.success) {
        setLogs(res.data);
      } else {
        toast.error(res.error || 'Failed to load communication logs.');
      }
    } catch (error) {
      console.error('Error loading communication history:', error);
      toast.error('Error loading communication history.');
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    loadCommunicationHistory();
  }, [loadCommunicationHistory]);

  const getIcon = (type) => {
    if (type === 'WhatsApp') return <FiMessageSquare className="comm-icon whatsapp" />;
    if (type === 'Call') return <FiPhone className="comm-icon call" />;
    if (type === 'Email') return <FiMail className="comm-icon email" />;
    return <FiMessageSquare className="comm-icon" />;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <LoadingSpinner />
        <p>Loading communication history...</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="empty-state">
        <FiClock size={48} style={{ color: '#ccc' }} />
        <p>No interactions recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="email-history-container">
      <div className="email-history-list">
        {logs.map((log) => (
          <div key={log.id} className="email-history-item">
            <div className="email-item-header">
              <div className="comm-type-indicator">
                {getIcon(log.communication_type)}
                <strong>{log.communication_type}</strong>
              </div>
              <span className="email-date">{formatTimestamp(log.logged_at)}</span>
            </div>
            <div className="email-item-body">
              <p className="comm-details">{log.details}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CommunicationHistory;
