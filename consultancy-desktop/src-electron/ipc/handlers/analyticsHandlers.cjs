const { ipcMain } = require("electron");
const { getDatabase } = require("../../db/database.cjs");

function registerAnalyticsHandlers() {
  /**
   * Get advanced analytics data
   */
  ipcMain.handle("get-advanced-analytics", async (event, timeRange) => {
    const db = getDatabase();

    try {
      // Calculate date range
      const now = new Date();
      let startDate = new Date();

      switch (timeRange) {
        case "3months":
          startDate.setMonth(now.getMonth() - 3);
          break;
        case "6months":
          startDate.setMonth(now.getMonth() - 6);
          break;
        case "1year":
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        case "all":
          startDate = new Date("2000-01-01");
          break;
        default:
          startDate.setMonth(now.getMonth() - 6);
      }

      // Total Candidates
      const totalCandidates = await new Promise((resolve, reject) => {
        db.get(
          "SELECT COUNT(*) as count FROM candidates WHERE createdAt >= ?",
          [startDate.toISOString()],
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          },
        );
      });

      // Total Placements
      const totalPlacements = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM candidates
           WHERE status = 'placed' AND createdAt >= ?`,
          [startDate.toISOString()],
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          },
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
          },
        );
      });

      // Registration Trend (Monthly)
      const registrationTrend = await new Promise((resolve, reject) => {
        db.all(
          `SELECT
            strftime('%m', createdAt) as month,
            COUNT(*) as count
           FROM candidates
           WHERE createdAt >= date('now', '-12 months')
           GROUP BY strftime('%m', createdAt)
           ORDER BY month`,
          (err, rows) => {
            if (err) reject(err);
            else {
              const months = Array(12).fill(0);
              rows.forEach((row) => {
                months[parseInt(row.month) - 1] = row.count;
              });
              resolve(months);
            }
          },
        );
      });

      // Placement Trend (Monthly)
      const placementTrend = await new Promise((resolve, reject) => {
        db.all(
          `SELECT
            strftime('%m', createdAt) as month,
            COUNT(*) as count
           FROM candidates
           WHERE status = 'placed' AND createdAt >= date('now', '-12 months')
           GROUP BY strftime('%m', createdAt)
           ORDER BY month`,
          (err, rows) => {
            if (err) reject(err);
            else {
              const months = Array(12).fill(0);
              rows.forEach((row) => {
                months[parseInt(row.month) - 1] = row.count;
              });
              resolve(months);
            }
          },
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
                "in-process": 0,
                "on-hold": 0,
                inactive: 0,
              };
              rows.forEach((row) => {
                if (statusMap.hasOwnProperty(row.status)) {
                  statusMap[row.status] = row.count;
                }
              });
              resolve([
                statusMap.active,
                statusMap.placed,
                statusMap["in-process"],
                statusMap["on-hold"],
                statusMap.inactive,
              ]);
            }
          },
        );
      });

      // Placement Rates
      const placementRates = await new Promise((resolve, reject) => {
        db.all(
          `SELECT
            strftime('%Y-%m', createdAt) as month,
            CAST(SUM(CASE WHEN status = 'placed' THEN 1 ELSE 0 END) AS REAL) * 100 / COUNT(*) as rate
           FROM candidates
           WHERE createdAt >= date('now', '-6 months')
           GROUP BY month
           ORDER BY month`,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map((row) => row.rate));
          },
        );
      });

      // Job Orders by Position
      const jobOrdersByIndustry = await new Promise((resolve, reject) => {
        db.all(
          `SELECT positionTitle, COUNT(*) as count
           FROM job_orders
           WHERE status = 'Open' AND isDeleted = 0
           GROUP BY positionTitle
           ORDER BY count DESC
           LIMIT 6`,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          },
        );
      });

      return {
        totalCandidates,
        totalPlacements,
        activeJobOrders,
        totalRevenue: await new Promise((resolve, reject) => {
          db.get(
            `SELECT SUM(p.total_amount) as total
             FROM payments p
             JOIN candidates c ON p.candidate_id = c.id
             WHERE c.status = 'placed' AND c.createdAt >= ?`,
            [startDate.toISOString()],
            (err, row) => {
              if (err) reject(err);
              else resolve(row.total || 0);
            },
          );
        }),
        registrationTrend,
        placementTrend,
        candidateStatus,
        jobOrdersByIndustry,
        placementRates,
        timeToPlacement: await new Promise((resolve, reject) => {
          db.all(
            `SELECT
              CASE
                WHEN JULIANDAY(datetime('now')) - JULIANDAY(createdAt) < 7 THEN '< 1 week'
                WHEN JULIANDAY(datetime('now')) - JULIANDAY(createdAt) < 14 THEN '1-2 weeks'
                WHEN JULIANDAY(datetime('now')) - JULIANDAY(createdAt) < 30 THEN '2-4 weeks'
                WHEN JULIANDAY(datetime('now')) - JULIANDAY(createdAt) < 60 THEN '1-2 months'
                ELSE '> 2 months'
              END as time_range,
              COUNT(*) as count
             FROM candidates
             WHERE status = 'placed' AND createdAt >= ?
             GROUP BY time_range
             ORDER BY
               CASE time_range
                 WHEN '< 1 week' THEN 1
                 WHEN '1-2 weeks' THEN 2
                 WHEN '2-4 weeks' THEN 3
                 WHEN '1-2 months' THEN 4
                 WHEN '> 2 months' THEN 5
               END`,
            [startDate.toISOString()],
            (err, rows) => {
              if (err) reject(err);
              else {
                const timeRanges = [0, 0, 0, 0, 0]; // [< 1 week, 1-2 weeks, 2-4 weeks, 1-2 months, > 2 months]
                rows.forEach((row) => {
                  switch (row.time_range) {
                    case "< 1 week":
                      timeRanges[0] = row.count;
                      break;
                    case "1-2 weeks":
                      timeRanges[1] = row.count;
                      break;
                    case "2-4 weeks":
                      timeRanges[2] = row.count;
                      break;
                    case "1-2 months":
                      timeRanges[3] = row.count;
                      break;
                    case "> 2 months":
                      timeRanges[4] = row.count;
                      break;
                  }
                });
                resolve(timeRanges);
              }
            },
          );
        }),
        revenueTrend: await new Promise((resolve, reject) => {
          db.all(
            `SELECT
              strftime('%m', p.created_at) as month,
              SUM(p.total_amount) as revenue
             FROM payments p
             JOIN candidates c ON p.candidate_id = c.id
             WHERE c.status = 'placed' AND p.created_at >= date('now', '-12 months')
             GROUP BY month
             ORDER BY month`,
            (err, rows) => {
              if (err) reject(err);
              else {
                const months = Array(12).fill(0);
                rows.forEach((row) => {
                  months[parseInt(row.month) - 1] = row.revenue || 0;
                });
                resolve(months);
              }
            },
          );
        }),
      };
    } catch (error) {
      console.error("Error fetching analytics:", error);
      throw error;
    }
  });

  /**
   * Export analytics data
   */
  ipcMain.handle("export-analytics", async (event, format) => {
    // Implement PDF/Excel export logic
    console.log(`Exporting analytics as ${format}`);
    return { success: true };
  });
}

module.exports = { registerAnalyticsHandlers };
