import React, { useState, useEffect, useCallback } from 'react';
import { FiUsers, FiDollarSign, FiCheckCircle, FiAlertTriangle, FiSearch, FiDownload, FiFileText } from 'react-icons/fi';
import "../css/ReportsPage.css";
import ReportWidget from '../components/ReportWidget';
import { formatCurrency } from '../utils/format.js'; 
import useDataStore from '../store/dataStore';
import toast from 'react-hot-toast';
import useAuthStore from '../store/useAuthStore'; // <-- NEW IMPORT
import { useShallow } from 'zustand/react/shallow'; // <-- NEW IMPORT

const statusOptions = [
  'New', 'Documents Collected', 'Visa Applied', 'In Progress', 'Completed', 'Rejected',
];

function ReportsPage() {
  const { user } = useAuthStore(useShallow(state => ({ user: state.user })));
  const { employers } = useDataStore(state => ({ employers: state.employers }));
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [reportList, setReportList] = useState([]); // Store detailed list
  
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [employerFilter, setEmployerFilter] = useState('');

  const fetchData = useCallback(async () => {
      setLoading(true); // Must start loading here
      
      // 1. Fetch Aggregate Stats
      const statsRes = await window.electronAPI.getReportingData({ 
          user: user, 
          status: statusFilter, 
          employer: employerFilter 
      });
      
      // 2. Fetch Detailed Candidate List
      const listRes = await window.electronAPI.getDetailedReportList({
          user: user, 
          status: statusFilter, 
          employer: employerFilter 
      });

      // --- CRITICAL FIX: Robust State Setting ---
      if (statsRes.success && listRes.success) {
        setStats(statsRes.data);
        // Ensure list data exists and is an array, otherwise default to []
        setReportList(Array.isArray(listRes.data) ? listRes.data : []); 
        
        if (statusFilter || employerFilter) {
            if (listRes.data && listRes.data.length > 0) {
                toast.success(`Found ${listRes.data.length} records matching criteria.`);
            } else {
                toast.error('No matching records found.');
            }
        }
      } else {
        // On API failure, stop loading, clear list, and show error
        setStats(null);
        setReportList([]); 
        toast.error(statsRes.error || listRes.error || 'Failed to fetch report data.');
      }
      setLoading(false);
    }, [user, statusFilter, employerFilter]); // Keep user as dependency for initial fetch

    
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleFilterSubmit = (e) => {
    if (e) e.preventDefault();
    fetchData();
  };

  const handleClearFilters = () => {
    setStatusFilter('');
    setEmployerFilter('');
  };

  const handleExport = () => {
      alert('Exporting detailed list to Excel... (Pending Implementation)');
  };

  if (loading && !stats) return <p className="loading-text">Generating Report...</p>;
  if (!stats) return <h2>No data available.</h2>;

  return (
    <div className="reports-page-container">
      <div className="reports-header">
          <h1>Comprehensive Activity Report</h1>
          
          {/* Filter Bar */}
          <form className="report-filter-bar" onSubmit={handleFilterSubmit}>
            <div className="filter-field">
              <FiSearch />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                {statusOptions.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
              </select>
            </div>

            <div className="filter-field">
              <FiSearch />
              <select value={employerFilter} onChange={(e) => setEmployerFilter(e.target.value)}>
                <option value="">All Employers</option>
                {employers.map(emp => (<option key={emp.id} value={emp.id}>{emp.companyName}</option>))}
              </select>
            </div>
            
            <button type="submit" className="btn btn-primary">Apply Filters</button>
            <button type="button" className="btn btn-danger" onClick={handleClearFilters}>Clear</button>
            <button type="button" className="btn btn-secondary" onClick={handleExport}><FiDownload /> Export</button>
          </form>
      </div>

      {/* --- DETAILED RESULTS TABLE (Main Content) --- */}
      <div className="report-results-section">
          <h3><FiFileText /> Detailed Report ({reportList.length} Records)</h3>
          <div className="report-table-container">
              <table className="report-table">
                  <thead>
                      <tr>
                          <th>Candidate Name</th>
                          <th>Passport No</th>
                          <th>Position</th>
                          <th>Employer</th>
                          <th>Status</th>
                          <th>Total Due</th>
                          <th>Total Paid</th>
                          <th>Balance</th>
                      </tr>
                  </thead>
                  <tbody>
                      {reportList.length === 0 ? (
                          <tr><td colSpan="8" style={{textAlign: 'center', padding: '2rem'}}>No records found matching criteria.</td></tr>
                      ) : (
                          reportList.map(row => (
                              <tr key={row.id}>
                                  <td><strong>{row.name}</strong></td>
                                  <td>{row.passportNo}</td>
                                  <td>{row.Position || '-'}</td>
                                  <td>{row.companyName || 'Unassigned'}</td>
                                  <td><span className={`status-badge badge-${row.status === 'New' ? 'cyan' : 'grey'}`}>{row.status}</span></td>
                                  <td>{formatCurrency(row.totalDue)}</td>
                                  <td style={{color: 'var(--success-color)'}}>{formatCurrency(row.totalPaid)}</td>
                                  <td style={{color: 'var(--danger-color)', fontWeight: 'bold'}}>
                                      {formatCurrency(row.totalDue - row.totalPaid)}
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {/* --- SUMMARY CARDS (Moved to Bottom) --- */}
      <div className="report-summary-footer">
        <h3>Summary Totals</h3>
        <div className="report-widget-grid">
            <ReportWidget
            icon={<FiDollarSign />}
            title="Total Invoiced"
            value={formatCurrency(stats.totalDue)}
            color="blue"
            />
            <ReportWidget
            icon={<FiCheckCircle />}
            title="Total Collected"
            value={formatCurrency(stats.totalPaid)}
            color="green"
            />
            <ReportWidget
            icon={<FiAlertTriangle />}
            title="Total Pending"
            value={formatCurrency(stats.totalPending)}
            color="yellow"
            />
            <ReportWidget
            icon={<FiUsers />}
            title="Active Candidates"
            value={stats.totalCandidates}
            color="purple"
            />
        </div>
      </div>

    </div>
  );
}

export default ReportsPage;