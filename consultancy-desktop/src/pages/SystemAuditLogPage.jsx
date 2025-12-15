// SystemAuditLogPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiClock,
  FiUsers,
  FiFilter,
  FiRefreshCw,
  FiAlertTriangle,
  FiShield,
  FiTrash2,
  FiEdit2,
  FiEye,
  FiPlusCircle,
  FiBarChart2,
  FiUserCheck,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import useAuthStore from '../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import '../css/SystemAuditLogPage.css';

const ITEMS_PER_PAGE = 30;

const formatTimestamp = (isoString) => {
  if (!isoString) return 'N/A';

  let safeIso = isoString;
  if (!isoString.includes('T')) {
    safeIso = isoString.replace(' ', 'T');
  }
  if (!safeIso.endsWith('Z') && !safeIso.includes('+')) {
    safeIso = `${safeIso}Z`;
  }

  try {
    const date = new Date(safeIso);
    if (isNaN(date.getTime())) return isoString;

    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
};

const hasAdminAccess = (user) => {
  if (!user || !user.role) return false;
  const role = String(user.role).toLowerCase().trim();
  return role === 'super_admin' || role === 'superadmin' || role === 'admin';
};

// Decide icon + color per log
const getLogVisuals = (log) => {
  const action = (log?.action || '').toLowerCase();
  const target = (log?.target_type || '').toLowerCase();

  // DELETE
  if (
    action.includes('delete') ||
    action.includes('removed') ||
    action.includes('remove')
  ) {
    return { icon: FiTrash2, className: 'audit-icon--danger' };
  }

  // UPDATE / EDIT
  if (
    action.includes('update') ||
    action.includes('edit') ||
    action.includes('modify')
  ) {
    return { icon: FiEdit2, className: 'audit-icon--warning' };
  }

  // CREATE / ADD
  if (
    action.includes('create') ||
    action.includes('add') ||
    action.includes('insert') ||
    action.includes('new')
  ) {
    return { icon: FiPlusCircle, className: 'audit-icon--success' };
  }

  // VIEW / DASHBOARD / REPORTS
  if (
    action.includes('view') ||
    action.includes('open') ||
    target.includes('dashboard') ||
    action.includes('report')
  ) {
    return { icon: FiBarChart2, className: 'audit-icon--info' };
  }

  // CANDIDATE operations
  if (target.includes('candidate') || action.includes('candidate')) {
    return { icon: FiUserCheck, className: 'audit-icon--candidate' };
  }

  // Generic VIEW fallback
  if (action.includes('view')) {
    return { icon: FiEye, className: 'audit-icon--info' };
  }

  // Default
  return { icon: FiClock, className: 'audit-icon--default' };
};

function SystemAuditLogPage() {
  const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const isMountedRef = useRef(false);

  const fetchLogs = useCallback(
    async (page = 1) => {
      if (!user || !hasAdminAccess(user)) return;
      if (!isMountedRef.current) return;

      setLoading(true);
      setError(null);
      setCurrentPage(page);

      const limit = ITEMS_PER_PAGE;
      const offset = (page - 1) * limit;

      try {
        const res = await window.electronAPI.getSystemAuditLog({
          user,
          userFilter: userFilter.trim(),
          actionFilter: actionFilter.trim(),
          limit,
          offset,
        });

        if (res?.success) {
          setLogs(res.data || []);
          setTotalItems(res.totalCount || 0);
        } else {
          const msg = res?.error || 'Failed to fetch audit log.';
          setError(msg);
          toast.error(msg);
        }
      } catch {
        const msg = 'An unexpected error occurred while loading audit logs.';
        setError(msg);
        toast.error(msg);
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    },
    [user, userFilter, actionFilter]
  );

  useEffect(() => {
    isMountedRef.current = true;

    if (!user) {
      setError('Please log in to view audit logs.');
      setLoading(false);
    } else if (!hasAdminAccess(user)) {
      setError(`Access denied. Your role (${user.role}) cannot access audit logs.`);
      setLoading(false);
    } else {
      fetchLogs(1);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [user?.id]);

  const handleFilterSubmit = (e) => {
    if (e) e.preventDefault();
    fetchLogs(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && !loading) {
      fetchLogs(newPage);
    }
  };

  const handleRefresh = () => {
    fetchLogs(currentPage);
  };

  const handleClearFilters = () => {
    setUserFilter('');
    setActionFilter('');
    setTimeout(() => fetchLogs(1), 0);
  };

  if (!user) {
    return (
      <div className="audit-page-root">
        <div className="audit-message-card error">
          <FiAlertTriangle />
          <div>
            <strong>Authentication Required</strong>
            <p>Please log in to view audit logs.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAdminAccess(user)) {
    return (
      <div className="audit-page-root">
        <div className="audit-message-card error">
          <FiShield className="audit-message-icon-large" />
          <div>
            <strong>Access Denied</strong>
            <p>Only administrators can access audit logs.</p>
            <p>
              Your role: <strong>{user.role}</strong>
            </p>
            <p className="audit-message-hint">
              Required roles: super_admin, admin
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !loading && logs.length === 0) {
    return (
      <div className="audit-page-root">
        <div className="audit-message-card error">
          <FiAlertTriangle />
          <div>
            <strong>Error loading audit log</strong>
            <p>{error}</p>
            <button
              className="btn btn-sm"
              type="button"
              onClick={() => fetchLogs(currentPage)}
            >
              <FiRefreshCw /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="audit-page-root">
      {/* Header */}
      <div className="audit-header">
        <div className="audit-header-left">
          <h1 className="audit-title">
            <span className="audit-title-icon">
              <FiClock />
            </span>
            <span className="audit-title-text">
              System Audit Log
              <span className="audit-title-sub">
                Chronological trail of every key action.
              </span>
            </span>
          </h1>
        </div>

        <div className="audit-header-right">
          <div className="audit-role-badge">
            {user.role === 'super_admin' ? '👑 Super Admin' : '🔑 Admin'}
          </div>
          <div className="audit-meta-pill">
            <span className="dot" /> Realtime insights
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="audit-layout-grid">
        {/* Sidebar */}
        <aside className="audit-sidebar">
          {/* Filters */}
          <form className="audit-card filter-card" onSubmit={handleFilterSubmit}>
            <div className="audit-card-header">
              <span className="badge badge-primary">Filters</span>
              <span className="audit-card-title">
                <FiFilter /> Refine Activity Stream
              </span>
            </div>

            <div className="audit-field">
              <label>
                <FiUsers /> Filter by Username
              </label>
              <input
                type="text"
                placeholder="e.g. admin, recruiter01"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
              />
            </div>

            <div className="audit-field">
              <label>
                <FiFilter /> Filter by Action / Target
              </label>
              <input
                type="text"
                placeholder="e.g. login, employer, placement"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              />
            </div>

            <div className="audit-filter-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                <FiFilter /> Apply Filters
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClearFilters}
                disabled={loading || (!userFilter && !actionFilter)}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleRefresh}
                disabled={loading}
                title="Refresh now"
              >
                <FiRefreshCw className={loading ? 'spinning' : ''} /> Refresh
              </button>
            </div>
          </form>

          {/* Stats */}
          <div className="audit-card stats-card">
            <div className="audit-card-header">
              <span className="badge badge-soft">Overview</span>
              <span className="audit-card-title">Activity Snapshot</span>
            </div>

            <div className="audit-stats-grid">
              <div className="audit-stat">
                <span className="label">Total Entries</span>
                <span className="value">{totalItems}</span>
              </div>
              <div className="audit-stat">
                <span className="label">This Page</span>
                <span className="value">{logs.length}</span>
              </div>
              <div className="audit-stat">
                <span className="label">Current Page</span>
                <span className="value">
                  {totalPages ? `${currentPage}/${totalPages}` : '1/1'}
                </span>
              </div>
              <div className="audit-stat">
                <span className="label">Role</span>
                <span className="value small">{user.role}</span>
              </div>
            </div>

            <p className="audit-tip">
              Pro tip: Combine username and action filters to pinpoint a specific
              user journey.
            </p>
          </div>
        </aside>

        {/* Main column */}
        <section className="audit-main">
          <div className="audit-results-bar">
            Showing <strong>{logs.length}</strong> of{' '}
            <strong>{totalItems}</strong> entries
            {totalPages > 1 && (
              <>
                {' '}
                · Page <strong>{currentPage}</strong> of{' '}
                <strong>{totalPages}</strong>
              </>
            )}
          </div>

          <div className="audit-card audit-log-card">
            {loading ? (
              <div className="audit-loading">
                <div className="spinner" />
                <p>Loading audit history...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="audit-empty">
                <FiClock className="audit-empty-icon" />
                <h3>No Logs Found</h3>
                <p>
                  {userFilter || actionFilter
                    ? 'No entries match your current filters. Try broadening the criteria.'
                    : 'The system has not recorded any audit entries yet.'}
                </p>
                {(userFilter || actionFilter) && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleClearFilters}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <ul className="audit-timeline">
                {logs.map((log) => {
                  const { icon: Icon, className } = getLogVisuals(log);

                  return (
                    <li key={log.id} className="audit-timeline-item">
                      <div className={`audit-timeline-icon ${className}`}>
                        <Icon />
                      </div>

                      <div className="audit-timeline-content">
                        <div className="audit-timeline-header">
                          <div className="audit-timeline-title">
                            {log.action.replace(/_/g, ' ')}
                          </div>
                          <div className="audit-timeline-user">
                            <FiUsers /> {log.username}
                          </div>
                        </div>

                        <div className="audit-timeline-body">
                          <p className="audit-timeline-details">
                            {log.details ||
                              `Target: ${log.target_type} (ID: ${log.target_id})`}
                          </p>
                          <span className="audit-timeline-time">
                            🕒 {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {totalItems > ITEMS_PER_PAGE && !loading && (
            <div className="audit-pagination">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
              >
                ← Previous
              </button>

              <span className="audit-pagination-info">
                Page <strong>{currentPage}</strong> of{' '}
                <strong>{totalPages}</strong> ·{' '}
                <strong>{totalItems}</strong> entries
              </span>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
              >
                Next →
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default SystemAuditLogPage;
