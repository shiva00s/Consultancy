const { shell } = require("electron");
const path = require("path");

module.exports = (event, payload) => {
  try {
    const { numbers, message, mediaPath } = payload;

    const encodedMessage = encodeURIComponent(message || "");

    // Open WhatsApp chat for each number
    numbers.forEach(num => {
      const clean = String(num).replace(/\D/g, "");
      const url = `https://wa.me/${clean}?text=${encodedMessage}`;
      shell.openExternal(url);
    });

    // If user selected a file, open folder to help them attach it
    if (mediaPath) {
      const folder = path.dirname(mediaPath);
      shell.openPath(folder);   // Opens File Explorer
    }

    return { success: true };
  } catch (err) {
    console.error("WhatsApp Bulk Error:", err);
    return { success: false, error: err.message };
  }
};
