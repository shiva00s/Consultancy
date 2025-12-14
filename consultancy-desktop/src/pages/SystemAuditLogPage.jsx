// ============================================
// SYSTEM AUDIT LOG PAGE - FIXED
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import { FiClock, FiUsers, FiFilter, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import useAuthStore from '../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';

const ITEMS_PER_PAGE = 30;

const formatTimestamp = (isoString) => {
  if (!isoString) return 'N/A';
  
  let safeIso = isoString;
  if (!isoString.includes('T')) {
      safeIso = isoString.replace(' ', 'T') + 'Z';
  } else if (!isoString.endsWith('Z')) {
      safeIso = isoString + 'Z';
  }

  const date = new Date(safeIso);
  
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

function SystemAuditLogPage() {
    const { user } = useAuthStore(useShallow(state => ({ user: state.user })));
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    const [userFilter, setUserFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('');

    const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    setCurrentPage(page);

    const limit = ITEMS_PER_PAGE;
    const offset = (page - 1) * limit;
    
    try {
        const res = await window.electronAPI.getSystemAuditLog({
            user: user,  // ✅ ADD THIS: Pass the user object
            userFilter: userFilter,
            actionFilter: actionFilter,
            limit: limit,
            offset: offset
        });
        
        if (res.success) {
            setLogs(res.data || []);
            setTotalItems(res.totalCount || 0);
        } else {
            setError(res.error || 'Failed to fetch audit log.');
            toast.error(res.error || 'Failed to fetch audit log.');
        }
    } catch (err) {
        setError('An unexpected error occurred during log retrieval.');
        toast.error('An unexpected error occurred during log retrieval.');
    }
    
    setLoading(false);
}, [user, userFilter, actionFilter]);  // ✅ Add user to dependencies


    useEffect(() => {
        if (!user) {
            setError("Please log in to view audit logs.");
            setLoading(false);
            return;
        }
        
        // Normalize role names
        const normalizedRole = user.role?.toLowerCase().replace('_', '');
        
        if (!['admin', 'superadmin'].includes(normalizedRole)) {
            setError(`Access denied. Your role (${user.role}) cannot access audit logs.`);
            setLoading(false);
            return;
        }
        
        fetchLogs(1);
    }, [fetchLogs, user]);
    
    const handleFilterSubmit = (e) => {
        if (e) e.preventDefault();
        fetchLogs(1);
    };
    
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            fetchLogs(newPage);
        }
    };
    
    if (!user) {
        return (
            <div className="reports-page-container">
                <div className="form-message error">
                    <FiAlertTriangle />
                    <div>
                        <strong>Authentication Required</strong>
                        <p>Please log in to view audit logs.</p>
                    </div>
                </div>
            </div>
        );
    }
    
    const normalizedRole = user.role?.toLowerCase().replace('_', '');
    if (!['admin', 'superadmin'].includes(normalizedRole)) {
        return (
            <div className="reports-page-container">
                <div className="form-message error">
                    <FiAlertTriangle />
                    <div>
                        <strong>Access Denied</strong>
                        <p>Only administrators can access audit logs.</p>
                        <p>Your role: <strong>{user.role}</strong></p>
                    </div>
                </div>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="reports-page-container">
                <div className="form-message error">
                    <FiAlertTriangle />
                    <div>
                        <strong>Error loading audit log</strong>
                        <p>{error}</p>
                        <button className="btn btn-sm" onClick={() => fetchLogs(currentPage)}>
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="reports-page-container">
            <h1><FiClock /> System Audit Log</h1>
            <p>View a chronological list of all user actions across the application.</p>

            <form className="report-filter-bar" onSubmit={handleFilterSubmit} style={{marginBottom: '1rem'}}>
                <div className="filter-field" style={{flexGrow: 1}}>
                    <FiUsers />
                    <input
                        type="text"
                        placeholder="Filter by Username..."
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value)}
                    />
                </div>
                <div className="filter-field" style={{flexGrow: 1}}>
                    <FiFilter />
                    <input
                        type="text"
                        placeholder="Filter by Action/Target Type..."
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                    />
                </div>
                <button type="submit" className="btn btn-secondary">Apply Filters</button>
                <button type="button" className="icon-btn view" onClick={() => fetchLogs(currentPage)}>
                    <FiRefreshCw />
                </button>
            </form>

            <div className="module-list-card">
                <div className="results-header" style={{borderBottom: '1px solid var(--border-color)', marginBottom: '10px'}}>
                    Showing {logs.length} of {totalItems} log entries (Page {currentPage} of {totalPages})
                </div>
                {loading ? (
                    <div className="flex-center" style={{padding: '40px'}}>
                        <div className="spinner"></div>
                        <p>Loading history...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="empty-state">
                        <FiClock />
                        <h3>No Logs Found</h3>
                        <p>No log entries found matching criteria.</p>
                    </div>
                ) : (
                    <ul className="timeline-list" style={{padding: '0 10px', maxHeight: '70vh', overflowY: 'auto'}}>
                        {logs.map((log) => (
                            <li className="timeline-item" key={log.id} style={{gap: '1rem', paddingBottom: '1rem'}}>
                                <div className="timeline-icon" style={{width: '32px', height: '32px', fontSize: '1rem'}}>
                                    <FiClock /> 
                                </div>
                                <div className="timeline-content">
                                    <div className="timeline-header">
                                        <strong>{log.action.replace(/_/g, ' ')}</strong>
                                        <span className="timeline-user">
                                            <FiUsers style={{marginRight: '5px'}}/> {log.username}
                                        </span>
                                    </div>
                                    <p className="timeline-details" style={{fontSize: '0.9rem'}}>
                                        {log.details || `Target Type: ${log.target_type}, Target ID: ${log.target_id}`}
                                    </p>
                                    <span className="timeline-timestamp" style={{fontSize: '0.75rem'}}>
                                        {formatTimestamp(log.timestamp)}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            
            {totalItems > ITEMS_PER_PAGE && (
                <div className="pagination-controls">
                    <button 
                        className="btn btn-secondary"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1 || loading}
                    >
                        &larr; Previous
                    </button>
                    
                    <span className="pagination-info">
                        Page {currentPage} of {totalPages} ({totalItems} total)
                    </span>

                    <button 
                        className="btn btn-secondary"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages || loading}
                    >
                        Next &rarr;
                    </button>
                </div>
            )}
        </div>
    );
}

export default SystemAuditLogPage;
