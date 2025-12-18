// ============================================================================
// FILE: src-electron/ipc/passportHandlers.cjs
// ============================================================================

const { ipcMain } = require('electron');
const queries = require('../db/queries.cjs');
const { getDatabase } = require('../db/database.cjs');

/**
 * Helper to log audit trail
 */
function logAction(user, action, targetType, targetId, details = null) {
  try {
    // ✅ Validate inputs before inserting
    if (!user || !user.id) {
      console.warn('⚠️ Audit log skipped: No user provided');
      return;
    }
    
    if (!action) {
      console.error('❌ Audit log error: action is required');
      return;
    }

    if (!targetType) {
      console.error('❌ Audit log error: target_type is required');
      return;
    }

    if (!targetId) {
      console.error('❌ Audit log error: target_id is required');
      return;
    }

    const db = getDatabase();
    
    const sql = `
      INSERT INTO audit_log (user_id, username, action, target_type, target_id, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `;
    
    db.run(
      sql, 
      [
        user.id, 
        user.username || user.fullName || 'Unknown', 
        action.toUpperCase(), // ✅ Normalize action to uppercase
        targetType, 
        targetId, 
        details || null
      ], 
      (err) => {
        if (err) {
          console.error('❌ Audit log failed:', err.message);
        } else {
          console.log(`✅ Audit: ${action} on ${targetType} #${targetId}`);
        }
      }
    );
  } catch (e) {
    console.error('❌ Audit log error:', e.message);
  }
}

// ============================================================================
// REGISTER ALL PASSPORT HANDLERS
// ============================================================================

function registerPassportHandlers() {
  console.log('📋 Registering Passport Movement handlers...');

  // ==========================================================================
  // GET PASSPORT MOVEMENTS FOR A CANDIDATE
  // ==========================================================================
  ipcMain.handle('get-passport-movements', async (event, { candidateId, user }) => {
    try {
      if (!candidateId) {
        return { success: false, error: 'Candidate ID is required' };
      }

      console.log(`📥 Fetching movements for candidate ${candidateId}...`);

      const result = await queries.getPassportMovements(candidateId);
      
      if (result.success) {
        console.log(`✅ Found ${result.data.length} movements`);
        
        // ✅ FIX: Only log if movements were actually fetched
        if (user && user.id && result.data.length > 0) {
          logAction(
            user, 
            'VIEW', 
            'passport_movements', 
            candidateId, // ✅ Use candidateId as target
            `Viewed ${result.data.length} movements`
          );
        }
      }
      
      return result;
    } catch (error) {
      console.error('❌ get-passport-movements error:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================================================
  // ADD NEW PASSPORT MOVEMENT (RECEIVE OR SEND) + PHOTOS
  // ==========================================================================
  ipcMain.handle('add-passport-movement', async (event, { data, user }) => {
    try {
      // Auth check
      if (!user || !user.id) {
        return { success: false, error: 'Authentication required. Please log in.' };
      }

      console.log('📥 Received passport movement data:', {
        candidateId: data.candidate_id || data.candidateId,
        type: data.type || data.movement_type,
        method: data.method,
        date: data.date,
        hasPhotos: data.photos?.length || 0
      });

      // Normalize field names
      const normalizedData = {
        candidate_id: parseInt(data.candidate_id || data.candidateId || data.candidateid),
        type: data.type || data.movement_type || data.movementType,
        method: data.method,
        courier_number: data.courier_number || data.couriernumber || data.courierNumber,
        date: data.date,
        // RECEIVE fields
        received_from: data.received_from || data.receivedfrom || data.receivedFrom,
        received_by: data.received_by || data.receivedby || data.receivedBy,
        // SEND fields
        send_to: data.send_to || data.sendto || data.sendTo,
        send_to_name: data.send_to_name || data.sendtoname || data.sendToName,
        send_to_contact: data.send_to_contact || data.sendtocontact || data.sendToContact,
        sent_by: data.sent_by || data.sentby || data.sentBy,
        // Shared
        notes: data.notes,
        photos: data.photos || [],
        created_by: user.username || user.fullName || user.id
      };

      // ✅ Validate candidate exists
      if (!normalizedData.candidate_id || isNaN(normalizedData.candidate_id)) {
        return { 
          success: false, 
          error: 'Invalid candidate ID provided' 
        };
      }

      const result = await queries.addPassportMovement(normalizedData);
      
      if (!result.success) {
        console.error('❌ Movement insert failed:', result.error);
        return result;
      }

      const movementId = result.data.id;
      console.log(`✅ Movement inserted with ID: ${movementId}, Photos: ${result.data.photo_count}`);
      
      // ✅ FIX: Log audit correctly
      logAction(
        user, 
        'CREATE', 
        'passport_movements', 
        movementId, // ✅ Use movement ID as target
        `Type: ${normalizedData.type}, Candidate: ${normalizedData.candidate_id}, Date: ${normalizedData.date}, Photos: ${result.data.photo_count}`
      );
      
      return { 
        success: true, 
        data: { 
          id: movementId,
          photo_count: result.data.photo_count
        },
        message: 'Passport movement recorded successfully' 
      };
      
    } catch (error) {
      console.error('❌ add-passport-movement error:', error);
      return { success: false, error: error.message };
    }
  });

  // ... (rest of handlers remain the same)

  // ==========================================================================
  // RESTORE DELETED MOVEMENT
  // ==========================================================================
  ipcMain.handle('restore-passport-movement', async (event, { id, user }) => {
    try {
      if (!user || !user.id) {
        return { success: false, error: 'Authentication required. Please log in.' };
      }

      if (!id) {
        return { success: false, error: 'Movement ID is required' };
      }

      console.log(`♻️ Restoring passport movement ID: ${id}...`);

      const db = getDatabase();
      
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE passport_movements SET is_deleted = 0, updated_at = datetime('now','localtime') WHERE id = ?`,
          [id],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });

      // ✅ FIX: Correct audit logging
      logAction(user, 'RESTORE', 'passport_movements', id, 'Movement restored from recycle bin');
      console.log(`✅ Restored passport movement ID: ${id}`);
      
      return { success: true };
    } catch (error) {
      console.error('❌ restore-passport-movement error:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ Passport Movement handlers registered successfully');
}

// ==========================================================================
// GET ALL DELETED MOVEMENTS (GLOBAL RECYCLE BIN)
// ==========================================================================
ipcMain.handle('get-all-deleted-passport-movements', async (event, { user }) => {
  try {
    if (!user || !user.id) {
      return { success: false, error: 'Authentication required. Please log in.' };
    }

    const result = await queries.getAllDeletedPassportMovements();

    if (result.success) {
      console.log(`📋 Found ${result.data.length} deleted passport movements`);
    }

    return result;
  } catch (error) {
    console.error('❌ get-all-deleted-passport-movements error:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  registerPassportHandlers
};
