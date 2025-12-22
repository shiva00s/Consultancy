import React from 'react';
import { FiX, FiInfo } from 'react-icons/fi';
import './CommunicationDetailsModal.css';

function CommunicationDetailsModal({ onClose, payload }) {
  if (!payload) return null;
  const { log, attachment } = payload;

  const renderJson = (obj) => {
    try {
      return <pre>{JSON.stringify(obj, null, 2)}</pre>;
    } catch (e) {
      return <pre>{String(obj)}</pre>;
    }
  };

  const titleEmoji = log?.type === 'WhatsApp'
    ? '🟢'
    : log?.type === 'Call'
    ? '📞'
    : log?.type === 'SMS'
    ? '💬'
    : log?.type === 'Email'
    ? '📧'
    : '📡';

  return (
    <div className="comm-details-backdrop" onClick={onClose}>
      <div className="comm-details-modal" onClick={(e) => e.stopPropagation()}>
        <button className="comm-details-close" onClick={onClose}>
          <FiX />
        </button>

        <div className="comm-details-header">
          <div className="comm-details-icon">
            <span>{titleEmoji}</span>
          </div>
          <div className="comm-details-title-block">
            <h3>
              Communication details
            </h3>
            <p>
              {log?.type || 'Unknown'} •{' '}
              {log?.sender || log?.from || 'Unknown'} → {log?.to || 'N/A'}
            </p>
          </div>
        </div>

        <div className="comm-details-body">
          <div className="comm-details-section">
            <h4>
              <FiInfo /> Core information
            </h4>
            <div className="comm-details-grid">
              <div>
                <span className="comm-details-label">Type</span>
                <div className="comm-details-value">{log?.type || 'N/A'}</div>
              </div>
              <div>
                <span className="comm-details-label">Channel</span>
                <div className="comm-details-value">{log?.channel || 'N/A'}</div>
              </div>
              <div>
                <span className="comm-details-label">Status</span>
                <div className="comm-details-value">{log?.status || 'N/A'}</div>
              </div>
              <div>
                <span className="comm-details-label">Timestamp</span>
                <div className="comm-details-value">
                  {log?.timestamp || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {attachment && (
            <div className="comm-details-section">
              <h4>📎 Attachment</h4>
              <div className="comm-details-grid">
                <div>
                  <span className="comm-details-label">Filename</span>
                  <div className="comm-details-value">
                    {attachment.filename || 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="comm-details-label">MIME type</span>
                  <div className="comm-details-value">
                    {attachment.mime_type || 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="comm-details-label">Size</span>
                  <div className="comm-details-value">
                    {attachment.size ? `${attachment.size} bytes` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="comm-details-section">
            <h4>🧾 Raw payload</h4>
            <div className="comm-details-json">
              {renderJson(log)}
            </div>
          </div>
        </div>

        <div className="comm-details-actions">
          <button className="btn-close" onClick={onClose}>
            ❌ Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default CommunicationDetailsModal;
CommunicationDetailsModal.css