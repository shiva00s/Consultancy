import React, { useState, useEffect, useCallback } from 'react';
import { FiMail, FiClock, FiPhone, FiMessageSquare, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../LoadingSpinner';
import '../../css/EmailHistory.css';

const formatTimestamp = (isoString) => {
  if (!isoString) return 'N/A';
  try {
    // Handle both ISO format and SQLite datetime format
    const date = new Date(isoString.replace(' ', 'T'));
    if (isNaN(date.getTime())) return isoString;
    
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (err) {
    console.error('Date parsing error:', err);
    return isoString;
  }
};

function CommunicationHistory({ candidateId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCommunicationHistory = useCallback(async () => {
    setLoading(true);
    try {
      console.log('📞 Fetching communication logs for candidate:', candidateId);
      const res = await window.electronAPI.getCommLogs({ candidateId });
      console.log('✅ Communication logs response:', res);
      
      if (res.success) {
        setLogs(res.data || []);
      } else {
        console.error('❌ Failed to load logs:', res.error);
        toast.error(res.error || 'Failed to load communication logs.');
      }
    } catch (error) {
      console.error('❌ Error loading communication history:', error);
      toast.error('Error loading communication history.');
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    loadCommunicationHistory();
  }, [loadCommunicationHistory]);

  const getIcon = (type) => {
    const iconProps = { size: 20, style: { marginRight: '8px' } };
    
    if (type === 'WhatsApp') {
      return <FiMessageSquare {...iconProps} style={{ ...iconProps.style, color: '#25D366' }} />;
    }
    if (type === 'Call') {
      return <FiPhone {...iconProps} style={{ ...iconProps.style, color: '#2196F3' }} />;
    }
    if (type === 'Email') {
      return <FiMail {...iconProps} style={{ ...iconProps.style, color: '#EA4335' }} />;
    }
    return <FiMessageSquare {...iconProps} />;
  };

  const getTypeClass = (type) => {
    if (type === 'WhatsApp') return 'comm-type-whatsapp';
    if (type === 'Call') return 'comm-type-call';
    if (type === 'Email') return 'comm-type-email';
    return 'comm-type-other';
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ padding: '40px', textAlign: 'center' }}>
        <LoadingSpinner />
        <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>
          Loading communication history...
        </p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="empty-state" style={{ 
        padding: '60px 20px', 
        textAlign: 'center',
        color: 'var(--text-secondary)'
      }}>
        <FiClock size={48} style={{ color: '#ccc', marginBottom: '16px' }} />
        <h3 style={{ marginBottom: '8px', fontWeight: 500 }}>No interactions recorded yet</h3>
        <p style={{ fontSize: '14px' }}>
          WhatsApp messages, calls, and emails will appear here once logged.
        </p>
        <button 
          onClick={loadCommunicationHistory}
          style={{
            marginTop: '20px',
            padding: '8px 16px',
            background: 'var(--primary-color)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FiRefreshCw size={16} />
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="email-history-container">
      <div className="email-history-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px',
        padding: '0 8px'
      }}>
        <h3 style={{ margin: 0, fontSize: '18px' }}>
          Communication History ({logs.length})
        </h3>
        <button 
          onClick={loadCommunicationHistory}
          className="icon-btn"
          title="Refresh"
          style={{ padding: '8px' }}
        >
          <FiRefreshCw size={18} />
        </button>
      </div>

      <div className="email-history-list">
        {logs.map((log) => (
          <div key={log.id} className={`email-history-item ${getTypeClass(log.communication_type)}`}>
            <div className="email-item-header">
              <div className="comm-type-indicator" style={{ 
                display: 'flex', 
                alignItems: 'center',
                fontWeight: 500
              }}>
                {getIcon(log.communication_type)}
                <span>{log.communication_type || 'Communication'}</span>
              </div>
              <span className="email-date" style={{ 
                fontSize: '13px',
                color: 'var(--text-secondary)'
              }}>
                {formatTimestamp(log.logged_at)}
              </span>
            </div>
            <div className="email-item-body" style={{ paddingLeft: '28px' }}>
              <p className="comm-details" style={{ 
                margin: 0,
                fontSize: '14px',
                lineHeight: '1.5',
                color: 'var(--text-primary)'
              }}>
                {log.details || 'No details provided'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CommunicationHistory;
