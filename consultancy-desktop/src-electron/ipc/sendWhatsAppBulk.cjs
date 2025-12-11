const { shell } = require("electron");

module.exports = async (event, payload) => {
  try {
    const { numbers, message } = payload;

    if (!numbers || numbers.length === 0)
      return { success: false, error: "No numbers provided" };

    const encoded = encodeURIComponent(message || "");

    numbers.forEach(num => {
      const clean = String(num).replace(/\D/g, "");
      if (clean.length < 8) return;

      const url = `whatsapp://send?phone=${clean}&text=${encoded}`;

      console.log("Opening WhatsApp Desktop:", url);

      shell.openExternal(url);   // ✅ DIRECTLY OPENS WHATSAPP DESKTOP
    });

    return { success: true };

  } catch (err) {
    console.error("WhatsApp bulk error:", err);
    return { success: false, error: err.message };
  }
};
