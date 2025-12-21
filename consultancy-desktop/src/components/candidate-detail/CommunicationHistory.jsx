import React, { useState, useEffect, useCallback } from 'react';
import { FiMail, FiClock, FiPhone, FiMessageSquare, FiRefreshCw, FiUser } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../LoadingSpinner';
import '../../css/CommunicationHistory.css';

const formatTimestamp = (isoString) => {
  if (!isoString) return 'N/A';
  try {
    // Treat database timestamps as local timestamps (avoid forcing timezone conversion)
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
  const [attachmentUrls, setAttachmentUrls] = useState({});

  const loadCommunicationHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getCommunicationLogs({ candidateId });
      if (res.success) {
        setLogs(res.data || []);
      } else {
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

  // Build preview URLs for attachments if needed
  useEffect(() => {
    let cancelled = false;
    const fetchUrls = async () => {
      const map = {};
      for (const log of logs) {
        if (!log.attachments || log.attachments.length === 0) continue;
        map[log.id] = [];
        for (const att of log.attachments) {
          try {
            if (att.url) {
              map[log.id].push({ ...att, url: att.url });
            } else {
              // Support multiple path keys that may exist due to inconsistent naming
              const candidatePath = att.path || att.filePath || att.file_path || att.filepath;
              if (candidatePath) {
                const res = await window.electronAPI.getFileUrl({ path: candidatePath });
                if (res && res.success && !cancelled) {
                  map[log.id].push({ ...att, url: res.fileUrl || res.data || null });
                } else if (!cancelled) {
                  map[log.id].push({ ...att, path: candidatePath });
                }
              } else {
                map[log.id].push(att);
              }
            }
          } catch (err) {
            console.error('Error fetching attachment url:', err);
            map[log.id].push(att);
          }
        }
      }
      if (!cancelled) setAttachmentUrls(map);
    };
    fetchUrls();
    return () => { cancelled = true; };
  }, [logs]);

  const getIcon = (type) => {
    if (type === 'WhatsApp') return <FiMessageSquare />;
    if (type === 'Call') return <FiPhone />;
    if (type === 'Email') return <FiMail />;
    return <FiMessageSquare />;
  };

  const getTypeClass = (type) => {
    if (type === 'WhatsApp') return 'comm-type-whatsapp';
    if (type === 'Call') return 'comm-type-call';
    if (type === 'Email') return 'comm-type-email';
    return 'comm-type-other';
  };

  if (loading) {
    return (
      <div className="communication-loading-container">
        <LoadingSpinner />
        <p style={{ marginTop: '16px' }}>Loading communication history...</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="communication-empty-state">
        <FiClock size={48} />
        <h3>No interactions recorded yet</h3>
        <p>WhatsApp messages, calls, and emails will appear here once logged.</p>
        <button onClick={loadCommunicationHistory} className="communication-refresh-btn">
          <FiRefreshCw size={16} />
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="communication-history-container">
      <div className="communication-history-header">
        <h3>Communication History ({logs.length})</h3>
        <button 
          onClick={loadCommunicationHistory} 
          className="communication-refresh-btn" 
          title="Refresh"
          aria-label="Refresh communication history"
        >
          <FiRefreshCw size={20} />
        </button>
      </div>

      <ul className="communication-timeline-list">
  {logs.map((log, index) => (
    <li
      key={log.id}
      className={`communication-timeline-item ${getTypeClass(log.communication_type)}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="communication-timeline-icon">
        {getIcon(log.communication_type)}
      </div>

      <div className="communication-timeline-content">
        <div className="communication-timeline-header">
          <strong>{log.communication_type || 'Communication'}</strong>
          {log.username && (
            <div className="communication-timeline-user">
              <FiUser size={14} />
              {log.username}
            </div>
          )}
        </div>
                {log.metadata && log.metadata.subject && (
                  <div className="communication-timeline-subject">
                    <strong>Subject:</strong> {log.metadata.subject}
                  </div>
                )}
                {log.metadata && log.metadata.reason && (
                  <div className="communication-timeline-reason">
                    <em>Reason:</em> {log.metadata.reason}
                  </div>
                )}
                <p className="communication-timeline-details">
                  {log.details || 'No details provided'}
                </p>
              <div className="communication-timeline-timestamp">
                <FiClock size={14} />
                {formatTimestamp(log.createdAt)}
              </div>
              {log.attachments && log.attachments.length > 0 && (
                <div className="communication-attachments">
                  {((attachmentUrls[log.id] && attachmentUrls[log.id].length > 0)
                    ? attachmentUrls[log.id]
                    : log.attachments
                  ).map((att, i) => (
                    <div key={i} className="comm-attachment-item">
                      {att.url && /\.(png|jpe?g|gif|webp)$/i.test(att.originalName || att.name || '') ? (
                        <img src={att.url} alt={att.name || att.originalName || 'attachment'} style={{ maxWidth: 160, maxHeight: 160, borderRadius: 6 }} />
                      ) : (
                        <a href={att.url || att.path || '#'} target="_blank" rel="noreferrer">
                          {att.name || att.originalName || 'attachment'}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default CommunicationHistory;