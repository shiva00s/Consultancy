// CommonJS version of centralized document categories + emoji map
const DOCUMENT_CATEGORIES = [
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

const CATEGORY_EMOJIS = {
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

function cleanCategory(value = '') {
  return String(value)
    .replace(/\s+/g, ' ')
    .replace(/^[\u{1F000}-\u{1FFFF}]\s*/u, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .trim();
}

function addEmojiToCategory(category) {
  const clean = cleanCategory(category) || 'Uncategorized';
  const emoji = CATEGORY_EMOJIS[clean] || CATEGORY_EMOJIS['Uncategorized'];
  return `${emoji} ${clean}`;
}

module.exports = {
  DOCUMENT_CATEGORIES,
  CATEGORY_EMOJIS,
  cleanCategory,
  addEmojiToCategory
};
