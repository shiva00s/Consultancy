// src/services/queries/dashboardQueries.js
// 📊 Dashboard Metrics + Charts for DashboardPage.jsx
// Role-based stats: Staff (basic) vs Admin/SuperAdmin (full analytics)

const getDatabase = require('../database.cjs');
const { dbGet, dbAll } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');
const { checkAdminFeatureAccess } = require('./authQueries.cjs');

/**
 * Main dashboard data (DashboardPage.jsx → getReportingData)
 * Full metrics: candidates, employers, jobs, financials, charts
 */
async function getReportingData(user, filters = {}) {
  // Skip permission check for superadmin/admin
  if (user?.role !== 'superadmin' && user?.role !== 'admin') {
    const accessCheck = await checkAdminFeatureAccess(user, 'canViewReports');
    if (!accessCheck.success) {
      return {
        success: false,
        error: accessCheck.error
      };
    }
  }

  const db = getDatabase();
  const { status, employer } = filters;

  const runQuery = async (sql, params) => dbAll(db, sql, params);

  // Candidate filters
  let candidateWhereClause = 'WHERE c.isDeleted = 0';
  const candidateParams = [];
  let employerJoinClause = '';

  if (status) {
    candidateWhereClause += ' AND c.status = ?';
    candidateParams.push(status);
  }
  if (employer) {
    employerJoinClause = 'JOIN placements pl ON pl.candidateid = c.id JOIN joborders jfilter ON jfilter.id = pl.joborderid';
    candidateWhereClause += ' AND jfilter.employerid = ?';
    candidateParams.push(employer);
  }

  // Payment filters
  let paymentWhereClause = 'WHERE p.isDeleted = 0 AND c.isDeleted = 0';
  const paymentParams = [];
  let paymentEmployerJoinClause = '';

  if (status) {
    paymentWhereClause += ' AND c.status = ?';
    paymentParams.push(status);
  }
  if (employer) {
    paymentEmployerJoinClause = 'JOIN placements pl ON pl.candidateid = c.id JOIN joborders jfilter ON jfilter.id = pl.joborderid';
    paymentWhereClause += ' AND jfilter.employerid = ?';
    paymentParams.push(employer);
  }

  try {
    // Total candidates
    const totalCandidatesRows = await runQuery(`
      SELECT COUNT(DISTINCT c.id) as count 
      FROM candidates c ${employerJoinClause} ${candidateWhereClause}
    `, candidateParams);
    const totalCandidates = totalCandidatesRows[0]?.count || 0;

    // Total employers
    const totalEmployersRows = await dbGet(db, `
      SELECT COUNT(*) as count FROM employers WHERE isDeleted = 0
    `);
    const totalEmployers = totalEmployersRows?.count || 0;

    // Open jobs
    let openJobsSql = `
      SELECT COALESCE(SUM(openingsCount), 0) as count 
      FROM joborders WHERE status = 'Open' AND isDeleted = 0
    `;
    let openJobsParams = [];
    if (employer) {
      openJobsSql += ' AND employerid = ?';
      openJobsParams.push(employer);
    }
    const openJobsRow = await dbGet(db, openJobsSql, openJobsParams);
    const openJobs = openJobsRow?.count || 0;

    // Candidates by status (Doughnut chart)
    const candidatesByStatus = await runQuery(`
      SELECT c.status, COUNT(DISTINCT c.id) as count 
      FROM candidates c ${employerJoinClause} ${candidateWhereClause} 
      GROUP BY c.status
    `, candidateParams);

    // Top positions (Bar chart)
    const topPositions = await runQuery(`
      SELECT c.Position, COUNT(DISTINCT c.id) as count 
      FROM candidates c ${employerJoinClause} ${candidateWhereClause} 
      AND c.Position IS NOT NULL AND c.Position != '' 
      GROUP BY c.Position 
      ORDER BY count DESC LIMIT 5
    `, candidateParams);

    // Financials (Admin+ only)
    let totalDue = 0, totalPaid = 0, totalPending = 0;
    let topPendingCandidates = [];

    if (user?.role === 'superadmin' || user?.role === 'admin') {
      const totalDueRows = await runQuery(`
        SELECT SUM(T1.total) as total FROM (
          SELECT DISTINCT p.id, p.totalamount AS total 
          FROM payments p 
          JOIN candidates c ON p.candidateid = c.id 
          ${paymentEmployerJoinClause} ${paymentWhereClause}
        ) AS T1
      `, paymentParams);
      totalDue = totalDueRows[0]?.total || 0;

      const totalPaidRows = await runQuery(`
        SELECT SUM(T2.totalpaid) as total FROM (
          SELECT DISTINCT p.id, p.amountpaid AS totalpaid 
          FROM payments p 
          JOIN candidates c ON p.candidateid = c.id 
          ${paymentEmployerJoinClause} ${paymentWhereClause}
        ) AS T2
      `, paymentParams);
      totalPaid = totalPaidRows[0]?.total || 0;

      totalPending = totalDue - totalPaid;

      topPendingCandidates = await runQuery(`
        SELECT c.name, SUM(p.totalamount - p.amountpaid) as pendingBalance 
        FROM payments p 
        JOIN candidates c ON p.candidateid = c.id 
        ${paymentEmployerJoinClause} ${paymentWhereClause} 
        AND p.status IN ('Pending', 'Partial') 
        GROUP BY c.id, c.name 
        HAVING pendingBalance > 0 
        ORDER BY pendingBalance DESC LIMIT 5
      `, paymentParams);
    }

    return {
      success: true,
      data: {
        totalCandidates,
        totalEmployers,
        openJobs,
        candidatesByStatus,
        topPositions,
        totalDue,
        totalPaid,
        totalPending,
        topPendingCandidates
      }
    };
  } catch (err) {
    console.error('Error in getReportingData query:', err.message);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Quick staff stats (no financials, no permissions needed)
 */
async function getStaffDashboardStats() {
  const db = getDatabase();
  try {
    const stats = await dbGet(db, `
      SELECT 
        (SELECT COUNT(*) FROM candidates WHERE isDeleted = 0) as totalCandidates,
        (SELECT COUNT(*) FROM candidates WHERE status = 'New' AND isDeleted = 0) as newCandidates,
        (SELECT COUNT(*) FROM candidates WHERE status = 'Completed' AND isDeleted = 0) as completedCandidates
    `);

    return {
      success: true,
      data: {
        totalCandidates: stats?.totalCandidates || 0,
        newCandidates: stats?.newCandidates || 0,
        completedCandidates: stats?.completedCandidates || 0
      }
    };
  } catch (err) {
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Recent activity (all roles)
 */
async function getRecentActivity(limit = 10) {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT 'candidate' as type, id, name as title, createdAt, status 
      FROM candidates 
      WHERE isDeleted = 0 
      ORDER BY createdAt DESC 
      LIMIT ?
    `, [limit]);

    return {
      success: true,
      data: rows
    };
  } catch (err) {
    return {
      success: false,
      error: mapErrorToFriendly(err),
      data: []
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler name from DashboardPage.jsx
module.exports = {
  // Main dashboard (charts + financials)
  getReportingData,
  
  // Staff-only quick stats
  getStaffDashboardStats,
  
  // Recent activity feed
  getRecentActivity,
  
  // Legacy compatibility
  getDashboardStats: getReportingData
};
