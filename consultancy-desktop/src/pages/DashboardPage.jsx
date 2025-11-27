import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { FiCheckCircle ,FiUser, FiPackage ,FiUsers, FiFileText, FiCheckSquare, FiServer, FiClipboard, FiDollarSign, FiTrendingUp, FiArrowRight } from 'react-icons/fi';
import '../css/DashboardPage.css';
import { formatCurrency } from '../utils/format';
import useAuthStore from '../store/useAuthStore'; 
import { useShallow } from 'zustand/react/shallow'; 

function DashboardPage() {
  const navigate = useNavigate(); 
  const { user } = useAuthStore(useShallow(state => ({ user: state.user })));
  const [stats, setStats] = useState({ 
    totalCandidates: 0, 
    byStatus: [],
    totalEmployers: 0, 
    openJobs: 0,      
    topPositions: [], 
    totalDue: 0,      
    totalPaid: 0,     
    totalPending: 0,  
    topPendingCandidates: [], 
  });
  const [loading, setLoading] = useState(true);
  
  const isStaff = user && user.role === 'staff'; // <-- NEW: Role check

  // Helper function remains the same
  const getStatusCount = (statusName) => {
    const status = stats.byStatus.find((s) => s.status === statusName);
    return status ? status.count : 0;
  };
  
  // --- FETCH STATS (Modified to only run if user is present) ---
  const fetchStats = useCallback(async () => {
    // CRITICAL FIX: Only run if user is defined (Fixes timing issue)
    if (!user) {
        setLoading(false);
        return; 
    }

    setLoading(true);
    // CRITICAL FIX: Pass the user object
    const result = await window.electronAPI.getReportingData({ user }); 
    if (result.success) {
      setStats({
        totalCandidates: result.data.totalCandidates,
        byStatus: result.data.candidatesByStatus,
        totalEmployers: result.data.totalEmployers, 
        openJobs: result.data.openJobs,             
        topPositions: result.data.topPositions, 
        totalDue: result.data.totalDue,         
        totalPaid: result.data.totalPaid,       
        totalPending: result.data.totalPending, 
        topPendingCandidates: result.data.topPendingCandidates, 
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, user]);

  // --- NAVIGATION HANDLERS ---
 const goToSearch = (status = '') => {
    // URL Encode ensures spaces in "Visa Applied" don't break the link
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    navigate(`/search${query}`);
  };

  const goToJobs = () => {
    navigate('/jobs');
  };

  const goToEmployers = () => {
    navigate('/employers');
  };
  // ---------------------------

  if (loading) {
    return <h2>Loading Dashboard...</h2>;
  }
  
  // --- CONDITIONAL RENDERING LOGIC ---
  
  // 1. Define Staff-Specific Grid
  const staffStatsGrid = (
      <>
          {/* Total Candidates -> Go to All */}
          <div className="stat-card blue clickable" onClick={() => goToSearch()}>
            <div className="stat-card-icon"> <FiUsers /> </div>
            <div className="stat-card-info">
              <p>Total Candidates</p>
              <span>{stats.totalCandidates}</span>
            </div>
          </div>
          
          {/* Completed -> Go to Status 'Completed' */}
          <div className="stat-card green clickable" onClick={() => goToSearch('Completed')}>
            <div className="stat-card-icon"> <FiCheckCircle /> </div>
            <div className="stat-card-info">
              <p>Completed</p>
              <span>{getStatusCount('Completed')}</span>
            </div>
          </div>

          {/* New Candidates -> Go to Status 'New' */}
          <div className="stat-card purple clickable" onClick={() => goToSearch('New')}>
            <div className="stat-card-icon"> <FiUser /> </div>
            <div className="stat-card-info">
              <p>New Entries</p>
              <span>{getStatusCount('New')}</span>
            </div>
          </div>
      </>
  );

  // 2. Define Admin/SA Grid
  const managerStatsGrid = (
      <>
          {/* Total Candidates */}
          <div className="stat-card blue clickable" onClick={() => goToSearch()}>
            <div className="stat-card-icon"> <FiUsers /> </div>
            <div className="stat-card-info">
              <p>Total Candidates</p>
              <span>{stats.totalCandidates}</span>
            </div>
          </div>

          {/* Employers -> Go to Employer List */}
          <div className="stat-card purple clickable" onClick={goToEmployers}>
            <div className="stat-card-icon"> <FiServer /> </div>
            <div className="stat-card-info">
              <p>Total Employers</p>
              <span>{stats.totalEmployers}</span>
            </div>
          </div>

          {/* Jobs -> Go to Job List */}
          <div className="stat-card green clickable" onClick={goToJobs}>
            <div className="stat-card-icon"> <FiClipboard /> </div>
            <div className="stat-card-info">
              <p>Open Jobs</p> 
              <span>{stats.openJobs}</span>
            </div>
          </div>

          {/* Visa Processing -> Go to 'Visa Applied' + 'In Progress' (Custom logic or just one) */}
          <div className="stat-card yellow clickable" onClick={() => goToSearch('Visa Applied')}>
            <div className="stat-card-icon"> <FiPackage /> </div>
            <div className="stat-card-info">
              <p>Visa Processing</p>
              <span>{getStatusCount('Visa Applied') + getStatusCount('In Progress')}</span>
            </div>
          </div>
      </>
  );

  return (
    <div className="dashboard-container">
      <h1>Dashboard</h1>
      
      {/* --- STATS GRID --- */}
      <div className="stats-grid">
          {isStaff ? staffStatsGrid : managerStatsGrid}
      </div>
      
      {/* --- CANDIDATE STATUS BREAKDOWN (Visible to all) --- */}
      <div className="status-breakdown">
        <h3>Candidate Status Breakdown</h3>
        {stats.byStatus.length > 0 ? (
          <ul>
            {stats.byStatus.map((status) => (
              <li 
                key={status.status} 
                onClick={() => goToSearch(status.status)} 
                className="clickable-list-item"
                title="Click to view candidates"
              >
                <span className="status-name">{status.status || 'N/A'}</span>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <span className="status-count">{status.count}</span>
                    <FiArrowRight style={{opacity: 0.5}}/>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No active candidates found.</p>
        )}
      </div>
      
      {/* --- FINANCIAL SNAPSHOT & TOP POSITIONS (Hidden for Staff) --- */}
      {!isStaff && (
          <>
            {/* Financial Snapshot */}
            <div className="financial-snapshot dashboard-section-card">
              <h3><FiDollarSign /> Financial Snapshot</h3>
              <div className="financial-summary-grid">
                  <div className="summary-stat">
                      <p>Total Invoiced</p>
                      <strong>{formatCurrency(stats.totalDue)}</strong>
                  </div>
                  <div className="summary-stat">
                      <p>Total Collected</p>
                      <strong>{formatCurrency(stats.totalPaid)}</strong>
                  </div>
                  <div className="summary-stat danger-highlight">
                      <p>Pending Balance</p>
                      <strong>{formatCurrency(stats.totalPending)}</strong>
                  </div>
              </div>
              
              <h4 className="mt-4">Top 3 Pending Balances</h4>
              <ul className="report-list">
                {stats.topPendingCandidates.slice(0, 3).length > 0 ? (
                  stats.topPendingCandidates.slice(0, 3).map(item => (
                    // Clicking a pending candidate takes you to their details
                    <li key={item.name}>
                      <span>{item.name}</span>
                      <strong className="report-list-value danger-text">
                        {formatCurrency(item.pendingBalance)}
                      </strong>
                    </li>
                  ))
                ) : <p className="small-text">No significant pending balances.</p>}
              </ul>
            </div>

            {/* Top Positions */}
            <div className="top-positions-breakdown dashboard-section-card">
              <h3><FiTrendingUp /> Top 5 Recruitment Positions</h3>
              <ul className="report-list">
                {stats.topPositions.length > 0 ? (
                  stats.topPositions.map(item => (
                    <li key={item.Position}>
                      <span>{item.Position}</span>
                      <strong className="report-list-value">{item.count}</strong>
                    </li>
                  ))
                ) : <p className="small-text">No positions recorded.</p>}
              </ul>
            </div>
          </>
      )}
      
    </div>
  );
}

export default DashboardPage;