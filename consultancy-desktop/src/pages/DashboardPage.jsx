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
  FiRefreshCw 
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
  
  const isStaff = user && user.role === 'staff';

  // Helper function
  const getStatusCount = (statusName) => {
    const status = stats.byStatus.find((s) => s.status === statusName);
    return status ? status.count : 0;
  };
  
  // Fetch Stats
  const fetchStats = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return; 
    }

    setLoading(true);
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

  // Navigation Handlers
  const goToSearch = (status = '') => {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    navigate(`/search${query}`);
  };

  const goToJobs = () => navigate('/jobs');
  const goToEmployers = () => navigate('/employers');
  
  // Chart Data
  const statusChartData = {
    labels: stats.byStatus.map(s => s.status),
    datasets: [{
      data: stats.byStatus.map(s => s.count),
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
  };
  
  const topPositionsChartData = {
    labels: stats.topPositions.map(p => p.Position),
    datasets: [{
      label: 'Candidates',
      data: stats.topPositions.map(p => p.count),
      backgroundColor: '#3b82f6',
      borderColor: '#2563eb',
      borderWidth: 2,
      borderRadius: 8,
    }]
  };

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
      <h1>Dashboard</h1>
      
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
            {stats.byStatus.length > 0 ? (
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
              <p className="small-text">No data available for charting.</p>
            )}
          </div>
        </div>

        {/* Top Positions Chart */}
        <div className="dashboard-section-card">
          <h3>
            <FiTrendingUp /> Top Positions
          </h3>
          <div className="chart-container">
            {stats.topPositions.length > 0 ? (
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
              <p className="small-text">No positions recorded.</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Status Breakdown */}
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
                <div className="status-count-wrapper">
                  <span className="status-count">{status.count}</span>
                  <FiArrowRight className="arrow-icon" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small-text">No active candidates found.</p>
        )}
      </div>
      
      {/* Financial Section (Admin/SuperAdmin Only) */}
      {!isStaff && (
        <>
          {/* Financial Snapshot */}
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
            
            <h4 className="mt-4">Top 3 Pending Balances</h4>
            <ul className="report-list">
              {stats.topPendingCandidates.slice(0, 3).length > 0 ? (
                stats.topPendingCandidates.slice(0, 3).map(item => (
                  <li key={item.name}>
                    <span>{item.name}</span>
                    <strong className="report-list-value danger-text">
                      {formatCurrency(item.pendingBalance)}
                    </strong>
                  </li>
                ))
              ) : (
                <p className="small-text">No significant pending balances.</p>
              )}
            </ul>
          </div>

          {/* Top Positions List */}
          <div className="top-positions-breakdown dashboard-section-card">
            <h3>
              <FiTrendingUp /> Top 5 Recruitment Positions
            </h3>
            <ul className="report-list">
              {stats.topPositions.length > 0 ? (
                stats.topPositions.map(item => (
                  <li key={item.Position}>
                    <span>{item.Position}</span>
                    <strong className="report-list-value">{item.count}</strong>
                  </li>
                ))
              ) : (
                <p className="small-text">No positions recorded.</p>
              )}
            </ul>
          </div> 
        </>
      )}
    </div>
  );
}

export default DashboardPage;