// Centralized document category names and emoji mapping
export const DOCUMENT_CATEGORIES = [
  'Uncategorized',
  'Passport',
  'Resume',
  'Photograph',
  'Education Certificate',
  'Experience Letter',
  'Offer Letter',
  'Visa',
  'Aadhar Card',
  'Pan Card',
  'Medical Certificate',
  'Driving License',
  'Bank Statement',
  'Police Clearance',
  'Insurance',
  'Reference Letter'
];

export const CATEGORY_EMOJIS = {
  'Aadhar Card': '🆔',
  'Pan Card': '💳',
  'Passport': '🛂',
  'Visa': '✈️',
  'Education Certificate': '🎓',
  'Experience Letter': '💼',
  'Offer Letter': '📋',
  'Resume': '📄',
  'Photograph': '📸',
  'Medical Certificate': '🏥',
  'Driving License': '🚗',
  'Uncategorized': '📂',
  'Bank Statement': '🏦',
  'Police Clearance': '👮',
  'Insurance': '🛡️',
  'Reference Letter': '✉️'
};

// Clean category name by removing emojis and extra whitespace
export function cleanCategory(value = '') {
  return String(value)
    .replace(/\s+/g, ' ')
    .replace(/^[\u{1F000}-\u{1FFFF}]\s*/u, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .trim();
}

export function addEmojiToCategory(category) {
  const clean = cleanCategory(category) || 'Uncategorized';
  const emoji = CATEGORY_EMOJIS[clean] || CATEGORY_EMOJIS['Uncategorized'];
  return `${emoji} ${clean}`;
}
