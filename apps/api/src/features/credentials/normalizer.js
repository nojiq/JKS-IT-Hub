/**
 * Normalization Rules Engine
 * 
 * Applies normalization rules to credential field values.
 * Rules are applied in the order specified in the template.
 */

/**
 * Available normalization functions
 */
const normalizers = {
  lowercase: (str) => str.toLowerCase(),
  uppercase: (str) => str.toUpperCase(),
  trim: (str) => str.trim(),
  removeSpaces: (str) => str.replace(/\s/g, ''),
  removeSpecialChars: (str) => str.replace(/[^a-zA-Z0-9]/g, '')
};

/**
 * Apply a single normalization rule to a value
 * @param {string} value - The value to normalize
 * @param {string} rule - The normalization rule name
 * @returns {string} - The normalized value
 */
export const applyNormalizer = (value, rule) => {
  if (!value || typeof value !== 'string') {
    return value;
  }
  
  const normalizer = normalizers[rule];
  if (!normalizer) {
    console.warn(`Unknown normalization rule: ${rule}`);
    return value;
  }
  
  return normalizer(value);
};

/**
 * Apply multiple normalization rules in sequence
 * @param {string} value - The value to normalize
 * @param {string[]} rules - Array of normalization rule names
 * @returns {string} - The fully normalized value
 */
export const applyNormalizers = (value, rules = []) => {
  if (!value || typeof value !== 'string') {
    return value;
  }
  
  if (!Array.isArray(rules) || rules.length === 0) {
    return value;
  }
  
  return rules.reduce((normalizedValue, rule) => {
    return applyNormalizer(normalizedValue, rule);
  }, value);
};

/**
 * Apply global normalization rules from template
 * @param {string} value - The value to normalize
 * @param {Object} rules - Object with boolean flags for each rule
 * @returns {string} - The normalized value
 */
export const applyGlobalNormalizers = (value, rules = {}) => {
  if (!value || typeof value !== 'string') {
    return value;
  }
  
  let result = value;
  
  if (rules.trim) {
    result = normalizers.trim(result);
  }
  
  if (rules.removeSpaces) {
    result = normalizers.removeSpaces(result);
  }
  
  if (rules.lowercase) {
    result = normalizers.lowercase(result);
  } else if (rules.uppercase) {
    result = normalizers.uppercase(result);
  }
  
  return result;
};

/**
 * Get list of available normalization rules
 * @returns {string[]} - Array of available rule names
 */
export const getAvailableNormalizers = () => {
  return Object.keys(normalizers);
};

/**
 * Validate normalization rules
 * @param {string[]} rules - Array of rule names to validate
 * @returns {Object} - Validation result with valid rules and any errors
 */
export const validateNormalizers = (rules = []) => {
  const available = getAvailableNormalizers();
  const valid = [];
  const invalid = [];
  
  for (const rule of rules) {
    if (available.includes(rule)) {
      valid.push(rule);
    } else {
      invalid.push(rule);
    }
  }
  
  return {
    valid,
    invalid,
    isValid: invalid.length === 0
  };
};

export default {
  applyNormalizer,
  applyNormalizers,
  applyGlobalNormalizers,
  getAvailableNormalizers,
  validateNormalizers
};
