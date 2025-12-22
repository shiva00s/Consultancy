import React, { useEffect, useState } from 'react';
import LazyRemoteImage from './common/LazyRemoteImage.jsx';
import CommunicationDetailsModal from './modals/CommunicationDetailsModal.jsx';
import './CommunicationLog.css';
import { FiPlus } from 'react-icons/fi';

function CommunicationLog({
  conversationId = null,
  candidateId = null,
  limit = 200,
  user = null,
}) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [detailsModal, setDetailsModal] = useState({ open: false, payload: null });
  const [emojiPickerFor, setEmojiPickerFor] = useState(null);

  const COMMON_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '😢', '🔥'];

  const addReactionLocal = (msgId, emoji) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const existing = Array.isArray(m.reactions)
          ? m.reactions.slice()
          : m.reactions
          ? JSON.parse(m.reactions || '[]')
          : [];
        existing.push(emoji);
        return { ...m, reactions: existing };
      })
    );
    setEmojiPickerFor(null);

    // Try to persist via IPC if available (non-blocking)
    try {
      if (window.electronAPI && typeof window.electronAPI.logCommunication === 'function') {
        const payload = {
          user: user || null,
          candidateId: candidateId || null,
          communication_type: 'reaction',
          details: `Reaction ${emoji} to message ${msgId}`,
          metadata: { messageId: msgId, emoji },
        };
        window.electronAPI.logCommunication(payload);
      }
    } catch (e) {
      /* ignore */
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    window.electronAPI
      .getCommunicationLogs({ conversationId, candidateId, limit })
      .then((res) => {
        if (!mounted) return;
        if (res && res.success) {
          setMessages(res.data || []);
        } else {
          setError(res && res.error ? res.error : 'Failed to load communication logs');
        }
      })
      .catch((err) => setError(err?.message || String(err)))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [conversationId, candidateId, limit]);

  const openDetails = (log, attachment = null) => {
    setDetailsModal({ open: true, payload: { log, attachment } });
  };

  const closeDetails = () => {
    setDetailsModal({ open: false, payload: null });
  };

  const formatTime = (ts) => {
    if (!ts) return 'N/A';
    try {
      const date = new Date(ts.replace(' ', 'T'));
      if (isNaN(date.getTime())) return ts;
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  const renderDirectionChip = (msg) => {
    const inbound = msg.direction === 'inbound' || msg.is_inbound;
    const label = inbound ? 'Inbound' : 'Outbound';
    const emoji = inbound ? '⬅️' : '➡️';
    return (
      <span className={`meta-chip meta-chip-${inbound ? 'in' : 'out'}`}>
        {emoji} {label}
      </span>
    );
  };

  const getChannelEmoji = (msg) => {
    const type = (msg.channel || msg.type || '').toLowerCase();
    if (type.includes('whatsapp')) return '🟢';
    if (type.includes('call')) return '📞';
    if (type.includes('sms') || type.includes('text')) return '💬';
    if (type.includes('email')) return '📧';
    if (type.includes('meeting')) return '📅';
    return '📡';
  };

  if (loading) {
    return <div className="comm-log comm-log-loading">⏳ Loading communication log...</div>;
  }

  if (error) {
    return <div className="comm-log comm-log-error">⚠️ {error}</div>;
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="comm-log comm-log-empty">
        <div className="comm-log-empty-emoji">🛰️</div>
        <div className="comm-log-empty-title">No communication yet</div>
        <div className="comm-log-empty-text">
          Messages, calls, and WhatsApp chats will appear here as they are logged.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="comm-log">
        <div className="comm-log-list">
          {messages.map((msg) => {
            const reactions = Array.isArray(msg.reactions)
              ? msg.reactions
              : msg.reactions
              ? (() => {
                  try {
                    return JSON.parse(msg.reactions || '[]');
                  } catch {
                    return [];
                  }
                })()
              : [];

            const hasMedia = Array.isArray(msg.media) && msg.media.length > 0;
            const hasAttachments =
              Array.isArray(msg.attachments) && msg.attachments.length > 0;

            return (
              <div
                key={msg.id}
                className={`comm-log-item ${
                  msg.direction === 'inbound' || msg.is_inbound ? 'inbound' : 'outbound'
                }`}
              >
                {/* Avatar / Channel emoji */}
                <div className="comm-log-avatar">
                  {msg.avatar_url ? (
                    <LazyRemoteImage src={msg.avatar_url} alt={msg.sender || 'Sender'} />
                  ) : (
                    <div className="comm-log-avatar-fallback">{getChannelEmoji(msg)}</div>
                  )}
                </div>

                {/* Main content */}
                <div className="comm-log-content">
                  {/* Top meta row */}
                  <div className="comm-log-meta">
                    <div className="comm-log-meta-left">
                      <span className="comm-log-sender">
                        {msg.sender || msg.from || 'Unknown'}
                      </span>
                      {msg.subject && (
                        <span className="comm-log-subject-chip">
                          📌 {msg.subject}
                        </span>
                      )}
                    </div>
                    <div className="comm-log-meta-right">
                      {renderDirectionChip(msg)}
                      <span className="comm-log-time">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>

                  {/* Rich meta chips */}
                  <div className="comm-log-rich-meta">
                    {msg.channel && (
                      <span className="meta-chip">
                        {getChannelEmoji(msg)} {msg.channel}
                      </span>
                    )}
                    {msg.status && (
                      <span className="meta-chip">
                        ✅ Status: <strong>{msg.status}</strong>
                      </span>
                    )}
                    {msg.to && (
                      <span className="meta-chip">
                        📥 To: <strong>{msg.to}</strong>
                      </span>
                    )}
                  </div>

                  {/* Message text */}
                  {msg.body && (
                    <div className="comm-log-text">
                      {msg.body}
                    </div>
                  )}

                  {/* Media thumbnails */}
                  {hasMedia && (
                    <div className="comm-log-media">
                      {msg.media.map((m, idx) => (
                        <div key={idx} className="comm-log-media-item">
                          <div
                            className="comm-log-thumb-wrap"
                            onClick={() => openDetails(msg, m)}
                            title="View media details"
                          >
                            {m.thumbnail_url || m.url ? (
                              <LazyRemoteImage
                                src={m.thumbnail_url || m.url}
                                alt={m.filename || 'Media'}
                                className="comm-log-thumb"
                              />
                            ) : (
                              <div className="comm-log-thumb comm-log-thumb-placeholder">
                                📎
                              </div>
                            )}
                          </div>
                          <div className="comm-log-media-meta">
                            <span className="comm-log-filename" title={m.filename}>
                              {m.filename || 'Attachment'}
                            </span>
                            <button
                              type="button"
                              className="comm-log-open-btn"
                              onClick={() => openDetails(msg, m)}
                            >
                              🔍 Details
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Attachment chips */}
                  {hasAttachments && (
                    <div className="comm-log-attachments">
                      {msg.attachments.map((att, idx) => (
                        <div key={idx} className="comm-log-attachment">
                          <button
                            type="button"
                            className="comm-log-details-btn"
                            onClick={() => openDetails(msg, att)}
                          >
                            📎 {att.filename || 'Attachment'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reactions row */}
                  <div className="comm-log-reactions-row">
                    {reactions && reactions.length > 0 && (
                      <div className="comm-log-reactions">
                        {reactions.map((r, idx) => (
                          <span key={idx} className="comm-reaction">
                            {r}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Emoji reaction trigger */}
                    <div className="comm-log-emoji">
                      <button
                        type="button"
                        className="comm-log-emoji-btn"
                        onClick={() =>
                          setEmojiPickerFor(
                            emojiPickerFor === msg.id ? null : msg.id
                          )
                        }
                      >
                        <FiPlus size={14} /> React
                      </button>

                      {emojiPickerFor === msg.id && (
                        <div className="comm-emoji-picker">
                          {COMMON_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="emoji-choice"
                              onClick={() => addReactionLocal(msg.id, emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CommunicationDetailsModal
        onClose={closeDetails}
        payload={detailsModal.payload}
      />
    </>
  );
}

export default CommunicationLog;
