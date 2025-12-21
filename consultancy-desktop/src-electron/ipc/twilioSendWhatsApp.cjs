const twilio = require("twilio");

const ACCOUNT_SID = "AC7ff5862adc4fc67803722d3e8ac3bda7";
const AUTH_TOKEN = "8db81c11ec073e5edf84330ad4d9c563";
const FROM_NUMBER = "whatsapp:+14155238886"; // Twilio Sandbox number

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

module.exports = async (event, payload) => {
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
