const twilio = require("twilio");

const ACCOUNT_SID = "AC7ff5862adc4fc67803722d3e8ac3bda7";
const AUTH_TOKEN = "-u AC7ff5862adc4fc67803722d3e8ac3bda7:a2c9f8374f7bd8e9b20bf9f95a18a534";
const FROM_NUMBER = "whatsapp:+919629881598"; // Twilio Sandbox number

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
