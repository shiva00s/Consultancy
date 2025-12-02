const { shell } = require("electron");

/**
 * Bulk WhatsApp Sender
 * Opens WhatsApp Desktop if installed, otherwise WhatsApp Web.
 * Sends the same message to all provided numbers.
 */
module.exports = (event, payload) => {
    try {
        const { numbers, message } = payload;

        if (!Array.isArray(numbers) || numbers.length === 0) {
            return { success: false, error: "No numbers provided" };
        }

        const encodedMessage = encodeURIComponent(message || "");

        numbers.forEach((num) => {
            if (!num) return;
            const clean = String(num).replace(/\D/g, ""); // remove non-digits
            const url = `https://wa.me/${clean}?text=${encodedMessage}`;
            shell.openExternal(url);
        });

        return { success: true };
    } catch (err) {
        console.error("WhatsApp Bulk Error:", err);
        return { success: false, error: err.message };
    }
};
