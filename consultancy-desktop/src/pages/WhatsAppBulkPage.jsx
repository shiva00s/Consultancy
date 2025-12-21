import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiSearch,
  FiFileText,
  FiSend,
  FiFilter,
  FiMessageCircle,
} from 'react-icons/fi';

import '../css/WhatsAppBulk.css';

import useDataStore from '../store/dataStore';
import useAuthStore from '../store/useAuthStore';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/common/ConfirmDialog';

const statusOptions = [
  'New',
  'Documents Collected',
  'Visa Applied',
  'In Progress',
  'Completed',
  'Rejected',
];

function WhatsAppBulkPage() {
  const user = useAuthStore((state) => state.user);
  const employers = useDataStore((state) => state.employers);

  const [mediaFile, setMediaFile] = useState(null);

  const [nameFilter, setNameFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [employerFilter, setEmployerFilter] = useState('');

  const [list, setList] = useState([]);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState({});
  const [positions, setPositions] = useState([]);
  const [subject, setSubject] = useState('');
  const [reason, setReason] = useState('');

  const [activeTab, setActiveTab] = useState('filters'); // "filters" | "whatsapp"
  const [hoverPreview, setHoverPreview] = useState({ visible: false, x: 0, y: 0, rowId: null });
  const listRef = useRef([]);
  const clearPendingRef = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'info' });

  // ----- LOAD POSITIONS ONCE -----
  useEffect(() => {
    const loadPositions = async () => {
      const res = await window.electronAPI.getJobOrders();
      if (res.success && Array.isArray(res.data)) {
        const unique = [...new Set(res.data.map((j) => j.positionTitle))];
        setPositions(unique);
      }
    };
    loadPositions();
  }, []);

  // ----- FETCH DATA (USED BY FILTERS + INITIAL LOAD) -----
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const fetchData = useCallback(
    async () => {
      const payload = {
        user,
        searchTerm: nameFilter,
        position: positionFilter,
        status: statusFilter,
        employer: employerFilter,
      };

      const listRes = await window.electronAPI.getDetailedReportList(payload);

      if (listRes.success) {
        const rows = Array.isArray(listRes.data) ? listRes.data : [];
        setList(rows);

        // Show success/error toast only after first load
        if (hasLoadedOnce) {
          if (rows.length > 0) {
            toast.success(`Found ${rows.length} candidates.`);
          } else {
            toast.error('No matching candidates.');
          }
        } else {
          setHasLoadedOnce(true);
        }
      } else {
        toast.error(listRes.error || 'Failed to fetch data.');
      }
    },
    [user, nameFilter, positionFilter, statusFilter, employerFilter, hasLoadedOnce]
  );

  // ----- INITIAL AUTO-LOAD FOR TABLE -----
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // Keep a ref to the list for cleanup and revoke object URLs on unmount
  useEffect(() => {
    listRef.current = list;
  }, [list]);

  useEffect(() => {
    return () => {
      try {
        (listRef.current || []).forEach((r) => {
          if (r?.attachedFile?.previewUrl) {
            URL.revokeObjectURL(r.attachedFile.previewUrl);
          }
        });
      } catch (e) {
        // ignore
      }
    };
  }, []);

  // When user returns focus to the app after opening external WhatsApp, clear pending fields
  useEffect(() => {
    const onFocus = () => {
      const pending = clearPendingRef.current;
      if (!pending) return;

      if (pending.type === 'single') {
        setList((prev) => prev.map((r) => {
          if (String(r.id) === String(pending.id)) {
            try { if (r?.attachedFile?.previewUrl) URL.revokeObjectURL(r.attachedFile.previewUrl); } catch (e) {}
            return { ...r, singleMessage: '', attachedFile: null };
          }
          return r;
        }));
      } else if (pending.type === 'bulk') {
        // clear global message/media and per-row attached files for affected ids
        setMessage('');
        setMediaFile(null);
        setList((prev) => prev.map((r) => {
          if (pending.ids && pending.ids.includes(String(r.id))) {
            try { if (r?.attachedFile?.previewUrl) URL.revokeObjectURL(r.attachedFile.previewUrl); } catch (e) {}
            return { ...r, singleMessage: '', attachedFile: null };
          }
          return r;
        }));
      }

      clearPendingRef.current = null;
      setHoverPreview({ visible: false, x: 0, y: 0, rowId: null });
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // ----- WHATSAPP + TABLE HELPERS -----
  const toggleSelect = (id, contact) => {
    setSelected((prev) => {
      const updated = { ...prev };
      updated[id] = updated[id] ? null : contact;
      return updated;
    });
  };

  const sendWhatsApp = async () => {
    const recipients = Object.entries(selected)
      .filter(([, contact]) => !!contact)
      .map(([id, contact]) => ({ id, contact }));

    if (recipients.length === 0) {
      toast.error('Please select at least one candidate.');
      return;
    }

    if (!message.trim()) {
      toast.error('Please enter a WhatsApp message.');
      return;
    }

    try {
      // For each recipient, upload any attached file and log the message + attachments
      await Promise.all(
        recipients.map(async (r) => {
          const row = list.find((x) => String(x.id) === String(r.id));
          let attachmentsMeta = [];
          if (row && row.attachedFile) {
            try {
              const up = await window.electronAPI.uploadDocument({
                candidateId: row.id,
                filePath: row.attachedFile.path,
                originalName: row.attachedFile.name,
                meta: { via: 'whatsapp' },
              });
              if (up && up.success) {
                attachmentsMeta = up.data ? (Array.isArray(up.data) ? up.data : [up.data]) : [];
              }
            } catch (err) {
              console.error('Upload failed for', row.id, err);
            }
          }

          await window.electronAPI.logCommunication({
            user,
            candidateId: r.id,
            communication_type: 'WhatsApp',
            details: message,
            attachments: attachmentsMeta,
            metadata: { subject: subject || null, reason: reason || null },
          });
        })
      );

      // mark pending clear so when user returns focus we reset compose state
      clearPendingRef.current = { type: 'bulk', ids: recipients.map((r) => String(r.id)) };

      window.electronAPI.sendWhatsAppBulk({
        numbers: recipients.map((r) => r.contact),
        message,
        mediaPath: mediaFile?.path || null,
        fallbackLogs: recipients.map((r) => ({
          candidateId: r.id,
          userId: user?.id,
          communication_type: 'WhatsApp',
          details: message,
          metadata: { subject: subject || null, reason: reason || null },
        })),
      });

      toast.success('Opening WhatsApp chats...');
    } catch (err) {
      console.error('Error logging WhatsApp messages:', err);
      toast.error('Failed to log messages before opening WhatsApp.');
    }
  };

  const handleBulkClick = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Open WhatsApp',
      message: 'Open WhatsApp and send messages to selected candidates?',
      type: 'info',
      onConfirm: async () => {
        setConfirmDialog((s) => ({ ...s, isOpen: false }));
        await sendWhatsApp();
      },
      onCancel: () => setConfirmDialog((s) => ({ ...s, isOpen: false })),
    });
  };

  const handleClearFilters = () => {
    setNameFilter('');
    setPositionFilter('');
    setStatusFilter('');
    setEmployerFilter('');
  };

  return (
    <div className="reports-page-container">
      {/* Page header row – match Audit Log spacing */}
      <div className="wa-header-row">
        <div>
          <h1 className="reports-title">📣 WhatsApp Bulk Messaging</h1>
          <p className="wa-header-subtitle">
            Send personalised WhatsApp messages to selected candidates in bulk.
          </p>
        </div>
      </div>

      {/* Top tab row – like Application Settings */}
      <div className="wa-tabs-strip">
        <button
          type="button"
          className={`wa-strip-tab ${activeTab === 'filters' ? 'active' : ''}`}
          onClick={() => setActiveTab('filters')}
        >
          <FiFilter />
          <span> Filters</span>
        </button>
        <button
          type="button"
          className={`wa-strip-tab ${activeTab === 'whatsapp' ? 'active' : ''}`}
          onClick={() => setActiveTab('whatsapp')}
        >
          <FiMessageCircle />
          <span> WhatsApp</span>
        </button>
      </div>

      {/* TAB CONTENT STRIP – full-width card like Audit Log content */}
      <div className="wa-tab-panels">
        {activeTab === 'filters' && (
          <div className="wa-tab-panel">
            <div className="wa-filters-shell">
              <form
                className="report-filter-bar"
                onSubmit={(e) => {
                  e.preventDefault();
                  fetchData();
                }}
              >
                <div className="filter-field">
                  <FiSearch />
                  <input
                    type="text"
                    placeholder="🔍 Search Name"
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                  />
                </div>

                <div className="filter-field">
                  <FiSearch />
                  <select
                    value={positionFilter}
                    onChange={(e) => setPositionFilter(e.target.value)}
                  >
                    <option value="">📌 All Positions</option>
                    {positions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-field">
                  <FiSearch />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">📊 All Statuses</option>
                    {statusOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-field">
                  <FiSearch />
                  <select
                    value={employerFilter}
                    onChange={(e) => setEmployerFilter(e.target.value)}
                  >
                    <option value="">🏢 All Employers</option>
                    {employers.map((emp) => (
                      <option key={emp.id} value={emp.companyName}>
                        {emp.companyName}
                      </option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="btn btn-primary">
                  Apply Filters ✅
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleClearFilters}
                >
                  Clear ✖
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'whatsapp' && (
          <div className="wa-tab-panel">
            <div className="wa-whatsapp-shell">
              <div className="whatsapp-input-box">
                <div className="attach-row">
                  <label className="media-upload-button">
                    📎 Attach Media
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) setMediaFile(file);
                      }}
                    />
                  </label>
                </div>

                {mediaFile && (
                  <div className="media-preview-box">
                    <span>📄 {mediaFile.name}</span>
                    <button
                      className="remove-media-btn"
                      onClick={() => setMediaFile(null)}
                    >
                      ✖
                    </button>
                  </div>
                )}

                <textarea
                  className="whatsapp-message"
                  placeholder="✏️ Type WhatsApp message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />

                <input
                  type="text"
                  placeholder="Subject / Purpose (optional)"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{ marginTop: 8, width: '100%', padding: '8px' }}
                />

                <input
                  type="text"
                  placeholder="Reason / Notes (optional)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{ marginTop: 6, width: '100%', padding: '8px' }}
                />

                <button
                  className="whatsapp-send-inside"
                  onClick={sendWhatsApp}
                >
                  <FiSend size={18} style={{ marginRight: 6 }} />
                  Send WhatsApp 🚀
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TABLE – visually same gutter as Audit Log list */}
      <div className="report-results-section">
        <h3 className="report-section-title">
          <FiFileText /> Candidates 📋 ({list.length} Records)
        </h3>

        <div className="report-table-container">
          <table className="report-table">
            <thead>
  <tr>
    <th>
      <input
        type="checkbox"
        checked={
          list.length > 0 && list.every((row) => selected[row.id])
        }
        onChange={() => {
          const allSelected = list.every((row) => selected[row.id]);
          const updated = {};
          if (!allSelected) {
            list.forEach((row) => {
              updated[row.id] = row.contact;
            });
          }
          setSelected(updated);
        }}
      />
    </th>
    <th>👤 Candidate Name</th>
    <th>🛂 Passport No</th>
    <th>💼 Position</th>
    <th>🏢 Employer</th>
    <th>📊 Status</th>
    <th>📱 Contact</th>
    <th>✏️ Message</th>
    <th>💬 WhatsApp</th>
  </tr>
</thead>


            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    style={{ textAlign: 'center', padding: '2rem' }}
                  >
                    No matching candidates.
                  </td>
                </tr>
              ) : (
                list.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!selected[row.id]}
                        onChange={() => toggleSelect(row.id, row.contact)}
                      />
                    </td>
                    <td>
                      <strong>{row.name}</strong>
                    </td>
                    <td>{row.passportNo}</td>
                    <td>{row.Position || '-'}</td>
                    <td>{row.companyName || 'Unassigned'}</td>
                    <td>{row.status}</td>
                    <td>{row.contact}</td>
                    <td>
                      <input
                        className="single-wa-message"
                        type="text"
                        placeholder="Type msg..."
                        value={row.singleMessage || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setList((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? { ...r, singleMessage: value }
                                : r
                            )
                          );
                        }}
                      />
                    </td>
                    <td>
                      <label className="single-attach-btn" style={{ cursor: 'pointer' }}>
                        📎
                        <input
                          type="file"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const previewUrl = URL.createObjectURL(file);
                            setList((prev) =>
                              prev.map((r) => {
                                if (r.id === row.id) {
                                  // revoke any previous preview for this row
                                  try {
                                    if (r?.attachedFile?.previewUrl) URL.revokeObjectURL(r.attachedFile.previewUrl);
                                  } catch (er) {}
                                  return { ...r, attachedFile: { file, previewUrl, name: file.name, path: file.path } };
                                }
                                return r;
                              })
                            );
                          }}
                        />
                      </label>
                      {row.attachedFile && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                          {row.attachedFile.previewUrl && /\.(png|jpe?g|gif|webp)$/i.test(row.attachedFile.name) ? (
                            <img src={row.attachedFile.previewUrl} alt={row.attachedFile.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} />
                          ) : (
                            <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: '#f1f1f1', fontSize: 11, color: '#333' }}>
                              {(row.attachedFile.name || '').split('.').pop().toUpperCase()}
                            </div>
                          )}
                          <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.attachedFile.name}</span>
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        className="single-wa-btn"
                        onMouseEnter={(e) => {
                          if (row.attachedFile) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoverPreview({ visible: true, x: rect.right + 8, y: rect.top, rowId: row.id });
                          }
                        }}
                        onMouseLeave={() => setHoverPreview({ visible: false, x: 0, y: 0, rowId: null })}
                        onClick={() => {
                          setConfirmDialog({
                            isOpen: true,
                            title: 'Open WhatsApp',
                            message: `Open WhatsApp for ${row.name || 'this candidate'}?`,
                            type: 'info',
                            onConfirm: async () => {
                              setConfirmDialog((s) => ({ ...s, isOpen: false }));

                              const msg = row.singleMessage || '';
                              if (!msg.trim()) {
                                toast.error('Enter message for this candidate.');
                                return;
                              }

                              let attachmentsMeta = [];
                              if (row.attachedFile) {
                                try {
                                  const up = await window.electronAPI.uploadDocument({
                                    candidateId: row.id,
                                    filePath: row.attachedFile.path,
                                    originalName: row.attachedFile.name,
                                    meta: { via: 'whatsapp' },
                                  });
                                  if (up && up.success) {
                                    attachmentsMeta = up.data ? (Array.isArray(up.data) ? up.data : [up.data]) : [];
                                  }
                                } catch (err) {
                                  console.error('Upload failed:', err);
                                }
                              }

                              try {
                                await window.electronAPI.logCommunication({
                                  user,
                                  candidateId: row.id,
                                  communication_type: 'WhatsApp',
                                  details: msg,
                                  attachments: attachmentsMeta,
                                  metadata: { subject: subject || null, reason: reason || null },
                                });
                              } catch (err) {
                                console.error('Failed to log WhatsApp message:', err);
                              }

                              // mark pending clear so fields reset when user returns to app
                              clearPendingRef.current = { type: 'single', id: String(row.id) };

                              window.electronAPI.openWhatsAppSingle({
                                number: row.contact,
                                message: msg,
                                fallbackLog: {
                                  candidateId: row.id,
                                  userId: user?.id,
                                  communication_type: 'WhatsApp',
                                  details: msg,
                                  metadata: { subject: subject || null, reason: reason || null },
                                }
                              });
                            },
                            onCancel: () => setConfirmDialog((s) => ({ ...s, isOpen: false })),
                          });
                        }}
                      >
                        💬
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Hover preview tooltip */}
      {hoverPreview.visible && (
        (() => {
          const row = list.find((r) => r.id === hoverPreview.rowId);
          if (!row || !row.attachedFile) return null;
          return (
            <div
              className="wa-attach-hover"
              style={{
                position: 'fixed',
                left: hoverPreview.x,
                top: hoverPreview.y,
                zIndex: 10000,
                background: '#fff',
                padding: 8,
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 6,
                boxShadow: '0 6px 18px rgba(0,0,0,0.12)'
              }}
            >
              {row.attachedFile.previewUrl && (
                <img src={row.attachedFile.previewUrl} alt={row.attachedFile.name} style={{ maxWidth: 240, maxHeight: 200 }} />
              )}
              {!row.attachedFile.previewUrl && (
                <div>{row.attachedFile.name}</div>
              )}
            </div>
          );
        })()
      )}
      
          {/* Confirm dialog (reusable modal) */}
          <ConfirmDialog
            isOpen={confirmDialog.isOpen}
            title={confirmDialog.title}
            message={confirmDialog.message}
            type={confirmDialog.type}
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog((s) => ({ ...s, isOpen: false }))}
            confirmText="Yes"
            cancelText="No"
          />
    </div>
  );
}

export default WhatsAppBulkPage;
