import React, { useState, useEffect, useCallback } from 'react';
import {
  FiSearch,
  FiFileText,
  FiSend,
  FiFilter,
  FiMessageCircle
} from 'react-icons/fi';

import '../css/ReportsPage.css';
import '../css/WhatsAppBulk.css';

import useDataStore from '../store/dataStore';
import useAuthStore from '../store/useAuthStore';
import toast from 'react-hot-toast';

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

  const [activeTab, setActiveTab] = useState('filters'); // "filters" | "whatsapp"

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

const fetchData = useCallback(async () => {
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
}, [user, nameFilter, positionFilter, statusFilter, employerFilter, hasLoadedOnce]);


  // ----- INITIAL AUTO-LOAD FOR TABLE -----
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // ----- WHATSAPP + TABLE HELPERS -----
  const toggleSelect = (id, contact) => {
    setSelected((prev) => {
      const updated = { ...prev };
      updated[id] = updated[id] ? null : contact;
      return updated;
    });
  };

  const sendWhatsApp = () => {
    const numbers = Object.values(selected).filter(Boolean);

    if (numbers.length === 0) {
      toast.error('Please select at least one candidate.');
      return;
    }

    if (!message.trim()) {
      toast.error('Please enter a WhatsApp message.');
      return;
    }

    window.electronAPI.sendWhatsAppBulk({
      numbers,
      message,
      mediaPath: mediaFile?.path || null,
    });

    toast.success('Opening WhatsApp chats...');
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
          <h1 className="reports-title">WhatsApp Bulk Messaging</h1>
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
    <span>Filters</span>
  </button>
  <button
    type="button"
    className={`wa-strip-tab ${activeTab === 'whatsapp' ? 'active' : ''}`}
    onClick={() => setActiveTab('whatsapp')}
  >
    <FiMessageCircle />
    <span>WhatsApp</span>
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
                    placeholder="Search Name"
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
                    <option value="">All Positions</option>
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
                    <option value="">All Statuses</option>
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
                    <option value="">All Employers</option>
                    {employers.map((emp) => (
                      <option key={emp.id} value={emp.companyName}>
                        {emp.companyName}
                      </option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="btn btn-primary">
                  Apply Filters
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleClearFilters}
                >
                  Clear
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
                  placeholder="Type WhatsApp message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />

                <button className="whatsapp-send-inside" onClick={sendWhatsApp}>
                  <FiSend size={18} style={{ marginRight: 6 }} />
                  Send WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TABLE – visually same gutter as Audit Log list */}
      <div className="report-results-section">
        <h3 className="report-section-title">
          <FiFileText /> Candidates ({list.length} Records)
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
                      const allSelected = list.every(
                        (row) => selected[row.id]
                      );
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
                <th>Candidate Name</th>
                <th>Passport No</th>
                <th>Position</th>
                <th>Employer</th>
                <th>Status</th>
                <th>Contact</th>
                <th>Message</th>
                <th>WhatsApp</th>
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
                      <button
                        className="single-wa-btn"
                        onClick={() => {
                          const msg = row.singleMessage || '';
                          if (!msg.trim()) {
                            toast.error(
                              'Enter message for this candidate.'
                            );
                            return;
                          }
                          window.electronAPI.openWhatsAppSingle({
                            number: row.contact,
                            message: msg,
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
    </div>
  );
}

export default WhatsAppBulkPage;
