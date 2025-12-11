const { shell } = require("electron");

module.exports = async (event, payload) => {
  try {
    const { number, message } = payload;

    if (!number) return { success: false, error: "Invalid number" };

    const clean = String(number).replace(/\D/g, "");
    const encoded = encodeURIComponent(message || "");

    const url = `whatsapp://send?phone=${clean}&text=${encoded}`;

    console.log("Opening WhatsApp Desktop:", url);

    shell.openExternal(url);   // ✅ DIRECT WHATSAPP DESKTOP

    return { success: true };

  } catch (err) {
    console.error("WhatsApp single error:", err);
    return { success: false, error: err.message };
  }
};
