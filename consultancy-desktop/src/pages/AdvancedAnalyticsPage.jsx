import React, { useState, useEffect } from 'react';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import DoughnutChart from '../components/charts/DoughnutChart';
import '../css/AdvancedAnalytics.css';

const AdvancedAnalyticsPage = () => {
  const [timeRange, setTimeRange] = useState('6months');
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // Call your IPC handler to get analytics data
      const data = await window.api.getAdvancedAnalytics(timeRange);
      setAnalyticsData(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Candidate Registration Trend Data
  const registrationTrendData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Candidates Registered',
        data: analyticsData?.registrationTrend || [12, 19, 15, 25, 22, 30, 28, 35, 32, 40, 38, 45],
        borderColor: 'rgb(102, 126, 234)',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Placements',
        data: analyticsData?.placementTrend || [8, 12, 10, 18, 15, 22, 20, 25, 23, 30, 28, 35],
        borderColor: 'rgb(118, 75, 162)',
        backgroundColor: 'rgba(118, 75, 162, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  // Job Orders by Industry
  const jobOrdersByIndustryData = {
    labels: ['IT & Software', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Education'],
    datasets: [
      {
        label: 'Active Job Orders',
        data: analyticsData?.jobOrdersByIndustry || [45, 28, 35, 22, 18, 15],
        backgroundColor: [
          'rgba(102, 126, 234, 0.8)',
          'rgba(118, 75, 162, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
        ],
      },
    ],
  };

  // Candidate Status Distribution
  const candidateStatusData = {
    labels: ['Active', 'Placed', 'In Process', 'On Hold', 'Inactive'],
    datasets: [
      {
        data: analyticsData?.candidateStatus || [120, 85, 45, 25, 15],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(102, 126, 234, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(156, 163, 175, 0.8)',
        ],
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  };

  // Placement Rate by Position
  const placementRateData = {
    labels: ['Software Engineer', 'Data Analyst', 'Project Manager', 'Business Analyst', 'QA Engineer'],
    datasets: [
      {
        label: 'Placement Rate (%)',
        data: analyticsData?.placementRates || [85, 72, 68, 78, 65],
        backgroundColor: 'rgba(102, 126, 234, 0.8)',
      },
    ],
  };

  // Revenue Trend
  const revenueTrendData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Revenue ($)',
        data: analyticsData?.revenueTrend || [45000, 52000, 48000, 65000, 58000, 72000, 68000, 78000, 75000, 85000, 82000, 95000],
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  // Time to Placement
  const timeToPlacementData = {
    labels: ['< 1 week', '1-2 weeks', '2-4 weeks', '1-2 months', '> 2 months'],
    datasets: [
      {
        label: 'Number of Placements',
        data: analyticsData?.timeToPlacement || [15, 35, 45, 25, 10],
        backgroundColor: 'rgba(118, 75, 162, 0.8)',
      },
    ],
  };

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="spinner"></div>
        <p>Loading Analytics...</p>
      </div>
    );
  }

  return (
    <div className="advanced-analytics-page">
      <div className="analytics-header">
        <div>
          <h1>📊 Advanced Analytics</h1>
          <p>Comprehensive insights into your consultancy operations</p>
        </div>
        <div className="time-range-selector">
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            <option value="3months">Last 3 Months</option>
            <option value="6months">Last 6 Months</option>
            <option value="1year">Last Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">👥</div>
          <div className="metric-content">
            <div className="metric-value">{analyticsData?.totalCandidates || 290}</div>
            <div className="metric-label">Total Candidates</div>
            <div className="metric-change positive">+12% this month</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon">✅</div>
          <div className="metric-content">
            <div className="metric-value">{analyticsData?.totalPlacements || 85}</div>
            <div className="metric-label">Total Placements</div>
            <div className="metric-change positive">+8% this month</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon">💼</div>
          <div className="metric-content">
            <div className="metric-value">{analyticsData?.activeJobOrders || 45}</div>
            <div className="metric-label">Active Job Orders</div>
            <div className="metric-change">+5 new</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <div className="metric-value">${analyticsData?.totalRevenue || '825K'}</div>
            <div className="metric-label">Total Revenue</div>
            <div className="metric-change positive">+15% this quarter</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Registration & Placement Trend */}
        <div className="chart-card large">
          <div className="chart-header">
            <h3>Registration & Placement Trends</h3>
            <span className="chart-subtitle">Monthly overview of candidate registrations and placements</span>
          </div>
          <div className="chart-container" style={{ height: '350px' }}>
            <LineChart data={registrationTrendData} />
          </div>
        </div>

        {/* Candidate Status Distribution */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Candidate Status</h3>
            <span className="chart-subtitle">Current distribution</span>
          </div>
          <div className="chart-container" style={{ height: '300px' }}>
            <DoughnutChart data={candidateStatusData} />
          </div>
        </div>

        {/* Job Orders by Industry */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Job Orders by Industry</h3>
            <span className="chart-subtitle">Active job orders</span>
          </div>
          <div className="chart-container" style={{ height: '300px' }}>
            <BarChart data={jobOrdersByIndustryData} horizontal={true} />
          </div>
        </div>

        {/* Revenue Trend */}
        <div className="chart-card large">
          <div className="chart-header">
            <h3>Revenue Trend</h3>
            <span className="chart-subtitle">Monthly revenue growth</span>
          </div>
          <div className="chart-container" style={{ height: '300px' }}>
            <LineChart data={revenueTrendData} />
          </div>
        </div>

        {/* Placement Rate by Position */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Placement Rate by Position</h3>
            <span className="chart-subtitle">Success rate percentage</span>
          </div>
          <div className="chart-container" style={{ height: '300px' }}>
            <BarChart data={placementRateData} />
          </div>
        </div>

        {/* Time to Placement */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Time to Placement</h3>
            <span className="chart-subtitle">Average placement duration</span>
          </div>
          <div className="chart-container" style={{ height: '300px' }}>
            <BarChart data={timeToPlacementData} />
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="analytics-footer">
        <button className="btn-secondary" onClick={() => window.api.exportAnalytics('pdf')}>
          📄 Export as PDF
        </button>
        <button className="btn-secondary" onClick={() => window.api.exportAnalytics('excel')}>
          📊 Export as Excel
        </button>
        <button className="btn-secondary" onClick={loadAnalyticsData}>
          🔄 Refresh Data
        </button>
      </div>
    </div>
  );
};

export default AdvancedAnalyticsPage;
