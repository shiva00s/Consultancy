import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export const sanitizeHTML = (dirty) => {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: []
  });
};

/**
 * Sanitize plain text input
 */
export const sanitizeText = (input) => {
  if (!input) return '';
  return String(input)
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 10000); // Limit length
};

/**
 * Sanitize number input
 */
export const sanitizeNumber = (input) => {
  const num = Number(input);
  return isNaN(num) ? 0 : num;
};

/**
 * Sanitize email
 */
export const sanitizeEmail = (email) => {
  if (!email) return '';
  return String(email)
    .toLowerCase()
    .trim()
    .slice(0, 100);
};

/**
 * Sanitize phone number
 */
export const sanitizePhone = (phone) => {
  if (!phone) return '';
  return String(phone)
    .replace(/[^0-9+\-() ]/g, '')
    .slice(0, 20);
};

/**
 * Sanitize file name
 */
export const sanitizeFileName = (fileName) => {
  if (!fileName) return '';
  return String(fileName)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 255);
};

/**
 * Sanitize SQL input (basic - parameterized queries are still required)
 */
export const sanitizeSQL = (input) => {
  if (!input) return '';
  return String(input)
    .replace(/['";\\]/g, '') // Remove SQL special characters
    .trim();
};

/**
 * Sanitize object (recursively sanitize all string values)
 */
export const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else if (typeof value === 'number') {
      sanitized[key] = sanitizeNumber(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};
export default {
  sanitizeHTML,
  sanitizeText,
  sanitizeNumber,
  sanitizeEmail,
  sanitizePhone,
  sanitizeFileName,
  sanitizeSQL,
  sanitizeObject,
};