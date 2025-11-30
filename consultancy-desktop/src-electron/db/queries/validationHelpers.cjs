// Note: validateVerhoeff needs to be imported if used. Assuming it's available or moved here.
const { validateVerhoeff } = require('../../utils/validators.cjs'); // Ensure this path is correct if validateVerhoeff is external

const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

const validateRequired = (field, name) => {
    if (!field || (typeof field === 'string' && field.trim() === '')) {
        return `${name} is required.`;
    }
    return null;
};

const validatePositiveNumber = (field, name) => {
    const num = parseFloat(field);
    if (isNaN(num) || num < 0) {
        return `${name} must be a valid positive number.`;
    }
    return null;
};

const parseExcelDate = (excelSerial) => {
    if (!isNaN(excelSerial) && excelSerial > 25569) { // Excel's epoch starts Jan 1, 1900. 25569 = Jan 1, 1970
        const date = new Date((excelSerial - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
    }
    return excelSerial; // Return as-is if it's already a string or invalid
};

module.exports = { 
    validateEmail, 
    validateRequired, 
    validatePositiveNumber,
    validateVerhoeff, // Export if used by other queries
    parseExcelDate
};
