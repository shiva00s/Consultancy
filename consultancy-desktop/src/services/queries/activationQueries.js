// src/services/queries/activationQueries.js
// 🔒 Activation/License queries ONLY for ActivationPrompt.jsx
// 100% backward compatible with existing electron.cjs calls

const getDatabase = require('../database.cjs');
const { dbRun, dbGet } = require('./dbHelpers.cjs'); // Shared helpers
const mapErrorToFriendly = require('./utils.cjs').mapErrorToFriendly;

/**
 * Get current activation status
 * Used by: ActivationPrompt.jsx → window.electronAPI.getActivationStatus()
 */
async function getActivationStatus() {
  const db = getDatabase();
  try {
    // Check licenseactivation table (primary)
    const licenseRow = await dbGet(db, `
      SELECT machineid, activatedat 
      FROM licenseactivation 
      WHERE machineid = (SELECT machineid FROM licenseactivation LIMIT 1)
    `);

    if (licenseRow) {
      return {
        success: true,
        activated: true,
        machineId: licenseRow.machineid,
        activatedAt: licenseRow.activatedat
      };
    }

    // Fallback: Check old activations table
    const activationRow = await dbGet(db, `
      SELECT machineId, activated, createdAt 
      FROM activations 
      LIMIT 1
    `);

    if (activationRow) {
      return {
        success: true,
        activated: !!activationRow.activated,
        machineId: activationRow.machineId,
        createdAt: activationRow.createdAt
      };
    }

    return {
      success: true,
      activated: false,
      machineId: null
    };
  } catch (err) {
    console.error('getActivationStatus DB Error:', err.message);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Verify and activate license key
 * Used by: ActivationPrompt.jsx → window.electronAPI.activateApplication(code)
 */
async function activateLicense(machineId, activationCode) {
  const db = getDatabase();
  try {
    // 1. Check activationrequests table first
    const requestRow = await dbGet(db, `
      SELECT id, machineid, activationcode, expiresat, used, email 
      FROM activationrequests 
      WHERE machineid = ? AND activationcode = ? AND used = 0 AND expiresat > datetime('now')
    `, [machineId, activationCode]);

    if (requestRow) {
      // Valid request found - activate it
      await dbRun(db, `
        INSERT OR REPLACE INTO licenseactivation (machineid, activatedat, activatedby, notes)
        VALUES (?, datetime('now'), ?, 'Activated via UI')
      `, [machineId, requestRow.email]);

      // Mark request as used
      await dbRun(db, `
        UPDATE activationrequests 
        SET used = 1, usedat = datetime('now') 
        WHERE id = ?
      `, [requestRow.id]);

      // Update system settings
      await dbRun(db, `
        INSERT OR REPLACE INTO systemsettings (key, value)
        VALUES ('licensestatus', ?)
      `, JSON.stringify({
        status: 'activated',
        machineId,
        activatedAt: new Date().toISOString(),
        activatedBy: requestRow.email
      }));

      return {
        success: true,
        message: 'License activated successfully!'
      };
    }

    // 2. Fallback: Check old activations table
    const oldActivation = await dbGet(db, `
      SELECT * FROM activations 
      WHERE machineId = ? AND code = ? AND activated = 0
    `, [machineId, activationCode]);

    if (oldActivation) {
      await dbRun(db, `
        UPDATE activations SET activated = 1 WHERE machineId = ?
      `, [machineId]);

      await dbRun(db, `
        INSERT OR REPLACE INTO licenseactivation (machineid, activatedat, activatedby)
        VALUES (?, datetime('now'), 'Legacy activation')
      `, [machineId]);

      return {
        success: true,
        message: 'License activated successfully!'
      };
    }

    return {
      success: false,
      error: 'Invalid or expired activation code'
    };
  } catch (err) {
    console.error('activateLicense DB Error:', err.message);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Save pending activation request (for email flow)
 * Used by: ActivationPrompt.jsx → window.electronAPI.sendActivationEmail()
 */
async function savePendingActivation(machineId, requestCode, email = null) {
  const db = getDatabase();
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h expiry

    await dbRun(db, `
      INSERT OR REPLACE INTO activationrequests 
      (machineid, activationcode, expiresat, createdat, email)
      VALUES (?, ?, ?, datetime('now'), ?)
    `, [machineId, requestCode, expiresAt, email || null]);

    // Also save to legacy table for backward compat
    await dbRun(db, `
      INSERT OR REPLACE INTO activations (machineId, code, activated, createdAt)
      VALUES (?, ?, 0, datetime('now'))
      ON CONFLICT(machineId) DO UPDATE SET 
        code = excluded.code, 
        activated = 0, 
        createdAt = excluded.createdAt
    `, [machineId, requestCode]);

    return { success: true };
  } catch (err) {
    console.error('savePendingActivation DB Error:', err.message);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get machine ID (hardware fingerprint)
 * Used by: ActivationPrompt.jsx → window.electronAPI.getMachineId()
 * Note: This calls Node.js module - no DB query needed
 */
async function getMachineId() {
  try {
    const nodeMachineId = await import('node-machine-id');
    const id = await nodeMachineId.machineId();
    return {
      success: true,
      machineId: id
    };
  } catch (err) {
    console.error('getMachineId Error:', err.message);
    return {
      success: false,
      error: 'Failed to generate machine ID',
      machineId: 'ERROR'
    };
  }
}

// 🔒 EXPORTS - Exact same names as original queries.cjs
module.exports = {
  // Core activation functions
  getActivationStatus,
  activateLicense,
  savePendingActivation,
  getMachineId,
  
  // Legacy compatibility (if any old code calls these)
  verifyActivationKey: activateLicense, // Alias for backward compat
  getPendingActivation: getActivationStatus
};
