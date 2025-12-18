// ============================================================================
// FILE: src-electron/db/passportQueries.cjs
// PURPOSE: Passport Movement Tracking - Unified System
// TABLES: passport_movements, passport_movement_photos
// ============================================================================

const { getDatabase, dbRun, dbGet, dbAll } = require('./database.cjs');

/**
 * Map database errors to user-friendly messages
 */
function mapErrorToFriendly(err) {
  if (!err) return 'Unexpected error occurred.';
  const msg = typeof err === 'string' ? err : (err.message || err.toString());
  
  if (msg.includes('SQLITE_CONSTRAINT') || msg.includes('UNIQUE constraint')) {
    return 'Duplicate entry found. Please check your details.';
  }
  if (msg.includes('FOREIGN KEY constraint')) {
    return 'Referenced record not found. Please verify candidate exists.';
  }
  if (msg.toLowerCase().includes('not found')) {
    return 'Record not found.';
  }
  if (msg.includes('SQLITE_ERROR') || msg.toLowerCase().includes('database')) {
    return 'Database error. Please try again.';
  }
  
  return msg.length > 150 ? 'An error occurred. Please try again.' : msg;
}

// ============================================================================
// GET PASSPORT MOVEMENTS FOR A CANDIDATE
// ============================================================================

async function getPassportMovements(candidateid) {
  const db = getDatabase();
  
  try {
    const sql = `
      SELECT 
        pm.id,
        pm.candidate_id,
        pm.movement_type AS type,
        pm.method,
        pm.courier_number,
        pm.date,
        pm.received_from,
        pm.received_by,
        pm.send_to,
        pm.send_to_name,
        pm.send_to_contact,
        pm.sent_by,
        pm.notes,
        pm.created_by,
        pm.created_at,
        pm.updated_at,
        COUNT(pmp.id) as photo_count
      FROM passport_movements pm
      LEFT JOIN passport_movement_photos pmp ON pm.id = pmp.movement_id
      WHERE pm.candidate_id = ? AND pm.is_deleted = 0
      GROUP BY pm.id
      ORDER BY pm.date DESC, pm.created_at DESC
    `;
    
    const rows = await dbAll(db, sql, [candidateid]);
    
    // Map to frontend format
    const mappedRows = rows.map(row => ({
      id: row.id,
      candidateid: row.candidate_id,
      type: row.type,
      method: row.method,
      courier_number: row.courier_number,
      date: row.date,
      // RECEIVE fields
      received_from: row.received_from,
      received_by: row.received_by,
      // SEND fields
      send_to: row.send_to,
      send_to_name: row.send_to_name,
      send_to_contact: row.send_to_contact,
      sent_by: row.sent_by,
      // Shared
      notes: row.notes,
      // Photos
      has_photos: (row.photo_count || 0) > 0,
      photo_count: row.photo_count || 0,
      // Audit
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    return { success: true, data: mappedRows };
  } catch (err) {
    console.error('❌ getPassportMovements error:', err);
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// ============================================================================
// ADD NEW PASSPORT MOVEMENT (RECEIVE OR SEND) + PHOTOS
// ============================================================================

async function addPassportMovement(data) {
  const db = getDatabase();
  
  // ✅ Normalize candidate_id (support multiple field names)
  const candidateId = parseInt(data.candidate_id || data.candidateId || data.candidateid);
  
  // Validation
  if (!candidateId || isNaN(candidateId)) {
    return { success: false, error: 'Valid Candidate ID is required' };
  }
  
  if (!data.type && !data.movement_type) {
    return { success: false, error: 'Movement type (RECEIVE/SEND) is required' };
  }
  
  if (!data.date) {
    return { success: false, error: 'Date is required' };
  }

  const movementType = (data.type || data.movement_type).toUpperCase();
  
  // Type-specific validation
  if (movementType === 'RECEIVE') {
    if (!data.received_from) {
      return { success: false, error: 'Received From is required' };
    }
    if (!data.received_by) {
      return { success: false, error: 'Received By is required' };
    }
  }
  
  if (movementType === 'SEND') {
    if (!data.send_to) {
      return { success: false, error: 'Send To is required' };
    }
    if (!data.sent_by) {
      return { success: false, error: 'Sent By is required' };
    }
  }

  try {
    // ✅ CRITICAL FIX: Verify candidate exists and is not deleted
    const candidate = await dbGet(
      db,
      'SELECT id FROM candidates WHERE id = ? AND is_deleted = 0',
      [candidateId]
    );

    if (!candidate) {
      console.error(`❌ Candidate ${candidateId} not found or deleted`);
      return { 
        success: false, 
        error: `Candidate with ID ${candidateId} not found or has been deleted. Please verify the candidate exists.` 
      };
    }

    // ✅ Now proceed with movement insertion
    const movementSql = `
      INSERT INTO passport_movements (
        candidate_id, movement_type, method, courier_number, date,
        received_from, received_by, 
        send_to, send_to_name, send_to_contact, sent_by,
        notes, created_by, created_at, updated_at, is_deleted
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
        datetime('now', 'localtime'), 
        datetime('now', 'localtime'),
        0
      )
    `;

    const movementParams = [
      candidateId,
      movementType,
      data.method || null,
      data.courier_number || null,
      data.date,
      // RECEIVE fields
      data.received_from || null,
      data.received_by || null,
      // SEND fields
      data.send_to || null,
      data.send_to_name || null,
      data.send_to_contact || null,
      data.sent_by || null,
      // Shared
      data.notes || null,
      data.created_by || 'System'
    ];

    // Insert movement record
    const result = await dbRun(db, movementSql, movementParams);
    const movementId = result.lastID;

    console.log(`✅ Movement inserted: ID=${movementId}, Candidate=${candidateId}, Type=${movementType}`);

    // ✅ Insert photos if provided
    if (data.photos && Array.isArray(data.photos) && data.photos.length > 0) {
      const photoSql = `
        INSERT INTO passport_movement_photos (
          movement_id, file_name, file_type, file_data, uploaded_at
        ) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
      `;

      for (const photo of data.photos) {
        await dbRun(db, photoSql, [
          movementId,
          photo.file_name,
          photo.file_type,
          photo.file_data
        ]);
      }
      
      console.log(`✅ ${data.photos.length} photo(s) attached to movement ${movementId}`);
    }

    return { 
      success: true, 
      data: { 
        id: movementId,
        photo_count: data.photos?.length || 0
      } 
    };
  } catch (error) {
    console.error('❌ addPassportMovement error:', error);
    return { success: false, error: mapErrorToFriendly(error) };
  }
}

// ============================================================================
// GET PHOTOS FOR A MOVEMENT
// ============================================================================

async function getPassportMovementPhotos(movementId) {
  const db = getDatabase();

  // ✅ FIX: Column name should be "is_deleted" not "isDeleted"
  const sql = `
    SELECT id, movement_id, file_name, file_type, file_data, uploaded_at
    FROM passport_movement_photos
    WHERE movement_id = ?
    ORDER BY uploaded_at DESC
  `;

  try {
    const rows = await dbAll(db, sql, [movementId]);
    return { success: true, data: rows };
  } catch (error) {
    console.error('❌ getPassportMovementPhotos error:', error);
    return { success: false, error: mapErrorToFriendly(error) };
  }
}

// ============================================================================
// ADD PHOTOS TO EXISTING MOVEMENT
// ============================================================================

async function addPassportMovementPhotos(movementId, photos) {
  const db = getDatabase();

  if (!movementId || !photos || photos.length === 0) {
    return { success: false, error: 'Movement ID and photos are required' };
  }

  try {
    // ✅ Check if movement exists
    const movement = await dbGet(
      db,
      'SELECT id FROM passport_movements WHERE id = ? AND is_deleted = 0',
      [movementId]
    );

    if (!movement) {
      return { success: false, error: 'Movement not found' };
    }

    // ✅ Insert photos
    const photoSql = `
      INSERT INTO passport_movement_photos (
        movement_id, file_name, file_type, file_data, uploaded_at
      ) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
    `;

    for (const photo of photos) {
      let cleanBase64 = photo.file_data || photo.filedata;
      
      // Remove "data:image/xxx;base64," prefix if present
      if (cleanBase64 && cleanBase64.includes(',')) {
        cleanBase64 = cleanBase64.split(',')[1];
      }

      await dbRun(db, photoSql, [
        movementId,
        photo.file_name || photo.filename,
        photo.file_type || photo.filetype,
        cleanBase64
      ]);
    }

    // ✅ Update movement's updated_at timestamp
    await dbRun(
      db,
      `UPDATE passport_movements SET updated_at = datetime('now', 'localtime') WHERE id = ?`,
      [movementId]
    );

    return { 
      success: true, 
      message: `${photos.length} photo(s) added successfully`
    };

  } catch (error) {
    console.error('❌ addPassportMovementPhotos error:', error);
    return { success: false, error: mapErrorToFriendly(error) };
  }
}

// ============================================================================
// DELETE PHOTO
// ============================================================================

async function deletePassportMovementPhoto(photoId) {
  const db = getDatabase();

  try {
    const result = await dbRun(
      db,
      'DELETE FROM passport_movement_photos WHERE id = ?',
      [photoId]
    );

    if (result.changes === 0) {
      return { success: false, error: 'Photo not found' };
    }

    return { success: true, message: 'Photo deleted successfully' };
  } catch (error) {
    console.error('❌ deletePassportMovementPhoto error:', error);
    return { success: false, error: mapErrorToFriendly(error) };
  }
}

// ============================================================================
// SOFT DELETE PASSPORT MOVEMENT
// ============================================================================

async function deletePassportMovement(movementId) {
  const db = getDatabase();

  if (!movementId) {
    return { success: false, error: 'Movement ID is required' };
  }

  try {
    // Get movement details before deletion
    const movement = await dbGet(
      db,
      'SELECT candidate_id, movement_type FROM passport_movements WHERE id = ? AND is_deleted = 0',
      [movementId]
    );

    if (!movement) {
      return { success: false, error: 'Movement not found' };
    }

    // Soft delete
    const result = await dbRun(
      db,
      `UPDATE passport_movements 
       SET is_deleted = 1, updated_at = datetime('now', 'localtime') 
       WHERE id = ?`,
      [movementId]
    );

    if (result.changes === 0) {
      return { success: false, error: 'Movement not found or already deleted' };
    }

    return { 
      success: true, 
      message: 'Movement deleted successfully',
      candidateId: movement.candidate_id,
      movementType: movement.movement_type
    };

  } catch (error) {
    console.error('❌ deletePassportMovement error:', error);
    return { success: false, error: mapErrorToFriendly(error) };
  }
}

// ============================================================================
// GET DELETED MOVEMENTS (RECYCLE BIN - PER CANDIDATE)
// ============================================================================

async function getDeletedPassportMovements(candidateId) {
  const db = getDatabase();

  const sql = `
    SELECT 
      pm.*,
      COUNT(pmp.id) as photo_count
    FROM passport_movements pm
    LEFT JOIN passport_movement_photos pmp ON pm.id = pmp.movement_id
    WHERE pm.candidate_id = ? AND pm.is_deleted = 1
    GROUP BY pm.id
    ORDER BY pm.updated_at DESC
  `;

  try {
    const rows = await dbAll(db, sql, [candidateId]);
    return { success: true, data: rows };
  } catch (error) {
    console.error('❌ getDeletedPassportMovements error:', error);
    return { success: false, error: mapErrorToFriendly(error) };
  }
}

// ============================================================================
// GET ALL DELETED MOVEMENTS (GLOBAL RECYCLE BIN)
// ============================================================================

async function getAllDeletedPassportMovements() {
  const db = getDatabase();
  
  const sql = `
    SELECT 
      pm.id,
      pm.candidate_id,
      pm.movement_type,
      pm.method,
      pm.date,
      pm.courier_number,
      pm.received_from,
      pm.received_by,
      pm.send_to,
      pm.send_to_name,
      pm.send_to_contact,
      pm.sent_by,
      pm.notes,
      pm.created_by,
      pm.created_at,
      pm.updated_at,
      c.name AS candidate_name,
      COUNT(pmp.id) as photo_count
    FROM passport_movements pm
    LEFT JOIN candidates c ON c.id = pm.candidate_id
    LEFT JOIN passport_movement_photos pmp ON pm.id = pmp.movement_id
    WHERE pm.is_deleted = 1
    GROUP BY pm.id
    ORDER BY pm.updated_at DESC, pm.id DESC
  `;
  
  try {
    const rows = await dbAll(db, sql, []);
    return { success: true, data: rows };
  } catch (error) {
    console.error('❌ getAllDeletedPassportMovements error:', error);
    return { success: false, error: mapErrorToFriendly(error) };
  }
}

// ============================================================================
// RESTORE DELETED MOVEMENT
// ============================================================================

async function restorePassportMovement(movementId) {
  const db = getDatabase();

  try {
    const result = await dbRun(
      db,
      `UPDATE passport_movements 
       SET is_deleted = 0, updated_at = datetime('now', 'localtime') 
       WHERE id = ?`,
      [movementId]
    );

    if (result.changes === 0) {
      return { success: false, error: 'Movement not found' };
    }

    return { success: true, message: 'Movement restored successfully' };
  } catch (error) {
    console.error('❌ restorePassportMovement error:', error);
    return { success: false, error: mapErrorToFriendly(error) };
  }
}

// ============================================================================
// PERMANENT DELETE PASSPORT MOVEMENT
// ============================================================================

async function permanentDeletePassportMovement(movementId) {
  const db = getDatabase();
  
  try {
    // ✅ First delete associated photos
    await dbRun(db, 'DELETE FROM passport_movement_photos WHERE movement_id = ?', [movementId]);
    
    // ✅ Then delete the movement
    const result = await dbRun(db, 'DELETE FROM passport_movements WHERE id = ?', [movementId]);
    
    if (result.changes === 0) {
      return { success: false, error: 'Movement not found' };
    }
    
    return { success: true, message: 'Movement permanently deleted' };
  } catch (error) {
    console.error('❌ permanentDeletePassportMovement error:', error);
    return { success: false, error: mapErrorToFriendly(error) };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  getPassportMovements,
  addPassportMovement,
  getPassportMovementPhotos,
  addPassportMovementPhotos,
  deletePassportMovementPhoto,
  deletePassportMovement,
  getDeletedPassportMovements,
  restorePassportMovement,
  permanentDeletePassportMovement,
  getAllDeletedPassportMovements
};
