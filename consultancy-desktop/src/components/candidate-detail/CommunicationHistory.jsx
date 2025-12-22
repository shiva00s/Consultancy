import React, { useState, useEffect, useCallback } from 'react';
import { FiMail, FiClock, FiPhone, FiMessageSquare, FiRefreshCw, FiUser } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../LoadingSpinner';
import '../../css/CommunicationHistory.css';
import CommunicationLog from '../CommunicationLog.jsx';
import LazyRemoteImage from '../common/LazyRemoteImage.jsx';
import CommunicationDetailsModal from '../modals/CommunicationDetailsModal.jsx';

const formatTimestamp = (isoString) => {
  if (!isoString) return 'N/A';
  try {
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

function CommunicationHistory({ candidateId, user }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attachmentUrls, setAttachmentUrls] = useState({});
  const [whatsappConv, setWhatsappConv] = useState(null);
  const [whatsappMessages, setWhatsappMessages] = useState([]);
  const [richView, setRichView] = useState(false);
  const [detailsModal, setDetailsModal] = useState({ open: false, payload: null });

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

  // Load WhatsApp conversation & messages for this candidate (if any)
  useEffect(() => {
    let mounted = true;
    const loadWhatsapp = async () => {
      try {
        if (!candidateId || !window.electronAPI?.whatsapp?.getConversations) return;
        const convRes = await window.electronAPI.whatsapp.getConversations();
        if (!mounted) return;
        if (convRes && convRes.success) {
          const conv = (convRes.data || []).find(
            (c) => c.candidate_id === parseInt(candidateId)
          );
          if (conv) {
            setWhatsappConv(conv);
            try {
              const messagesRes = await window.electronAPI.whatsapp.getMessages(conv.id);
              if (messagesRes && messagesRes.success) {
                setWhatsappMessages(messagesRes.data || []);
              }
            } catch (e) {
              console.warn(
                'Could not load whatsapp messages for conv',
                conv.id,
                e && e.message
              );
            }
          } else {
            setWhatsappConv(null);
            setWhatsappMessages([]);
          }
        }
      } catch (err) {
        console.warn('Error loading whatsapp convs:', err);
      }
    };
    loadWhatsapp();
    return () => {
      mounted = false;
    };
  }, [candidateId]);

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
              const candidatePath =
                att.path || att.filePath || att.file_path || att.filepath;
              if (candidatePath) {
                const res = await window.electronAPI.getFileUrl({ path: candidatePath });
                if (res && res.success && !cancelled) {
                  map[log.id].push({
                    ...att,
                    url: res.fileUrl || res.data || null,
                  });
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
    return () => {
      cancelled = true;
    };
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

  const renderAvatar = (log) => {
    const src =
      (log.metadata && (log.metadata.photo_path || log.metadata.photoPath)) ||
      log.avatar ||
      null;
    if (!src) return null;
    return (
      <div className="comm-avatar-wrap">
        <LazyRemoteImage filePath={src} className="comm-avatar-img" />
      </div>
    );
  };

  const renderReactions = (log) => {
    if (!log.metadata) return null;
    const reactions = log.metadata.reactions || log.reaction || log.reactions;
    if (!reactions || reactions.length === 0) return null;
    try {
      const list = Array.isArray(reactions) ? reactions : JSON.parse(reactions);
      return (
        <div className="comm-reactions">
          {list.slice(0, 5).map((r, idx) => (
            <span key={idx} className="comm-reaction">
              {typeof r === 'string' ? r : r.emoji || ''}
            </span>
          ))}
        </div>
      );
    } catch (e) {
      return null;
    }
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
      {/* Header with compact controls */}
      <div className="communication-history-header">
        <h3>
          <span role="img" aria-label="sparkles">
            ✨
          </span>
          Communication Hub
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            ({logs.length} touchpoints)
          </span>
        </h3>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          

          
        </div>
      </div>

      {/* WhatsApp conversation summary */}
      {whatsappConv && (
        <div
          className="communication-whatsapp-summary"
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: 14,
            border: '1px solid var(--border-color)',
            background:
              'linear-gradient(135deg, rgba(16,185,129,0.08), var(--bg-secondary))',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            position: 'relative',
            overflow: 'hidden',
          }}
          
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.1,
              pointerEvents: 'none',
              background:
                'radial-gradient(circle at top left, #22c55e 0, transparent 55%)',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <h4
                style={{
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 15,
                }}
              >
                <span role="img" aria-label="whatsapp">
                  💬
                </span>
                WhatsApp Chat
              </h4>
              <span
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: 'rgba(15,23,42,0.2)',
                  color: 'var(--text-secondary)',
                }}
              >
                {whatsappConv.unread_count > 0
                  ? `${whatsappConv.unread_count} unread`
                  : 'All caught up ✅'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {whatsappConv.photo_base64 ? (
                <img
                  src={whatsappConv.photo_base64}
                  alt="photo"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    objectFit: 'cover',
                    boxShadow: '0 6px 18px rgba(15,118,110,0.4)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(15,23,42,0.6)',
                    color: '#22c55e',
                    fontSize: 24,
                  }}
                >
                  💬
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {whatsappConv.candidate_name || 'Contact'} —{' '}
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {whatsappConv.phone_number}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    marginTop: 3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  “{whatsappConv.last_message || 'No recent message'}”
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginTop: 8,
                    fontSize: 11,
                    color: 'var(--text-muted)',
                  }}
                >
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: 999,
                      background: 'rgba(15,23,42,0.4)',
                    }}
                  >
                    ⏱ Last: {formatTimestamp(whatsappConv.last_message_time)}
                  </span>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: 999,
                      background: 'rgba(15,23,42,0.35)',
                    }}
                  >
                    📅 Created: {formatTimestamp(whatsappConv.created_at)}
                  </span>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: 999,
                      background: 'rgba(15,23,42,0.3)',
                    }}
                  >
                    ♻ Updated: {formatTimestamp(whatsappConv.updated_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent WhatsApp messages as compact chat bubbles */}
          {whatsappMessages && whatsappMessages.length > 0 && (
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                marginTop: 4,
                paddingTop: 8,
                borderTop: '1px dashed rgba(15,23,42,0.3)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <strong style={{ fontSize: 13 }}>Recent messages</strong>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Showing latest {Math.min(5, whatsappMessages.length)}
                </span>
              </div>

              <div>
                {whatsappMessages
                  .slice(-5)
                 
                  .map((m) => {
                    const isOutbound = m.direction === 'outbound';
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          justifyContent: isOutbound ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '82%',
                            padding: 8,
                            borderRadius: 12,
                            border: '1px solid rgba(15,23,42,0.35)',
                            background: isOutbound
                              ? 'linear-gradient(135deg, #22c55e1a, #22c55e0a)'
                              : 'linear-gradient(135deg, rgba(15,23,42,0.7), rgba(15,23,42,0.5))',
                            color: 'var(--text-primary)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            boxShadow: isOutbound
                              ? '0 4px 12px rgba(34,197,94,0.25)'
                              : '0 4px 12px rgba(15,23,42,0.45)',
                            transform: 'translateY(0)',
                            transition: 'transform 0.2s ease',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 8,
                              alignItems: 'center',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: isOutbound ? '#22c55e' : '#e5e7eb',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {isOutbound ? '📤 Out' : '📥 In'}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatTimestamp(m.timestamp)}
                            </div>
                          </div>

                          {m.body && (
                            <div
                              style={{
                                fontSize: 13,
                                lineHeight: 1.4,
                                whiteSpace: 'pre-wrap',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {m.body}
                            </div>
                          )}

                          {m.attachments && m.attachments.length > 0 && (
                            <div
                              style={{
                                display: 'flex',
                                gap: 6,
                                marginTop: 4,
                                flexWrap: 'wrap',
                              }}
                            >
                              {m.attachments.map((a) => (
                                <div
                                  key={a.id}
                                  style={{
                                    textAlign: 'center',
                                    borderRadius: 10,
                                    overflow: 'hidden',
                                    background: 'rgba(15,23,42,0.7)',
                                  }}
                                >
                                  {a.url &&
                                  /\.(png|jpe?g|gif|webp)$/i.test(a.originalName || '') ? (
                                    <img
                                      src={a.url}
                                      alt={a.originalName || ''}
                                      style={{
                                        width: 120,
                                        height: 80,
                                        objectFit: 'cover',
                                        cursor: 'pointer',
                                        display: 'block',
                                      }}
                                      onClick={() => window.open(a.url, '_blank')}
                                    />
                                  ) : a.path ? (
                                    <div
                                      style={{
                                        width: 120,
                                        height: 80,
                                        cursor: 'pointer',
                                      }}
                                      onClick={async () => {
                                        const target = a.path;
                                        try {
                                          if (
                                            window.electronAPI &&
                                            typeof window.electronAPI.openFileExternally ===
                                              'function'
                                          ) {
                                            await window.electronAPI.openFileExternally({
                                              path: target,
                                            });
                                          } else if (
                                            window.electronAPI &&
                                            typeof window.electronAPI.getFileUrl === 'function'
                                          ) {
                                            const res =
                                              await window.electronAPI.getFileUrl({
                                                path: target,
                                              });
                                            const url = res?.fileUrl || res?.data || target;
                                            window.open(url, '_blank');
                                          } else {
                                            window.open(target, '_blank');
                                          }
                                        } catch (err) {
                                          console.error('Error opening attachment:', err);
                                        }
                                      }}
                                    >
                                      <LazyRemoteImage filePath={a.path} />
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        fontSize: 12,
                                        padding: 6,
                                        color: 'var(--text-secondary)',
                                      }}
                                    >
                                      {a.originalName || 'attachment'}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          <div
                            style={{
                              marginTop: 2,
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: 11,
                              color: 'var(--text-muted)',
                            }}
                          >
                            <span>{m.status ? `⚙ ${m.status}` : '⚙ n/a'}</span>
                            <span>
                              {m.from_number} → {m.to_number}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rich view uses CommunicationLog, compact chip otherwise removed for now */}
      {richView && (
        <div style={{ marginTop: 12 }}>
          <CommunicationLog
            candidateId={candidateId}
            user={user}
            whatsappConv={whatsappConv}
            whatsappMessages={whatsappMessages}
          />
        </div>
      )}

      {detailsModal.open && (
        <CommunicationDetailsModal
          payload={detailsModal.payload}
          onClose={() => setDetailsModal({ open: false, payload: null })}
        />
      )}
    </div>
  );
}

export default CommunicationHistory;
