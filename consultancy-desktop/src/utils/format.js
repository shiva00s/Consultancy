// This function will format any number into the "Rs." currency format.
// e.g., 10000.5 => "Rs. 10,000.50"
// e.g., 500 => "Rs. 500.00"

export const formatCurrency = (number) => {
  const num = parseFloat(number) || 0;
  
  // Using Intl.NumberFormat for correct locale formatting (India)
  // This will automatically handle commas (1,00,000) and decimals.
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // The formatter will output "₹10,000.00".
  // We'll replace the rupee symbol (₹) with "Rs. " for consistency.
  return formatter.format(num).replace('₹', 'Rs. ');
};