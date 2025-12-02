const { ipcMain } = require('electron');
const { getDb } = require('../db/database.cjs');

function registerAnalyticsHandlers() {
  /**
   * Get advanced analytics data
   */
  ipcMain.handle('get-advanced-analytics', async (event, timeRange) => {
    const db = getDb();
    
    try {
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      
      switch (timeRange) {
        case '3months':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case '6months':
          startDate.setMonth(now.getMonth() - 6);
          break;
        case '1year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        case 'all':
          startDate = new Date('2000-01-01');
          break;
        default:
          startDate.setMonth(now.getMonth() - 6);
      }

      // Total Candidates
      const totalCandidates = await new Promise((resolve, reject) => {
        db.get(
          'SELECT COUNT(*) as count FROM candidates WHERE created_at >= ?',
          [startDate.toISOString()],
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      // Total Placements
      const totalPlacements = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM candidates 
           WHERE status = 'placed' AND updated_at >= ?`,
          [startDate.toISOString()],
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      // Active Job Orders
      const activeJobOrders = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM job_orders 
           WHERE status = 'active'`,
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      // Registration Trend (Monthly)
      const registrationTrend = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
            strftime('%m', created_at) as month,
            COUNT(*) as count
           FROM candidates
           WHERE created_at >= date('now', '-12 months')
           GROUP BY strftime('%m', created_at)
           ORDER BY month`,
          (err, rows) => {
            if (err) reject(err);
            else {
              const months = Array(12).fill(0);
              rows.forEach(row => {
                months[parseInt(row.month) - 1] = row.count;
              });
              resolve(months);
            }
          }
        );
      });

      // Placement Trend (Monthly)
      const placementTrend = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
            strftime('%m', updated_at) as month,
            COUNT(*) as count
           FROM candidates
           WHERE status = 'placed' AND updated_at >= date('now', '-12 months')
           GROUP BY strftime('%m', updated_at)
           ORDER BY month`,
          (err, rows) => {
            if (err) reject(err);
            else {
              const months = Array(12).fill(0);
              rows.forEach(row => {
                months[parseInt(row.month) - 1] = row.count;
              });
              resolve(months);
            }
          }
        );
      });

      // Candidate Status Distribution
      const candidateStatus = await new Promise((resolve, reject) => {
        db.all(
          `SELECT status, COUNT(*) as count
           FROM candidates
           GROUP BY status`,
          (err, rows) => {
            if (err) reject(err);
            else {
              const statusMap = {
                active: 0,
                placed: 0,
                'in-process': 0,
                'on-hold': 0,
                inactive: 0
              };
              rows.forEach(row => {
                statusMap[row.status] = row.count;
              });
              resolve(Object.values(statusMap));
            }
          }
        );
      });

      // Job Orders by Industry
      const jobOrdersByIndustry = await new Promise((resolve, reject) => {
        db.all(
          `SELECT industry, COUNT(*) as count
           FROM job_orders
           WHERE status = 'active'
           GROUP BY industry
           ORDER BY count DESC
           LIMIT 6`,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(r => r.count));
          }
        );
      });

      return {
        totalCandidates,
        totalPlacements,
        activeJobOrders,
        totalRevenue: '825K', // Calculate from placements if you track revenue
        registrationTrend,
        placementTrend,
        candidateStatus,
        jobOrdersByIndustry,
        placementRates: [85, 72, 68, 78, 65], // Calculate from actual data
        timeToPlacement: [15, 35, 45, 25, 10], // Calculate from placement dates
        revenueTrend: [45000, 52000, 48000, 65000, 58000, 72000, 68000, 78000, 75000, 85000, 82000, 95000]
      };

    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw error;
    }
  });

  /**
   * Export analytics data
   */
  ipcMain.handle('export-analytics', async (event, format) => {
    // Implement PDF/Excel export logic
    console.log(`Exporting analytics as ${format}`);
    return { success: true };
  });
}

module.exports = { registerAnalyticsHandlers };
