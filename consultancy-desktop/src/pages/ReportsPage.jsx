// ReportsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  FiUsers,
  FiDollarSign,
  FiCheckCircle,
  FiAlertTriangle,
  FiSearch,
  FiDownload,
  FiFileText,
} from 'react-icons/fi';

import '../css/ReportsPage.css';
import ReportWidget from '../components/ReportWidget';
import { formatCurrency } from '../utils/format.js';

import useDataStore from '../store/dataStore';
import toast from 'react-hot-toast';
import useAuthStore from '../store/useAuthStore';

const statusOptions = [
  'New',
  'Documents Collected',
  'Visa Applied',
  'In Progress',
  'Completed',
  'Rejected',
];

function ReportsPage() {
  const user = useAuthStore((state) => state.user);
  const employers = useDataStore((state) => state.employers);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [reportList, setReportList] = useState([]);

  const [statusFilter, setStatusFilter] = useState('');
  const [employerFilter, setEmployerFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);

    const statsRes = await window.electronAPI.getReportingData({
      user,
      status: statusFilter,
      employer: employerFilter,
    });

    const listRes = await window.electronAPI.getDetailedReportList({
      user,
      status: statusFilter,
      employer: employerFilter,
    });

    if (statsRes.success && listRes.success) {
      setStats(statsRes.data);
      setReportList(Array.isArray(listRes.data) ? listRes.data : []);

      if (statusFilter || employerFilter) {
        if (listRes.data?.length > 0) {
          toast.success(`Found ${listRes.data.length} records.`);
        } else {
          toast.error('No matching records found.');
        }
      }
    } else {
      setStats(null);
      setReportList([]);
      toast.error(
        statsRes.error || listRes.error || 'Failed to fetch report data.'
      );
    }

    setLoading(false);
  }, [user, statusFilter, employerFilter]);

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
    toast('Export not implemented yet.');
  };

  if (loading && !stats) {
    return <p className="loading-text">Generating Report...</p>;
  }

  if (!stats) {
    return <h2>No data available.</h2>;
  }

  const getStatusBadgeClass = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'completed') return 'status-badge badge-green';
    if (s === 'rejected') return 'status-badge badge-red';
    if (s === 'in progress' || s === 'visa applied') return 'status-badge badge-amber';
    if (s === 'documents collected') return 'status-badge badge-blue';
    if (s === 'new') return 'status-badge badge-cyan';
    return 'status-badge badge-grey';
  };

  const getBalanceClass = (balance) =>
    balance > 0 ? 'balance-pill balance-overdue' : 'balance-pill balance-clear';

  const getBalanceEmoji = (balance) => {
    if (balance <= 0) return '✅';
    if (balance < 5000) return '🟡';
    return '🔴';
  };

  return (
    <div className="reports-page-container">
      {/* Header + Filters */}
      <div className="reports-header">
        <h1 className="reports-title">Comprehensive Activity Report</h1>

        <form className="report-filter-bar" onSubmit={handleFilterSubmit}>
          {/* Status Filter */}
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

          {/* Employer Filter */}
          <div className="filter-field">
            <FiSearch />
            <select
              value={employerFilter}
              onChange={(e) => setEmployerFilter(e.target.value)}
            >
              <option value="">All Employers</option>
              {employers.map((emp) => (
                <option key={emp.id} value={emp.id}>
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
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExport}
          >
            <FiDownload /> Export
          </button>
        </form>
      </div>

      {/* Detailed Report Table – full height, normal page scroll */}
      <div className="report-results-section">
        <h3 className="report-section-title">
          <FiFileText /> Detailed Report ({reportList.length} Records)
        </h3>

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
                <tr>
                  <td
                    colSpan="8"
                    style={{ textAlign: 'center', padding: '2rem' }}
                  >
                    No records found matching criteria.
                  </td>
                </tr>
              ) : (
                reportList.map((row) => {
                  const totalDue = row.totalDue || 0;
                  const totalPaid = row.totalPaid || 0;
                  const balance = totalDue - totalPaid;
                  const emoji = getBalanceEmoji(balance);

                  return (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td>{row.passportNo}</td>
                      <td>{row.Position || '-'}</td>
                      <td>{row.companyName || 'Unassigned'}</td>
                      <td>
                        <span className={getStatusBadgeClass(row.status)}>
                          {row.status}
                        </span>
                      </td>
                      <td>{formatCurrency(totalDue)}</td>
                      <td className="cell-paid">
                        {formatCurrency(totalPaid)}
                      </td>
                      <td className={getBalanceClass(balance)}>
                        <span className="balance-emoji">{emoji}</span>
                        {formatCurrency(balance)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Widgets */}
      <div className="report-summary-footer">
        <h3 className="report-section-title">Summary Totals</h3>

        <div className="report-widget-grid">
          <ReportWidget
            icon={<FiDollarSign />}
            title="Total Invoiced 💼"
            value={formatCurrency(stats.totalDue)}
            color="blue"
          />
          <ReportWidget
            icon={<FiCheckCircle />}
            title="Total Collected 💰"
            value={formatCurrency(stats.totalPaid)}
            color="green"
          />
          <ReportWidget
            icon={<FiAlertTriangle />}
            title="Total Pending ⏳"
            value={formatCurrency(stats.totalPending)}
            color="yellow"
          />
          <ReportWidget
            icon={<FiUsers />}
            title="Active Candidates 👥"
            value={stats.totalCandidates}
            color="purple"
          />
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;
