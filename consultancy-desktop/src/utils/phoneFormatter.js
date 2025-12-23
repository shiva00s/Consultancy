/**
 * Permanent phone number formatter for India (+91)
 * Automatically fixes all phone numbers in the system
 */

export const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return '';
  
  // Remove all non-digit characters
  let digits = phoneNumber.replace(/\D/g, '');
  
  // Remove leading zeros
  digits = digits.replace(/^0+/, '');
  
  // If 10 digits and doesn't start with 91, add it
  if (digits.length === 10) {
    digits = '91' + digits;
  }
  
  // If 11 digits and starts with 91, keep it
  if (digits.length === 12 && digits.startsWith('91')) {
    // Already correct
  }
  
  // Return with + prefix
  return '+' + digits;
};

export default formatPhoneNumber;
