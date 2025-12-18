// src/pages/DashboardPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { 
  FiCheckCircle, 
  FiUser, 
  FiPackage, 
  FiUsers, 
  FiServer, 
  FiClipboard, 
  FiDollarSign, 
  FiTrendingUp, 
  FiArrowRight,
  FiRefreshCw,
  FiAlertCircle
} from 'react-icons/fi';
import '../css/DashboardPage.css';
import { formatCurrency } from '../utils/format';
import useAuthStore from '../store/useAuthStore'; 
import { useShallow } from 'zustand/react/shallow'; 
import DoughnutChart from '../components/charts/DoughnutChart'; 
import BarChart from '../components/charts/BarChart'; 

function DashboardPage() {
  const navigate = useNavigate(); 
  const { user } = useAuthStore(useShallow(state => ({ user: state.user })));
  
  const [stats, setStats] = useState(null); // Changed to null to detect no data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const isStaff = user && user.role === 'staff';

  // Helper function - safely get status count
  const getStatusCount = useCallback((statusName) => {
    if (!stats || !stats.byStatus || !Array.isArray(stats.byStatus)) return 0;
    const status = stats.byStatus.find((s) => s.status === statusName);
    return status ? status.count : 0;
  }, [stats]);
  
  // Fetch Stats - Only Real Data
  const fetchStats = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setError('User not authenticated');
      return; 
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await window.electronAPI.getReportingData({ user }); 
      
      if (result.success && result.data) {
        // Only set stats if we have valid data
        setStats({
          totalCandidates: result.data.totalCandidates || 0,
          byStatus: Array.isArray(result.data.candidatesByStatus) ? result.data.candidatesByStatus : [],
          totalEmployers: result.data.totalEmployers || 0, 
          openJobs: result.data.openJobs || 0,             
          topPositions: Array.isArray(result.data.topPositions) ? result.data.topPositions : [], 
          totalDue: result.data.totalDue || 0,         
          totalPaid: result.data.totalPaid || 0,       
          totalPending: result.data.totalPending || 0, 
          topPendingCandidates: Array.isArray(result.data.topPendingCandidates) ? result.data.topPendingCandidates : [], 
        });
      } else {
        setError(result.error || 'Failed to fetch dashboard data');
        setStats(null);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('An error occurred while fetching data');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Navigation Handlers
  const goToSearch = (status = '') => {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    navigate(`/search${query}`);
  };

  const goToJobs = () => navigate('/jobs');
  const goToEmployers = () => navigate('/employers');
  
  // Chart Data - Only if we have real data
  const statusChartData = stats?.byStatus?.length > 0 ? {
    labels: stats.byStatus.map(s => s.status || 'Unknown'),
    datasets: [{
      data: stats.byStatus.map(s => s.count || 0),
      backgroundColor: [
        '#3b82f6', '#f59e0b', '#8b5cf6', 
        '#ec4899', '#10b981', '#ef4444'
      ],
      hoverBackgroundColor: [
        '#2563eb', '#d97706', '#7c3aed',
        '#db2777', '#059669', '#dc2626'
      ],
      borderWidth: 0,
    }]
  } : null;
  
  const topPositionsChartData = stats?.topPositions?.length > 0 ? {
    labels: stats.topPositions.map(p => p.Position || 'Unknown'),
    datasets: [{
      label: 'Candidates',
      data: stats.topPositions.map(p => p.count || 0),
      backgroundColor: '#3b82f6',
      borderColor: '#2563eb',
      borderWidth: 2,
      borderRadius: 8,
    }]
  } : null;

  // Loading State
  if (loading) {
    return (
      <div className="dashboard-container dashboard-loading">
        <div className="loading-content">
          <FiRefreshCw className="loading-icon" />
          <h2>Loading Dashboard...</h2>
          <p>Please wait while we fetch your data</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !stats) {
    return (
      <div className="dashboard-container dashboard-error">
        <div className="error-content">
          <FiAlertCircle className="error-icon" />
          <h2>Unable to Load Dashboard</h2>
          <p>{error || 'No data available'}</p>
          <button className="btn btn-primary" onClick={fetchStats}>
            <FiRefreshCw /> Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty State Check
  const hasAnyData = stats.totalCandidates > 0 || 
                     stats.totalEmployers > 0 || 
                     stats.openJobs > 0;

  if (!hasAnyData) {
    return (
      <div className="dashboard-container dashboard-empty">
        <div className="empty-content">
          <FiClipboard className="empty-icon" />
          <h2>No Data Available</h2>
          <p>Start by adding candidates, employers, or job orders to see your dashboard statistics.</p>
          <div className="empty-actions">
            <button className="btn btn-primary" onClick={() => navigate('/add-candidate')}>
              <FiUser /> Add Candidate
            </button>
            {!isStaff && (
              <>
                <button className="btn btn-secondary" onClick={() => navigate('/add-employer')}>
                  <FiServer /> Add Employer
                </button>
                <button className="btn btn-secondary" onClick={() => navigate('/add-job')}>
                  <FiClipboard /> Add Job Order
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Staff Stats Grid
  const staffStatsGrid = (
    <>
      <div className="stat-card blue clickable" onClick={() => goToSearch()}>
        <div className="stat-card-icon">
          <FiUsers />
        </div>
        <div className="stat-card-info">
          <p>Total Candidates</p>
          <span>{stats.totalCandidates}</span>
        </div>
      </div>
      
      <div className="stat-card green clickable" onClick={() => goToSearch('Completed')}>
        <div className="stat-card-icon">
          <FiCheckCircle />
        </div>
        <div className="stat-card-info">
          <p>Completed</p>
          <span>{getStatusCount('Completed')}</span>
        </div>
      </div>

      <div className="stat-card purple clickable" onClick={() => goToSearch('New')}>
        <div className="stat-card-icon">
          <FiUser />
        </div>
        <div className="stat-card-info">
          <p>New Entries</p>
          <span>{getStatusCount('New')}</span>
        </div>
      </div>
    </>
  );

  // Manager Stats Grid
  const managerStatsGrid = (
    <>
      <div className="stat-card blue clickable" onClick={() => goToSearch()}>
        <div className="stat-card-icon">
          <FiUsers />
        </div>
        <div className="stat-card-info">
          <p>Total Candidates</p>
          <span>{stats.totalCandidates}</span>
        </div>
      </div>

      <div className="stat-card purple clickable" onClick={goToEmployers}>
        <div className="stat-card-icon">
          <FiServer />
        </div>
        <div className="stat-card-info">
          <p>Total Employers</p>
          <span>{stats.totalEmployers}</span>
        </div>
      </div>

      <div className="stat-card green clickable" onClick={goToJobs}>
        <div className="stat-card-icon">
          <FiClipboard />
        </div>
        <div className="stat-card-info">
          <p>Open Jobs</p> 
          <span>{stats.openJobs}</span>
        </div>
      </div>

      <div className="stat-card yellow clickable" onClick={() => goToSearch('Visa Applied')}>
        <div className="stat-card-icon">
          <FiPackage />
        </div>
        <div className="stat-card-info">
          <p>Visa Processing</p>
          <span>{getStatusCount('Visa Applied') + getStatusCount('In Progress')}</span>
        </div>
      </div>
    </>
  );

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <button className="btn btn-secondary" onClick={fetchStats} title="Refresh data">
          <FiRefreshCw /> Refresh
        </button>
      </div>
      
      {/* Stats Grid */}
      <div className="stats-grid">
        {isStaff ? staffStatsGrid : managerStatsGrid}
      </div>
      
      {/* Charts Section */}
      <div className="charts-grid">
        {/* Candidate Status Chart */}
        <div className="dashboard-section-card">
          <h3>
            <FiUsers /> Candidate Status
          </h3>
          <div className="chart-container">
            {statusChartData ? (
              <DoughnutChart 
                data={statusChartData} 
                options={{ 
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {
                        padding: 15,
                        usePointStyle: true,
                      }
                    }
                  }
                }} 
              />
            ) : (
              <div className="chart-empty">
                <FiAlertCircle />
                <p>No status data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Positions Chart */}
        <div className="dashboard-section-card">
          <h3>
            <FiTrendingUp /> Top Positions
          </h3>
          <div className="chart-container">
            {topPositionsChartData ? (
              <BarChart 
                data={topPositionsChartData} 
                options={{ 
                  indexAxis: 'y', 
                  maintainAspectRatio: false, 
                  scales: { 
                    x: { 
                      beginAtZero: true,
                      grid: {
                        display: false
                      }
                    },
                    y: {
                      grid: {
                        display: false
                      }
                    }
                  },
                  plugins: {
                    legend: {
                      display: false
                    }
                  }
                }} 
              />
            ) : (
              <div className="chart-empty">
                <FiAlertCircle />
                <p>No position data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Status Breakdown */}
      {stats.byStatus.length > 0 && (
        <div className="status-breakdown">
          <h3>Candidate Status Breakdown</h3>
          <ul>
            {stats.byStatus.map((status) => (
              <li 
                key={status.status} 
                onClick={() => goToSearch(status.status)} 
                className="clickable-list-item"
                title="Click to view candidates"
              >
                <span className="status-name">{status.status || 'Unknown'}</span>
                <div className="status-count-wrapper">
                  <span className="status-count">{status.count}</span>
                  <FiArrowRight className="arrow-icon" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Financial Section (Admin/SuperAdmin Only) */}
      {!isStaff && (
        <>
          {/* Financial Snapshot */}
          {(stats.totalDue > 0 || stats.totalPaid > 0 || stats.totalPending > 0) && (
            <div className="financial-snapshot dashboard-section-card">
              <h3>
                <FiDollarSign /> Financial Snapshot
              </h3>
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
              
              {stats.topPendingCandidates.length > 0 && (
                <>
                  <h4 className="mt-4">Top 3 Pending Balances</h4>
                  <ul className="report-list">
                    {stats.topPendingCandidates.slice(0, 3).map((item, index) => (
                      <li key={`${item.name}-${index}`}>
                        <span>{item.name}</span>
                        <strong className="report-list-value danger-text">
                          {formatCurrency(item.pendingBalance)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {/* Top Positions List */}
          {stats.topPositions.length > 0 && (
            <div className="top-positions-breakdown dashboard-section-card">
              <h3>
                <FiTrendingUp /> Top 5 Recruitment Positions
              </h3>
              <ul className="report-list">
                {stats.topPositions.map((item, index) => (
                  <li key={`${item.Position}-${index}`}>
                    <span>{item.Position}</span>
                    <strong className="report-list-value">{item.count}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default DashboardPage;
