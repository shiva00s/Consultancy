const { shell } = require("electron");
const queries = require("../db/queries.cjs");

module.exports = async (event, payload) => {
  try {
    const { number, message, fallbackLog } = payload;

    if (!number) return { success: false, error: "Invalid number" };

    const clean = String(number).replace(/\D/g, "");
    const encoded = encodeURIComponent(message || "");

    const url = `whatsapp://send?phone=${clean}&text=${encoded}`;
    try { require('../utils/logger.cjs').info('Opening WhatsApp Desktop:', url); } catch (e) {}
    // Attempt to open WhatsApp
    shell.openExternal(url);

    // Only perform fallback logging if explicitly requested by caller
    if (payload.forceFallback === true && fallbackLog && fallbackLog.candidateId && fallbackLog.userId) {
      try {
        await queries.logCommunication({
          candidateId: parseInt(fallbackLog.candidateId),
          userId: parseInt(fallbackLog.userId),
          type: fallbackLog.communication_type || 'WhatsApp',
          details: fallbackLog.details || message || `Opened WhatsApp chat with +${clean}`,
          metadata: fallbackLog.metadata || null,
        });
      } catch (err) {
        console.warn('Fallback log failed in openWhatsAppSingle:', err.message || err);
      }
    }

    return { success: true };

  } catch (err) {
    console.error("WhatsApp single error:", err);
    return { success: false, error: err.message };
  }
};
