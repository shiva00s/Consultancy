const twilio = require("twilio");

const FROM_NUMBER = "whatsapp:+14155238886"; // Twilio Sandbox number

const keyManager = require('../services/keyManager.cjs');

module.exports = async (event, payload) => {
  // Ensure we have Twilio credentials from key manager or env
  const accountSid = await keyManager.getKey('twilioaccountsid') || process.env.TWILIO_ACCOUNT_SID || null;
  const authToken = await keyManager.getKey('twilioauthtoken') || process.env.TWILIO_AUTH_TOKEN || null;

  if (!accountSid || !authToken) {
    console.error('Twilio credentials missing for twilioSendWhatsApp');
    return { success: false, error: 'Twilio credentials not configured' };
  }

  const client = twilio(accountSid, authToken);
  try {
    const { numbers, message, mediaPath } = payload;

    if (!numbers || numbers.length === 0) {
      return { success: false, error: "No numbers provided" };
    }

    for (const num of numbers) {
      const to = `whatsapp:+91${num}`; // India auto-format

      const msgOptions = {
        from: FROM_NUMBER,
        to,
        body: message || "",
      };

      if (mediaPath) {
        msgOptions.mediaUrl = [mediaPath]; // PDF / Image / Anything
      }

      await client.messages.create(msgOptions);
    }

    return { success: true };

  } catch (err) {
    console.error("Twilio WhatsApp error:", err);
    return { success: false, error: err.message };
  }
};
