// ========================================================================
// FILE: src-electron/ipc/communicationHandlers.cjs
// PURPOSE: Handle all Communication History API calls
// ========================================================================

const { ipcMain } = require('electron');
const { getDatabase, dbAll, dbGet, dbRun } = require('../db/database.cjs');

function initializeCommunicationHandlers() {
  
  // NEW: Filtered and paginated communications
  ipcMain.handle('communication:getFiltered', async (event, filters) => {
    try {
      const db = getDatabase();
      const { candidateId, type, startDate, endDate, limit = 50, offset = 0 } = filters;

      // Build WhatsApp query with filters
      let whatsappSql = `
        SELECT 
          wm.id, 
          wm.conversationid, 
          wm.direction, 
          wm.body as message, 
          wm.mediaurl, 
          wm.mediatype, 
          wm.status, 
          wm.timestamp, 
          wm.fromnumber, 
          wm.tonumber,
          wc.candidateid, 
          wc.candidatename, 
          wc.phonenumber,
          'whatsapp' as type
        FROM whatsappmessages wm
        LEFT JOIN whatsappconversations wc ON wm.conversationid = wc.id
        WHERE wm.isdeleted = 0
      `;
      const whatsappParams = [];

      if (candidateId) {
        whatsappSql += ` AND wc.candidateid = ?`;
        whatsappParams.push(candidateId);
      }
      if (startDate) {
        whatsappSql += ` AND wm.timestamp >= ?`;
        whatsappParams.push(startDate);
      }
      if (endDate) {
        whatsappSql += ` AND wm.timestamp <= ?`;
        whatsappParams.push(endDate);
      }

      whatsappSql += ` ORDER BY wm.timestamp DESC`;

      // Build Communication Logs query with filters
      let commLogsSql = `
        SELECT 
          cl.id, 
          cl.candidateid, 
          cl.userid, 
          cl.communicationtype as type, 
          cl.details as message, 
          cl.createdAt as timestamp, 
          cl.metadata,
          c.name as candidatename, 
          c.contact as phonenumber,
          u.username
        FROM communicationlogs cl
        LEFT JOIN candidates c ON cl.candidateid = c.id
        LEFT JOIN users u ON cl.userid = u.id
        WHERE c.isDeleted = 0
      `;
      const commLogsParams = [];

      if (candidateId) {
        commLogsSql += ` AND cl.candidateid = ?`;
        commLogsParams.push(candidateId);
      }
      if (type && type !== 'all' && type !== 'whatsapp') {
        commLogsSql += ` AND cl.communicationtype = ?`;
        commLogsParams.push(type);
      }
      if (startDate) {
        commLogsSql += ` AND cl.createdAt >= ?`;
        commLogsParams.push(startDate);
      }
      if (endDate) {
        commLogsSql += ` AND cl.createdAt <= ?`;
        commLogsParams.push(endDate);
      }

      commLogsSql += ` ORDER BY cl.createdAt DESC`;

      // Fetch data
      const whatsappMessages = (type === 'all' || type === 'whatsapp') 
        ? await dbAll(db, whatsappSql, whatsappParams) 
        : [];
      
      const commLogs = (type === 'all' || type !== 'whatsapp') 
        ? await dbAll(db, commLogsSql, commLogsParams) 
        : [];

      // Combine and format
      const allComms = [
        ...whatsappMessages.map(msg => ({
          id: `wa-${msg.id}`,
          candidateid: msg.candidateid,
          candidatename: msg.candidatename || 'Unknown',
          phonenumber: msg.phonenumber || msg.fromnumber || msg.tonumber,
          type: 'whatsapp',
          direction: msg.direction,
          message: msg.message,
          details: msg.message,
          status: msg.status || 'sent',
          timestamp: msg.timestamp,
          media: msg.mediaurl ? { url: msg.mediaurl, type: msg.mediatype } : null
        })),
        ...commLogs.map(log => {
          let metadata = {};
          try {
            metadata = log.metadata ? JSON.parse(log.metadata) : {};
          } catch (e) { }
          
          return {
            id: `log-${log.id}`,
            candidateid: log.candidateid,
            candidatename: log.candidatename || 'Unknown',
            phonenumber: log.phonenumber,
            type: log.type || 'other',
            message: log.message,
            details: log.message,
            status: metadata.status || 'completed',
            timestamp: log.timestamp,
            username: log.username,
            metadata
          };
        })
      ];

      // Sort by timestamp
      allComms.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Apply pagination
      const paginatedData = allComms.slice(offset, offset + limit);
      const hasMore = (offset + limit) < allComms.length;

      return { 
        success: true, 
        data: paginatedData,
        total: allComms.length,
        hasMore
      };
    } catch (error) {
      console.error('Error fetching filtered communications:', error);
      return { success: false, error: error.message, data: [] };
    }
  });

  // ========================================================================
  // GET ALL COMMUNICATIONS (WhatsApp + Logs)
  // ========================================================================
  ipcMain.handle('communication:getAll', async () => {
    try {
      const db = getDatabase();
      
      // Fetch WhatsApp messages
      const whatsappMessages = await dbAll(db, `
        SELECT 
          wm.id,
          wm.conversation_id,
          wm.direction,
          wm.body as message,
          wm.media_url,
          wm.media_type,
          wm.media_name,
          wm.status,
          wm.timestamp,
          wm.from_number,
          wm.to_number,
          wc.candidate_id,
          wc.candidate_name,
          wc.phone_number,
          'whatsapp' as type
        FROM whatsapp_messages wm
        LEFT JOIN whatsapp_conversations wc ON wm.conversation_id = wc.id
        WHERE wm.is_deleted = 0
        ORDER BY wm.timestamp DESC
      `);

      // Fetch general communication logs
      const commLogs = await dbAll(db, `
        SELECT 
          cl.id,
          cl.candidate_id,
          cl.user_id,
          cl.communication_type as type,
          cl.details as message,
          cl.createdAt as timestamp,
          cl.metadata,
          c.name as candidate_name,
          c.contact as phone_number
        FROM communication_logs cl
        LEFT JOIN candidates c ON cl.candidate_id = c.id
        WHERE c.isDeleted = 0
        ORDER BY cl.createdAt DESC
      `);

      // Combine and format
      const allComms = [
        ...whatsappMessages.map(msg => ({
          id: `wa_${msg.id}`,
          candidate_id: msg.candidate_id,
          candidate_name: msg.candidate_name || 'Unknown',
          phone_number: msg.phone_number || msg.from_number || msg.to_number,
          type: 'whatsapp',
          direction: msg.direction,
          message: msg.message,
          details: msg.message,
          status: msg.status || 'sent',
          timestamp: msg.timestamp,
          media: msg.media_url ? [{
            url: msg.media_url,
            type: msg.media_type,
            name: msg.media_name
          }] : []
        })),
        ...commLogs.map(log => {
          let metadata = {};
          try {
            metadata = log.metadata ? JSON.parse(log.metadata) : {};
          } catch (e) {}

          return {
            id: `log_${log.id}`,
            candidate_id: log.candidate_id,
            candidate_name: log.candidate_name || 'Unknown',
            phone_number: log.phone_number,
            type: log.type || 'other',
            message: log.message,
            details: log.message,
            status: metadata.status || 'completed',
            timestamp: log.timestamp,
            media: []
          };
        })
      ];

      // Sort by timestamp (most recent first)
      allComms.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return { success: true, data: allComms };

    } catch (error) {
      console.error('Error fetching communications:', error);
      return { success: false, error: error.message, data: [] };
    }
  });

  // ========================================================================
  // GET COMMUNICATION STATISTICS
  // ========================================================================
  ipcMain.handle('communication:getStats', async () => {
    try {
      const db = getDatabase();

      // WhatsApp count
      const whatsappResult = await dbGet(db, `
        SELECT COUNT(*) as count 
        FROM whatsapp_messages 
        WHERE is_deleted = 0
      `);

      // Communication logs by type
      const callsResult = await dbGet(db, `
        SELECT COUNT(*) as count 
        FROM communication_logs 
        WHERE communication_type = 'call'
      `);

      const emailsResult = await dbGet(db, `
        SELECT COUNT(*) as count 
        FROM communication_logs 
        WHERE communication_type = 'email'
      `);

      const stats = {
        total: (whatsappResult?.count || 0) + (callsResult?.count || 0) + (emailsResult?.count || 0),
        whatsapp: whatsappResult?.count || 0,
        calls: callsResult?.count || 0,
        emails: emailsResult?.count || 0
      };

      return { success: true, data: stats };

    } catch (error) {
      console.error('Error fetching communication stats:', error);
      return { success: false, error: error.message };
    }
  });

  // ========================================================================
  // EXPORT COMMUNICATIONS TO CSV
  // ========================================================================
  ipcMain.handle('communication:export', async (event, { data, format }) => {
    try {
      const { dialog } = require('electron');
      const fs = require('fs');
      const path = require('path');

      // Show save dialog
      const { filePath } = await dialog.showSaveDialog({
        title: 'Export Communication History',
        defaultPath: `communications_${new Date().toISOString().split('T')[0]}.csv`,
        filters: [
          { name: 'CSV Files', extensions: ['csv'] }
        ]
      });

      if (!filePath) {
        return { success: false, error: 'Export cancelled' };
      }

      // Generate CSV content
      const headers = ['ID', 'Date', 'Time', 'Candidate', 'Phone', 'Type', 'Direction', 'Message', 'Status'];
      const rows = data.map(comm => {
        const date = new Date(comm.timestamp);
        return [
          comm.id,
          date.toLocaleDateString('en-IN'),
          date.toLocaleTimeString('en-IN'),
          comm.candidate_name,
          comm.phone_number,
          comm.type,
          comm.direction || 'N/A',
          (comm.message || '').replace(/"/g, '""'), // Escape quotes
          comm.status
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Write file
      fs.writeFileSync(filePath, csvContent, 'utf8');

      console.log('✅ Communication history exported to:', filePath);
      return { success: true, filePath };

    } catch (error) {
      console.error('❌ Export error:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ Communication IPC handlers registered');
}

module.exports = { initializeCommunicationHandlers };
