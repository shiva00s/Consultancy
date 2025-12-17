// src/services/queries/reportsQueries.js
// 📊 Comprehensive Reporting for ReportsPage.jsx
// getReportingData + getDetailedReportList + permission checks

const getDatabase = require('../database.cjs');
const { dbGet, dbAll } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');
const { checkAdminFeatureAccess, getSuperAdminFeatureFlags } = require('./authQueries.cjs');

/**
 * Dashboard + Reports summary stats (ReportsPage.jsx → getReportingData)
 * Admin/SuperAdmin only via canViewReports permission
 */
async function getReportingData(user, filters = {}) {
  // Skip permission check for superadmin/admin (existing logic)
  if (user?.role !== 'superadmin' && user?.role !== 'admin') {
    const accessCheck = await checkAdminFeatureAccess(user, 'canViewReports');
    if (!accessCheck.success) {
      return {
        success: false,
        error: mapErrorToFriendly(accessCheck.error)
      };
    }
  }

  const db = getDatabase();
  const { status, employer } = filters;
  
  const runQuery = (sql, params) => dbAll(db, sql, params);

  // Candidate stats
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

  // Payment stats
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
      FROM candidates c 
      ${employerJoinClause} 
      ${candidateWhereClause}
    `, candidateParams);
    const totalCandidates = totalCandidatesRows[0]?.count || 0;

    // Total employers
    const totalEmployersRows = await runQuery(
      'SELECT COUNT(*) as count FROM employers WHERE isDeleted = 0'
    );
    const totalEmployers = totalEmployersRows[0]?.count || 0;

    // Open jobs
    let openJobsSql = `
      SELECT COALESCE(SUM(openingsCount), 0) as count 
      FROM joborders 
      WHERE status = 'Open' AND isDeleted = 0
    `;
    const openJobsParams = [];
    if (employer) {
      openJobsSql += ' AND employerid = ?';
      openJobsParams.push(employer);
    }
    const openJobsRow = await dbGet(db, openJobsSql, openJobsParams);
    const openJobs = openJobsRow?.count || 0;

    // Candidates by status
    const candidatesByStatus = await runQuery(`
      SELECT c.status, COUNT(DISTINCT c.id) as count 
      FROM candidates c 
      ${employerJoinClause} 
      ${candidateWhereClause} 
      GROUP BY c.status
    `, candidateParams);

    // Top positions
    const topPositions = await runQuery(`
      SELECT c.Position, COUNT(DISTINCT c.id) as count 
      FROM candidates c 
      ${employerJoinClause} 
      ${candidateWhereClause} 
      AND c.Position IS NOT NULL AND c.Position != '' 
      GROUP BY c.Position 
      ORDER BY count DESC LIMIT 5
    `, candidateParams);

    // Financial totals
    const totalDueRows = await runQuery(`
      SELECT SUM(T1.total) as total 
      FROM (
        SELECT DISTINCT p.id, p.totalamount AS total 
        FROM payments p 
        JOIN candidates c ON p.candidateid = c.id 
        ${paymentEmployerJoinClause} 
        ${paymentWhereClause}
      ) AS T1
    `, paymentParams);
    const totalDue = totalDueRows[0]?.total || 0;

    const totalPaidRows = await runQuery(`
      SELECT SUM(T2.totalpaid) as total 
      FROM (
        SELECT DISTINCT p.id, p.amountpaid AS totalpaid 
        FROM payments p 
        JOIN candidates c ON p.candidateid = c.id 
        ${paymentEmployerJoinClause} 
        ${paymentWhereClause}
      ) AS T2
    `, paymentParams);
    const totalPaid = totalPaidRows[0]?.total || 0;

    const totalPending = totalDue - totalPaid;

    // Top pending candidates
    const topPendingCandidates = await runQuery(`
      SELECT c.name, SUM(p.totalamount - p.amountpaid) as pendingBalance 
      FROM payments p 
      JOIN candidates c ON p.candidateid = c.id 
      ${paymentEmployerJoinClause} 
      ${paymentWhereClause} 
      AND p.status IN ('Pending', 'Partial') 
      GROUP BY c.id, c.name 
      HAVING pendingBalance > 0 
      ORDER BY pendingBalance DESC LIMIT 5
    `, paymentParams);

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
 * Detailed candidate report list (ReportsPage.jsx → getDetailedReportList)
 * Table view with financials + filters
 */
async function getDetailedReportList(user, filters = {}) {
  // Skip permission check for superadmin/admin
  if (user?.role !== 'superadmin' && user?.role !== 'admin') {
    const accessCheck = await checkAdminFeatureAccess(user, 'canViewReports');
    if (!accessCheck.success) {
      return {
        success: false,
        error: mapErrorToFriendly(accessCheck.error)
      };
    }
  }

  const db = getDatabase();
  const { status, employer } = filters;

  let sql = `
    SELECT 
      c.id, c.name, c.passportNo, c.Position, c.status, c.contact, 
      e.companyName, 
      COALESCE(SUM(p.totalamount), 0) as totalDue, 
      COALESCE(SUM(p.amountpaid), 0) as totalPaid 
    FROM candidates c 
    LEFT JOIN placements pl ON pl.candidateid = c.id AND pl.isDeleted = 0 
    LEFT JOIN joborders j ON pl.joborderid = j.id 
    LEFT JOIN employers e ON j.employerid = e.id 
    LEFT JOIN payments p ON p.candidateid = c.id AND p.isDeleted = 0 
    WHERE c.isDeleted = 0
  `;
  const params = [];

  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }
  if (employer) {
    sql += ' AND e.id = ?';
    params.push(employer);
  }

  sql += ' GROUP BY c.id ORDER BY c.name ASC';

  try {
    const rows = await dbAll(db, sql, params);
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('Detailed Report Query Error:', err.message);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names from ReportsPage.jsx
module.exports = {
  getReportingData,
  getDetailedReportList
};
