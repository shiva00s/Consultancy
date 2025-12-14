const { getDatabase } = require('../database.cjs');
const { dbGet, dbAll } = require('./dbHelpers.cjs');
const { checkAdminFeatureAccess } = require('./userAuthQueries.cjs'); // Import from new modular file

async function getReportingData(user, filters = {}) {
    if (!user || !user.role) {
      return { success: true, data: {} }; 
    }
  
    const accessCheck = await checkAdminFeatureAccess(user, 'canViewReports');
    if (!accessCheck.success) return accessCheck;
    
    const db = getDatabase();
    const { status, employer } = filters;
    
    const runQuery = (sql, params = []) => dbAll(db, sql, params);
    
    let candidateWhereClause = ' WHERE c.isDeleted = 0 ';
    const candidateParams = [];
    let employerJoinClause = '';

    if (status) {
      candidateWhereClause += ' AND c.status = ? ';
      candidateParams.push(status);
    }
    
    if (employer) {
      employerJoinClause = `
        LEFT JOIN placements pl ON pl.candidate_id = c.id
        LEFT JOIN job_orders j_filter ON j_filter.id = pl.job_order_id
      `;
      candidateWhereClause += ' AND j_filter.employer_id = ? ';
      candidateParams.push(employer);
    }
  
    let paymentWhereClause = ' WHERE p.isDeleted = 0 AND c.isDeleted = 0 ';
    const paymentParams = [];
    let paymentEmployerJoinClause = '';
  
    if (status) {
      paymentWhereClause += ' AND c.status = ? ';
      paymentParams.push(status);
    }
  
    if (employer) {
      paymentEmployerJoinClause = `
        LEFT JOIN placements pl ON pl.candidate_id = c.id
        LEFT JOIN job_orders j_filter ON j_filter.id = pl.job_order_id
      `;
      paymentWhereClause += ' AND j_filter.employer_id = ? ';
      paymentParams.push(employer);
    }
  
    try {
      const totalCandidatesRows = await runQuery(
        `SELECT COUNT(DISTINCT c.id) as count 
         FROM candidates c 
         ${employerJoinClause} 
         ${candidateWhereClause}`,
        candidateParams
      );
      const totalCandidates = totalCandidatesRows[0]?.count || 0;
      
      const totalEmployersRows = await runQuery('SELECT COUNT(*) as count FROM employers WHERE isDeleted = 0');
      const totalEmployers = totalEmployersRows[0]?.count || 0;
  
      let openJobsSql = "SELECT COALESCE(SUM(openingsCount), 0) as count FROM job_orders WHERE status = 'Open' AND isDeleted = 0";
      const openJobsParams = [];
      if (employer) {
        openJobsSql += ' AND employer_id = ?';
        openJobsParams.push(employer);
      }
      const openJobsRows = await runQuery(openJobsSql, openJobsParams);
      const openJobs = openJobsRows[0]?.count || 0;

      const candidatesByStatus = await runQuery(
        `SELECT c.status, COUNT(DISTINCT c.id) as count 
         FROM candidates c 
         ${employerJoinClause} 
         ${candidateWhereClause} 
         GROUP BY c.status`,
        candidateParams
      );

      let jobsByStatusSql = `SELECT status, COUNT(*) as count FROM job_orders WHERE isDeleted = 0`;
      const jobsByStatusParams = [];
      if (employer) {
        jobsByStatusSql += ' AND employer_id = ?';
        jobsByStatusParams.push(employer);
      }
      const jobsByStatus = await runQuery(`${jobsByStatusSql} GROUP BY status`, jobsByStatusParams);
  
      const topPositions = await runQuery(
        `SELECT c.Position, COUNT(DISTINCT c.id) as count 
         FROM candidates c 
         ${employerJoinClause} 
         ${candidateWhereClause} 
         AND c.Position IS NOT NULL AND c.Position != '' 
         GROUP BY c.Position 
         ORDER BY count DESC 
         LIMIT 5`,
        candidateParams
      );
  
      const totalDueRows = await runQuery(
        `SELECT COALESCE(SUM(T1.total), 0) as total 
         FROM (
              SELECT DISTINCT p.id, p.total_amount AS total
              FROM payments p 
              JOIN candidates c ON p.candidate_id = c.id 
              ${paymentEmployerJoinClause} 
              ${paymentWhereClause}
         ) AS T1`,
        paymentParams
      );
      const totalDue = totalDueRows[0]?.total || 0;
      
      const totalPaidRows = await runQuery(
        `SELECT COALESCE(SUM(T2.total_paid), 0) as total 
         FROM (
              SELECT DISTINCT p.id, p.amount_paid AS total_paid
              FROM payments p 
              JOIN candidates c ON p.candidate_id = c.id 
              ${paymentEmployerJoinClause} 
              ${paymentWhereClause}
         ) AS T2`,
        paymentParams
      );
      const totalPaid = totalPaidRows[0]?.total || 0;
      const totalPending = totalDue - totalPaid;

      const topPendingCandidates = await runQuery(
        `SELECT 
           c.name, 
           SUM(p.total_amount - p.amount_paid) as pendingBalance
         FROM payments p
         JOIN candidates c ON p.candidate_id = c.id
         ${paymentEmployerJoinClause}
         ${paymentWhereClause}
         AND p.status IN ('Pending', 'Partial')
         GROUP BY c.id, c.name
         HAVING pendingBalance > 0
         ORDER BY pendingBalance DESC
         LIMIT 5
       `, paymentParams);

      return {
        success: true,
        data: {
          totalCandidates, totalEmployers, openJobs, candidatesByStatus,
          topPositions, totalDue, totalPaid, totalPending, topPendingCandidates, jobsByStatus
        }
      };
    } catch (err) {
      console.error("Error in getReportingData query:", err.message);
      return { success: false, error: err.message };
    }
}

async function getDetailedReportList(user, filters = {}) {
    const accessCheck = await checkAdminFeatureAccess(user, 'canViewReports');
    if (!accessCheck.success) return accessCheck; 
    
    const db = getDatabase();
    const { status, employer } = filters;
    
    let sql = `
      SELECT 
        c.id, c.name, c.passportNo, c.Position, c.status,
        e.companyName,
        COALESCE(SUM(p.total_amount), 0) as totalDue,
        COALESCE(SUM(p.amount_paid), 0) as totalPaid
      FROM candidates c
      
      LEFT JOIN placements pl ON pl.candidate_id = c.id AND pl.isDeleted = 0
      LEFT JOIN job_orders j ON pl.job_order_id = j.id
      LEFT JOIN employers e ON j.employer_id = e.id
      LEFT JOIN payments p ON p.candidate_id = c.id AND p.isDeleted = 0
      
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
      return { success: true, data: rows };
    } catch (err) {
      console.error("Detailed Report Query Error:", err.message);
      return { success: false, error: err.message };
    }
}

async function getDashboardStats() {
    const db = getDatabase();
    try {
        const counts = await dbGet(db, `
            SELECT 
                (SELECT COUNT(*) FROM candidates WHERE isDeleted IS NOT 1) as candidates,
                (SELECT COUNT(*) FROM job_orders WHERE status = 'Open' AND isDeleted IS NOT 1) as jobs,
                (SELECT COUNT(*) FROM employers WHERE isDeleted IS NOT 1) as employers,
                (SELECT COUNT(*) FROM candidates WHERE status = 'New' AND isDeleted IS NOT 1) as newCandidates
        `, []);
        return { success: true, data: counts };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// NEW: Advanced Report - Candidate Timeline Analysis
async function getCandidateTimelineReport(user, filters = {}) {
    const accessCheck = await checkAdminFeatureAccess(user, 'canViewReports');
    if (!accessCheck.success) return accessCheck;
    
    const db = getDatabase();
    const { startDate, endDate, status } = filters;
    
    let sql = `
        SELECT 
            DATE(c.createdAt) as date,
            COUNT(c.id) as registrations,
            SUM(CASE WHEN c.status = 'Placed' THEN 1 ELSE 0 END) as placements,
            AVG(JULIANDAY('now') - JULIANDAY(c.createdAt)) as avgDaysInSystem
        FROM candidates c
        WHERE c.isDeleted = 0
    `;
    const params = [];
    
    if (startDate) {
        sql += ' AND c.createdAt >= ?';
        params.push(startDate);
    }
    if (endDate) {
        sql += ' AND c.createdAt <= ?';
        params.push(endDate);
    }
    if (status) {
        sql += ' AND c.status = ?';
        params.push(status);
    }
    
    sql += ' GROUP BY DATE(c.createdAt) ORDER BY date DESC';
    
    try {
        const rows = await dbAll(db, sql, params);
        return { success: true, data: rows };
    } catch (err) {
        console.error('Timeline Report Error:', err.message);
        return { success: false, error: err.message };
    }
}

// NEW: Financial Summary Report
async function getFinancialSummaryReport(user, filters = {}) {
    const accessCheck = await checkAdminFeatureAccess(user, 'isFinanceTrackingEnabled');
    if (!accessCheck.success) return accessCheck;
    
    const db = getDatabase();
    const { startDate, endDate, employer } = filters;
    
    let sql = `
        SELECT 
            e.companyName,
            COUNT(DISTINCT c.id) as totalCandidates,
            SUM(p.total_amount) as totalRevenue,
            SUM(p.amount_paid) as totalCollected,
            SUM(p.total_amount - p.amount_paid) as totalPending
        FROM payments p
        JOIN candidates c ON p.candidate_id = c.id
        LEFT JOIN placements pl ON pl.candidate_id = c.id
        LEFT JOIN job_orders j ON j.id = pl.job_order_id
        LEFT JOIN employers e ON e.id = j.employer_id
        WHERE p.isDeleted = 0 AND c.isDeleted = 0
    `;
    const params = [];
    
    if (startDate) {
        sql += ' AND p.created_at >= ?';
        params.push(startDate);
    }
    if (endDate) {
        sql += ' AND p.created_at <= ?';
        params.push(endDate);
    }
    if (employer) {
        sql += ' AND e.id = ?';
        params.push(employer);
    }
    
    sql += ' GROUP BY e.id, e.companyName ORDER BY totalRevenue DESC';
    
    try {
        const rows = await dbAll(db, sql, params);
        return { success: true, data: rows };
    } catch (err) {
        console.error('Financial Summary Report Error:', err.message);
        return { success: false, error: err.message };
    }
}

// NEW: Visa Processing Status Report
async function getVisaProcessingReport(user, filters = {}) {
    const accessCheck = await checkAdminFeatureAccess(user, 'isVisaTrackingEnabled');
    if (!accessCheck.success) return accessCheck;
    
    const db = getDatabase();
    const { country, status, startDate, endDate } = filters;
    
    let sql = `
        SELECT 
            v.id,
            c.name as candidateName,
            c.passportNo,
            v.country,
            v.visa_type as visaType,
            v.status,
            v.application_date as applicationDate,
            JULIANDAY('now') - JULIANDAY(v.application_date) as daysInProcess
        FROM visa_tracking v
        JOIN candidates c ON v.candidate_id = c.id
        WHERE v.isDeleted = 0 AND c.isDeleted = 0
    `;
    const params = [];
    
    if (country) {
        sql += ' AND v.country = ?';
        params.push(country);
    }
    if (status) {
        sql += ' AND v.status = ?';
        params.push(status);
    }
    if (startDate) {
        sql += ' AND v.application_date >= ?';
        params.push(startDate);
    }
    if (endDate) {
        sql += ' AND v.application_date <= ?';
        params.push(endDate);
    }
    
    sql += ' ORDER BY v.application_date DESC';
    
    try {
        const rows = await dbAll(db, sql, params);
        return { success: true, data: rows };
    } catch (err) {
        console.error('Visa Processing Report Error:', err.message);
        return { success: false, error: err.message };
    }
}

// NEW: Employer Performance Report
async function getEmployerPerformanceReport(user, filters = {}) {
    const accessCheck = await checkAdminFeatureAccess(user, 'canViewReports');
    if (!accessCheck.success) return accessCheck;
    
    const db = getDatabase();
    const { startDate, endDate } = filters;
    
    let sql = `
        SELECT 
            e.id,
            e.companyName,
            e.country,
            COUNT(DISTINCT j.id) as totalJobs,
            SUM(j.openingsCount) as totalOpenings,
            COUNT(DISTINCT pl.candidate_id) as totalPlacements,
            ROUND(COUNT(DISTINCT pl.candidate_id) * 100.0 / NULLIF(SUM(j.openingsCount), 0), 2) as fillRate
        FROM employers e
        LEFT JOIN job_orders j ON j.employer_id = e.id AND j.isDeleted = 0
        LEFT JOIN placements pl ON pl.job_order_id = j.id AND pl.isDeleted = 0
        WHERE e.isDeleted = 0
    `;
    const params = [];
    
    if (startDate) {
        sql += ' AND j.createdAt >= ?';
        params.push(startDate);
    }
    if (endDate) {
        sql += ' AND j.createdAt <= ?';
        params.push(endDate);
    }
    
    sql += ' GROUP BY e.id, e.companyName, e.country ORDER BY totalPlacements DESC';
    
    try {
        const rows = await dbAll(db, sql, params);
        return { success: true, data: rows };
    } catch (err) {
        console.error('Employer Performance Report Error:', err.message);
        return { success: false, error: err.message };
    }
}

// NEW: Document Compliance Report
async function getDocumentComplianceReport(user) {
    const accessCheck = await checkAdminFeatureAccess(user, 'canViewReports');
    if (!accessCheck.success) return accessCheck;
    
    const db = getDatabase();
    
    try {
        // Get required documents
        const requiredDocs = await dbAll(db, 
            'SELECT name FROM required_documents WHERE isDeleted = 0', []);
        const requiredDocNames = requiredDocs.map(d => d.name);
        
        // Get all candidates with their document count
        const sql = `
            SELECT 
                c.id,
                c.name,
                c.passportNo,
                c.status,
                COUNT(DISTINCT d.id) as uploadedDocsCount
            FROM candidates c
            LEFT JOIN documents d ON d.candidate_id = c.id AND d.isDeleted = 0
            WHERE c.isDeleted = 0
            GROUP BY c.id, c.name, c.passportNo, c.status
            ORDER BY uploadedDocsCount ASC
        `;
        
        const rows = await dbAll(db, sql, []);
        
        // Calculate compliance for each candidate
        const enhanced = rows.map(row => ({
            ...row,
            requiredDocsCount: requiredDocNames.length,
            complianceRate: requiredDocNames.length > 0 
                ? Math.round((row.uploadedDocsCount / requiredDocNames.length) * 100) 
                : 100,
            isCompliant: row.uploadedDocsCount >= requiredDocNames.length
        }));
        
        return { success: true, data: enhanced };
    } catch (err) {
        console.error('Document Compliance Report Error:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    getReportingData,
    getDetailedReportList,
    getDashboardStats,
    getCandidateTimelineReport,
    getFinancialSummaryReport,
    getVisaProcessingReport,
    getEmployerPerformanceReport,
    getDocumentComplianceReport,
};
