import React, { useState, useEffect, useCallback } from 'react';
import { FiMail, FiClock, FiCheckCircle, FiPhone, FiMessageSquare } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../LoadingSpinner';
import '../../css/EmailHistory.css'; // Reuse EmailHistory styles

const formatTimestamp = (isoString) => {
    if (!isoString) return 'N/A';
    // Attempts to parse ISO-like format and display locally
    const date = new Date(isoString.replace(' ', 'T') + 'Z'); 
    if (isNaN(date)) return isoString;
    return date.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
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
        toast.error(res.error || "Failed to load communication logs.");
      }
    } catch (error) {
      console.error('Error loading communication history:', error);
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    loadCommunicationHistory();
  }, [loadCommunicationHistory]);
  
  const getIcon = (type) => {
      if (type === 'WhatsApp') return <FiMessageSquare style={{ color: '#25D366' }} />;
      if (type === 'Call') return <FiPhone style={{ color: 'var(--primary-color)' }} />;
      if (type === 'Email') return <FiMail style={{ color: 'var(--warning-color)' }} />;
      return <FiClock />;
  };

  if (loading) {
    return (
      <div className="email-history-loading">
        <LoadingSpinner />
        <p>Loading communication history...</p>
      </div>
    );
  }

  return (
    <div className="email-history">
      <h4 className="history-title">
        <FiMail />
        Interaction Log ({logs.length})
      </h4>

      <div className="email-timeline">
        {logs.length === 0 ? (
            <div className="email-history-empty" style={{paddingTop: '2rem'}}>
                <FiMail style={{fontSize: '3rem', opacity: 0.5}} />
                <p>No interactions recorded yet.</p>
            </div>
        ) : (
            logs.map((log) => (
                <div key={log.id} className="email-item">
                    <div className="email-header">
                        <div className="email-status">
                            {getIcon(log.type)}
                        </div>

                        <div className="email-info" style={{flex: 1}}>
                            <h5 style={{fontWeight: 600}}>
                                {log.type} recorded by {log.username}
                            </h5>
                            <p style={{fontSize: '0.85rem'}}>{log.details}</p>
                            <div className="email-meta" style={{marginTop: '4px'}}>
                                <span className="email-date" style={{fontSize: '0.75rem'}}>
                                    <FiClock style={{fontSize: '0.85rem'}} />
                                    {formatTimestamp(log.timestamp)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
}

export default CommunicationHistory;