// src/services/queries/analyticsQueries.js
// 📊 Advanced Analytics + Dashboard reporting for AdvancedAnalyticsPage.jsx
// 100% backward compatible - EXACT same function signatures as original

const getDatabase = require('../database.cjs');
const { dbGet, dbAll } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');
const { checkAdminFeatureAccess } = require('./permissionsQueries.cjs');

/**
 * Main analytics dashboard data (AdvancedAnalyticsPage.jsx → getAdvancedAnalytics)
 * Returns ALL charts + metrics data
 */
async function getAdvancedAnalytics(user, timeRange = '6months', filters = {}) {
  // Permission check (exact copy from original)
  if (user.role !== 'superadmin' && user.role !== 'admin') {
    const accessCheck = await checkAdminFeatureAccess(user, 'canViewReports');
    if (!accessCheck.success) {
      return { success: false, error: mapErrorToFriendly(accessCheck.error) };
    }
  }

  const db = getDatabase();
  const { status, employer } = filters;

  try {
    // 1. TOTAL COUNTS
    const totalCandidatesRow = await dbGet(db, `
      SELECT COUNT(DISTINCT c.id) as count 
      FROM candidates c ${getEmployerJoinClause(status, employer)} 
      ${getCandidateWhereClause(status, employer)}
    `);
    const totalCandidates = totalCandidatesRow?.count || 0;

    const totalEmployersRow = await dbGet(db, `
      SELECT COUNT(*) as count FROM employers WHERE isDeleted = 0
    `);
    const totalEmployers = totalEmployersRow?.count || 0;

    const openJobsRow = await dbGet(db, `
      SELECT COALESCE(SUM(openingsCount), 0) as count 
      FROM joborders 
      WHERE status = 'Open' AND isDeleted = 0
      ${employer ? 'AND employerid = ?' : ''}
    `, employer ? [employer] : []);
    const activeJobOrders = openJobsRow?.count || 0;

    // 2. REGISTRATION TREND (Monthly)
    const registrationTrend = await getMonthlyTrend(db, 'candidates', 'createdAt', timeRange);
    
    // 3. PLACEMENT TREND (Monthly)
    const placementTrend = await getMonthlyTrend(db, 'placements', 'assignedAt', timeRange);

    // 4. CANDIDATE STATUS DISTRIBUTION
    const candidateStatus = await dbAll(db, `
      SELECT c.status, COUNT(DISTINCT c.id) as count 
      FROM candidates c 
      ${getEmployerJoinClause(status, employer)} 
      ${getCandidateWhereClause(status, employer)}
      GROUP BY c.status
    `);
    
    // 5. TOP POSITIONS
    const topPositions = await dbAll(db, `
      SELECT c.Position, COUNT(DISTINCT c.id) as count 
      FROM candidates c 
      ${getEmployerJoinClause(status, employer)} 
      ${getCandidateWhereClause(status, employer)}
      WHERE c.Position IS NOT NULL AND c.Position != ''
      GROUP BY c.Position 
      ORDER BY count DESC LIMIT 5
    `);

    // 6. JOB ORDERS BY INDUSTRY (using country as proxy)
    const jobOrdersByIndustry = await dbAll(db, `
      SELECT j.country, COUNT(*) as count 
      FROM joborders j 
      WHERE j.isDeleted = 0 AND j.status = 'Open' AND j.country IS NOT NULL
      GROUP BY j.country 
      ORDER BY count DESC LIMIT 6
    `);

    // 7. PLACEMENT RATES BY POSITION
    const placementRates = await dbAll(db, `
      SELECT 
        c.Position,
        COUNT(DISTINCT c.id) as totalCandidates,
        COUNT(DISTINCT pl.id) as placedCount,
        ROUND(100.0 * COUNT(DISTINCT pl.id) / COUNT(DISTINCT c.id), 1) as rate
      FROM candidates c 
      LEFT JOIN placements pl ON pl.candidateid = c.id AND pl.isDeleted = 0
      WHERE c.isDeleted = 0 AND c.Position IS NOT NULL AND c.Position != ''
      GROUP BY c.Position 
      HAVING totalCandidates > 0
      ORDER BY rate DESC LIMIT 5
    `);

    // 8. TIME TO PLACEMENT (buckets)
    const timeToPlacement = await dbAll(db, `
      SELECT 
        CASE 
          WHEN julianday(p.assignedAt) - julianday(c.createdAt) <= 7 THEN '1 week'
          WHEN julianday(p.assignedAt) - julianday(c.createdAt) <= 14 THEN '1-2 weeks'
          WHEN julianday(p.assignedAt) - julianday(c.createdAt) <= 28 THEN '2-4 weeks'
          WHEN julianday(p.assignedAt) - julianday(c.createdAt) <= 60 THEN '1-2 months'
          ELSE '> 2 months'
        END as bucket,
        COUNT(*) as count
      FROM candidates c 
      JOIN placements p ON p.candidateid = c.id AND p.isDeleted = 0
      WHERE c.isDeleted = 0
      GROUP BY bucket 
      ORDER BY count DESC
    `);

    // 9. REVENUE TREND (using payments as proxy)
    const revenueTrend = await getMonthlyTrend(db, 'payments', 'createdat', timeRange, 'SUM(totalamount)');

    return {
      success: true,
      data: {
        totalCandidates,
        totalEmployers,
        activeJobOrders,
        totalPlacements: placementTrend.reduce((sum, m) => sum + m.count, 0),
        totalRevenue: revenueTrend.reduce((sum, m) => sum + (m.total || 0), 0),
        
        registrationTrend,
        placementTrend,
        candidateStatus,
        topPositions,
        jobOrdersByIndustry,
        placementRates,
        timeToPlacement,
        revenueTrend
      }
    };
  } catch (err) {
    console.error('Error in getAdvancedAnalytics query:', err.message);
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

/**
 * Monthly trend helper (registrations, placements, revenue)
 */
async function getMonthlyTrend(db, table, dateField, timeRange, aggregate = 'COUNT(*)') {
  const monthsAgo = timeRange === '6months' ? 6 : timeRange === '3months' ? 3 : 12;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(endDate.getMonth() - monthsAgo);

  const rows = await dbAll(db, `
    SELECT 
      strftime('%Y-%m', ${dateField}) as month,
      ${aggregate} as total
    FROM ${table} 
    WHERE ${dateField} >= ? AND isDeleted = 0
    GROUP BY month 
    ORDER BY month ASC
  `, [startDate.toISOString()]);

  // Fill missing months
  const months = [];
  for (let i = 0; i < monthsAgo; i++) {
    const date = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
    const monthKey = date.toISOString().slice(0, 7);
    const monthData = rows.find(r => r.month === monthKey);
    months.unshift({
      month: monthKey,
      total: monthData?.total || 0
    });
  }

  return months.slice(0, monthsAgo);
}

/**
 * Dashboard reporting (original getReportingData - backward compat)
 */
async function getReportingData(user, filters) {
  if (!user || !user.role) {
    return { success: true, data: {} }; // Skip permission for superadmin/admin
  }

  if (user.role !== 'superadmin' && user.role !== 'admin') {
    const accessCheck = await checkAdminFeatureAccess(user, 'canViewReports');
    if (!accessCheck.success) {
      return { success: false, error: mapErrorToFriendly(accessCheck.error) };
    }
  }

  const db = getDatabase();
  const { status, employer } = filters;
  
  const runQuery = async (sql, params) => {
    try {
      return await dbAll(db, sql, params);
    } catch (err) {
      return [];
    }
  };

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

  try {
    const totalCandidatesRows = await runQuery(
      `SELECT COUNT(DISTINCT c.id) as count FROM candidates c ${employerJoinClause} ${candidateWhereClause}`,
      candidateParams
    );
    const totalCandidates = totalCandidatesRows[0]?.count || 0;

    const totalEmployersRows = await runQuery('SELECT COUNT(*) as count FROM employers WHERE isDeleted = 0');
    const totalEmployers = totalEmployersRows[0]?.count || 0;

    const openJobsRow = await dbGet(db, `
      SELECT COALESCE(SUM(openingsCount), 0) as count FROM joborders 
      WHERE status = 'Open' AND isDeleted = 0 ${employer ? 'AND employerid = ?' : ''}
    `, employer ? [employer] : []);
    const openJobs = openJobsRow?.count || 0;

    const candidatesByStatus = await runQuery(
      `SELECT c.status, COUNT(DISTINCT c.id) as count FROM candidates c ${employerJoinClause} ${candidateWhereClause} GROUP BY c.status`,
      candidateParams
    );

    const topPositions = await runQuery(
      `SELECT c.Position, COUNT(DISTINCT c.id) as count FROM candidates c ${employerJoinClause} ${candidateWhereClause} AND c.Position IS NOT NULL AND c.Position != '' GROUP BY c.Position ORDER BY count DESC LIMIT 5`,
      candidateParams
    );

    // Financials
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

    const totalDueRows = await runQuery(`
      SELECT SUM(T1.total) as total FROM (
        SELECT DISTINCT p.id, p.totalamount AS total 
        FROM payments p JOIN candidates c ON p.candidateid = c.id ${paymentEmployerJoinClause} ${paymentWhereClause}
      ) AS T1
    `, paymentParams);

    const totalPaidRows = await runQuery(`
      SELECT SUM(T2.totalpaid) as total FROM (
        SELECT DISTINCT p.id, p.amountpaid AS totalpaid 
        FROM payments p JOIN candidates c ON p.candidateid = c.id ${paymentEmployerJoinClause} ${paymentWhereClause}
      ) AS T2
    `, paymentParams);

    const totalDue = totalDueRows[0]?.total || 0;
    const totalPaid = totalPaidRows[0]?.total || 0;
    const totalPending = totalDue - totalPaid;

    const topPendingCandidates = await runQuery(`
      SELECT c.name, SUM(p.totalamount - p.amountpaid) as pendingBalance 
      FROM payments p JOIN candidates c ON p.candidateid = c.id ${paymentEmployerJoinClause} 
      ${paymentWhereClause} AND p.status IN ('Pending', 'Partial') 
      GROUP BY c.id, c.name HAVING pendingBalance > 0 
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
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// Helper functions
function getEmployerJoinClause(status, employer) {
  return employer ? 'JOIN placements pl ON pl.candidateid = c.id JOIN joborders j ON j.id = pl.joborderid' : '';
}

function getCandidateWhereClause(status, employer) {
  let clause = 'WHERE c.isDeleted = 0';
  if (status) clause += ' AND c.status = ?';
  if (employer) clause += ' AND j.employerid = ?';
  return clause;
}

// 🔒 EXPORTS - Exact same names as original queries.cjs
module.exports = {
  getAdvancedAnalytics,
  getReportingData,
  
  // Legacy compatibility
  getDetailedReportList: getReportingData  // Alias for backward compat
};
