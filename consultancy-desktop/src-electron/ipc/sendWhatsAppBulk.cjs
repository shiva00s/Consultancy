const { shell } = require("electron");
const queries = require("../db/queries.cjs");

module.exports = async (event, payload) => {
  try {
    const { numbers, message, fallbackLogs } = payload;

    if (!numbers || numbers.length === 0)
      return { success: false, error: "No numbers provided" };

    const encoded = encodeURIComponent(message || "");

    numbers.forEach(num => {
      const clean = String(num).replace(/\D/g, "");
      if (clean.length < 8) return;

      const url = `whatsapp://send?phone=${clean}&text=${encoded}`;

      try { require('../utils/logger.cjs').info('Opening WhatsApp Desktop:', url); } catch (e) {}

      shell.openExternal(url);   // ✅ DIRECTLY OPENS WHATSAPP DESKTOP
    });

    // Optional fallback logs: only persist if caller explicitly requested fallback
    // (renderer usually logs before requesting WhatsApp; fallback is for edge cases)
    if (payload.forceFallback === true && Array.isArray(fallbackLogs) && fallbackLogs.length > 0) {
      try {
        await Promise.all(fallbackLogs.map((f) =>
          queries.logCommunication({
            candidateId: parseInt(f.candidateId),
            userId: parseInt(f.userId),
            type: f.communication_type || 'WhatsApp',
            details: f.details || message,
            metadata: f.metadata || null,
          })
        ));
      } catch (err) {
        console.warn('Fallback bulk log failed:', err && err.message ? err.message : err);
      }
    }

    return { success: true };

  } catch (err) {
    console.error("WhatsApp bulk error:", err);
    return { success: false, error: err.message };
  }
};
