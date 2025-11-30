import React, { useState, useEffect } from 'react';
import { FiMail, FiClock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { emailService } from '../services/emailService';
import { LoadingSpinner } from './LoadingSpinner';
import '../css/EmailHistory.css';

function EmailHistory({ candidateId }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedEmail, setExpandedEmail] = useState(null);

  useEffect(() => {
    loadEmailHistory();
  }, [candidateId]);

  const loadEmailHistory = async () => {
    setLoading(true);
    try {
      const history = await emailService.getEmailHistory(candidateId);
      setEmails(history);
    } catch (error) {
      console.error('Error loading email history:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEmailExpand = (emailId) => {
    setExpandedEmail(expandedEmail === emailId ? null : emailId);
  };

  if (loading) {
    return (
      <div className="email-history-loading">
        <LoadingSpinner />
        <p>Loading email history...</p>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="email-history-empty">
        <FiMail />
        <p>No emails sent yet</p>
      </div>
    );
  }

  return (
    <div className="email-history">
      <h4 className="history-title">
        <FiMail />
        Email History ({emails.length})
      </h4>

      <div className="email-timeline">
        {emails.map((email) => (
          <div key={email.id} className="email-item">
            <div 
              className="email-header"
              onClick={() => toggleEmailExpand(email.id)}
            >
              <div className="email-status">
                {email.status === 'sent' ? (
                  <FiCheckCircle className="status-icon success" />
                ) : (
                  <FiAlertCircle className="status-icon error" />
                )}
              </div>

              <div className="email-info">
                <h5>{email.subject}</h5>
                <div className="email-meta">
                  <span className="email-date">
                    <FiClock />
                    {new Date(email.sentAt).toLocaleString()}
                  </span>
                  <span className="email-recipient">
                    To: {email.to}
                  </span>
                </div>
              </div>
            </div>

            {expandedEmail === email.id && (
              <div className="email-body">
                <div className="body-header">
                  <strong>Subject:</strong> {email.subject}
                </div>
                {email.cc && (
                  <div className="body-meta">
                    <strong>Cc:</strong> {email.cc}
                  </div>
                )}
                <div className="body-content">
                  {email.body}
                </div>
                {email.attachments && email.attachments.length > 0 && (
                  <div className="body-attachments">
                    <strong>Attachments:</strong>
                    <ul>
                      {email.attachments.map((attachment, index) => (
                        <li key={index}>{attachment.filename}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default EmailHistory;
import React, { useState, useEffect } from 'react';
import { FiMail, FiClock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { emailService } from '../services/emailService';
import { LoadingSpinner } from './LoadingSpinner';
import '../css/EmailHistory.css';