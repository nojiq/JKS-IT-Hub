/**
 * Deterministic Credential Generation Engine
 * 
 * Generates deterministic credentials based on:
 * 1. Active credential template
 * 2. LDAP field mappings
 * 3. Normalization rules
 * 4. Password patterns
 */

import { createHash } from 'node:crypto';
import { applyNormalizers, applyGlobalNormalizers } from './normalizer.js';

/**
 * Error thrown when required LDAP fields are missing
 */
export class MissingLdapFieldsError extends Error {
  constructor(missingFields, userId) {
    super(`Missing required LDAP fields: ${missingFields.join(', ')}`);
    this.name = 'MissingLdapFieldsError';
    this.missingFields = missingFields;
    this.userId = userId;
    this.code = 'MISSING_LDAP_FIELDS';
  }
}

/**
 * Error thrown when no active template exists
 */
export class NoActiveTemplateError extends Error {
  constructor() {
    super('No active credential template found');
    this.name = 'NoActiveTemplateError';
    this.code = 'NO_ACTIVE_TEMPLATE';
  }
}

/**
 * Deterministically derive alphanumeric characters from a seed.
 * Same seed + length always yields the same output.
 */
export const deriveDeterministicChars = (seed, length) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  let counter = 0;

  while (result.length < length) {
    const digest = createHash('sha256')
      .update(`${seed}:${counter}`)
      .digest();

    for (const byte of digest) {
      result += chars[byte % chars.length];
      if (result.length >= length) {
        break;
      }
    }

    counter += 1;
  }

  return result;
};

export const stableStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `"${key}":${stableStringify(val)}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
};

/**
 * Parse a password pattern and extract tokens
 * Pattern syntax: {field:length}, {random:length}, {fixed:text}
 * @param {string} pattern - The password pattern
 * @returns {Array} - Array of pattern tokens
 */
const parsePattern = (pattern) => {
  const tokens = [];
  const regex = /\{fixed:([^}]+)\}|\{([A-Za-z0-9_]+):(\d+)\}/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(pattern)) !== null) {
    // Add any literal text before this token
    if (match.index > lastIndex) {
      tokens.push({
        type: 'literal',
        value: pattern.slice(lastIndex, match.index)
      });
    }

    if (match[1]) {
      // {fixed:text} format
      tokens.push({
        type: 'fixed',
        value: match[1]
      });
    } else if (match[2] === 'random' && match[3]) {
      // {random:length} format
      tokens.push({
        type: 'random',
        length: parseInt(match[3], 10)
      });
    } else if (match[2] && match[3]) {
      // {field:length} format
      tokens.push({
        type: 'field',
        field: match[2],
        length: parseInt(match[3], 10)
      });
    }

    lastIndex = regex.lastIndex;
  }

  // Add any remaining literal text
  if (lastIndex < pattern.length) {
    tokens.push({
      type: 'literal',
      value: pattern.slice(lastIndex)
    });
  }

  return tokens;
};

/**
 * Execute a parsed pattern token
 * @param {Object} token - The pattern token
 * @param {Object} fieldValues - Mapped field values from LDAP
 * @param {Object} context - Execution context for deterministic token generation
 * @returns {string} - The executed token value
 */
const executePatternToken = (token, fieldValues, context = {}) => {
  switch (token.type) {
    case 'literal':
      return token.value;

    case 'field':
      const fieldValue = fieldValues[token.field];
      if (!fieldValue) {
        return '';
      }
      return fieldValue.slice(0, token.length);

    case 'random':
      return deriveDeterministicChars(
        `${context.seed || ''}:token:${context.tokenIndex ?? 0}:random`,
        token.length
      );

    case 'fixed':
      return token.value;

    default:
      return '';
  }
};

/**
 * Map LDAP attributes to credential fields
 * @param {Object} ldapAttributes - LDAP attributes from user record
 * @param {Array} fieldMappings - Field mapping definitions from template
 * @returns {Object} - Mapped field values
 */
const mapLdapFields = (ldapAttributes, fieldMappings) => {
  const mapped = {};

  for (const field of fieldMappings) {
    if (field.ldapSource && Object.hasOwn(ldapAttributes, field.ldapSource)) {
      mapped[field.name] = ldapAttributes[field.ldapSource];
    }
  }

  return mapped;
};

/**
 * Validate that all required fields have values
 * @param {Object} fieldValues - Mapped field values
 * @param {Array} fieldDefinitions - Field definitions from template
 * @returns {Object} - Validation result
 */
const validateRequiredFields = (fieldValues, fieldDefinitions) => {
  const missing = [];

  for (const field of fieldDefinitions) {
    if (field.required) {
      const value = fieldValues[field.name];
      if (!value || value.trim() === '') {
        missing.push(field.ldapSource || field.name);
      }
    }
  }

  return {
    isValid: missing.length === 0,
    missing
  };
};

/**
 * Apply normalization to field values
 * @param {Object} fieldValues - Mapped field values
 * @param {Array} fieldDefinitions - Field definitions with normalization rules
 * @param {Object} globalRules - Global normalization rules from template
 * @returns {Object} - Normalized field values
 */
const normalizeFieldValues = (fieldValues, fieldDefinitions, globalRules) => {
  const normalized = { ...fieldValues };

  for (const field of fieldDefinitions) {
    if (normalized[field.name]) {
      // Apply field-specific normalization
      if (field.normalization && field.normalization.length > 0) {
        normalized[field.name] = applyNormalizers(normalized[field.name], field.normalization);
      }

      // Apply global normalization
      if (globalRules) {
        normalized[field.name] = applyGlobalNormalizers(normalized[field.name], globalRules);
      }
    }
  }

  return normalized;
};

/**
 * Generate password from pattern
 * @param {string} pattern - Password pattern
 * @param {Object} fieldValues - Normalized field values
 * @param {string} deterministicSeed - Deterministic generation seed
 * @returns {string} - Generated password
 */
const generatePassword = (pattern, fieldValues, deterministicSeed) => {
  if (!pattern) {
    // Deterministic fallback when template omits password pattern.
    return deriveDeterministicChars(`${deterministicSeed}:default-password`, 12);
  }

  const tokens = parsePattern(pattern);
  return tokens
    .map((token, tokenIndex) =>
      executePatternToken(token, fieldValues, { seed: deterministicSeed, tokenIndex })
    )
    .join('');
};

const IMAP_DETERMINISTIC_FIELDS = ['email', 'firstName', 'lastName', 'fullName', 'dob', 'phone', 'temporaryPassword'];
const IMAP_DETERMINISTIC_MODE = 'imap_deterministic';
const IMAP_DETERMINISTIC_ALGORITHM_VERSION = 1;

const normalizeImapInputValue = (field, value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const normalized = String(value).trim();
  switch (field) {
    case 'email':
      return normalized.toLowerCase();
    case 'firstName':
    case 'lastName':
    case 'fullName':
      return normalized.replace(/\s+/g, ' ').toLowerCase();
    case 'phone':
      return normalized.replace(/\D+/g, '');
    default:
      return normalized;
  }
};

const fingerprintImapInputValue = (value) => {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
};

export const generateImapDeterministicPassword = ({
  subjectKey,
  userId,
  username,
  inputs = {},
  selectedFields = {},
  origins = {},
  previousMetadata = null
}) => {
  const resolvedSubjectKey = String(subjectKey ?? userId ?? '').trim();
  if (!resolvedSubjectKey) {
    throw new Error('IMAP deterministic generator requires subjectKey or userId');
  }

  const normalizedUsername = normalizeImapInputValue('email', username);
  const resolvedSelectedFields = IMAP_DETERMINISTIC_FIELDS
    .filter((field) => selectedFields[field])
    .sort((a, b) => a.localeCompare(b));

  const normalizedInputs = {};
  const inputFingerprints = {};
  const selectedOrigins = {};

  for (const field of resolvedSelectedFields) {
    const normalizedValue = normalizeImapInputValue(field, inputs[field]);
    normalizedInputs[field] = normalizedValue;
    inputFingerprints[field] = fingerprintImapInputValue(normalizedValue);
    selectedOrigins[field] = origins[field] || 'manual';
  }

  const deterministicSeed = stableStringify({
    mode: IMAP_DETERMINISTIC_MODE,
    algorithmVersion: IMAP_DETERMINISTIC_ALGORITHM_VERSION,
    system: 'imap',
    subjectKey: resolvedSubjectKey,
    username: normalizedUsername,
    selectedFields: resolvedSelectedFields,
    inputs: normalizedInputs
  });

  const password = deriveDeterministicChars(`${deterministicSeed}:password`, 16);
  let changedFields = [];

  if (previousMetadata?.mode === IMAP_DETERMINISTIC_MODE) {
    const previousSelectedFields = new Set(previousMetadata.selectedFields || []);
    const previousFingerprints = previousMetadata.inputFingerprints || {};
    const previousOrigins = previousMetadata.origins || {};

    changedFields = IMAP_DETERMINISTIC_FIELDS.filter((field) => {
      const isSelected = resolvedSelectedFields.includes(field);
      const wasSelected = previousSelectedFields.has(field);

      if (isSelected !== wasSelected) {
        return true;
      }

      if (!isSelected) {
        return false;
      }

      return previousFingerprints[field] !== inputFingerprints[field]
        || (previousOrigins[field] || null) !== (selectedOrigins[field] || null);
    });
  }

  return {
    password,
    metadata: {
      mode: IMAP_DETERMINISTIC_MODE,
      algorithmVersion: IMAP_DETERMINISTIC_ALGORITHM_VERSION,
      subjectKey: resolvedSubjectKey,
      selectedFields: resolvedSelectedFields,
      changedFields,
      origins: selectedOrigins,
      inputFingerprints
    }
  };
};

const YAHOO_ACTUAL_MODE = 'yahoo_actual';
const YAHOO_ACTUAL_ALGORITHM_VERSION = 1;

/** Stable class order (sorted keys) for mandatory picks + pool concatenation */
const YAHOO_CHARSET_ORDER = [
  { key: 'digit', pool: '0123456789' },
  { key: 'lowercase', pool: 'abcdefghijklmnopqrstuvwxyz' },
  { key: 'special', pool: '!@#$%^&*-_+=' },
  { key: 'uppercase', pool: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' }
];

const deriveDeterministicFromPool = (seed, length, pool) => {
  if (!pool || pool.length === 0) {
    throw new Error('Character pool must be non-empty');
  }
  let result = '';
  let counter = 0;
  while (result.length < length) {
    const digest = createHash('sha256')
      .update(`${seed}:${counter}`)
      .digest();

    for (const byte of digest) {
      result += pool[byte % pool.length];
      if (result.length >= length) {
        break;
      }
    }

    counter += 1;
  }

  return result;
};

/**
 * Map common DOB text shapes to one string so the Yahoo actual seed matches across UIs
 * (native `<input type="date">` uses ISO; credential generator uses `dd/mm/yyyy`).
 * Always normalizes to zero-padded `dd/mm/yyyy` (day-first for slash forms), matching
 * `IsoDatePopoverField` calendar output and preserving legacy seeds for existing previews.
 */
const formatDdMmYyyyPadded = (day, month, year) =>
  `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;

const canonicalDobForYahooActual = (raw) => {
  const s = String(raw ?? "").trim();
  if (!s) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, d] = s.split("-").map(Number);
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
      return s;
    }
    return formatDdMmYyyyPadded(d, mo, y);
  }
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) {
    return s;
  }
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) {
    year = year <= 30 ? 2000 + year : 1900 + year;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return s;
  }
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return s;
  }
  return formatDdMmYyyyPadded(day, month, year);
};

/**
 * Deterministic Yahoo "actual" password from identity + Yahoo temp password.
 * Same normalized inputs + length + charset flags always yield same password (v1).
 */
export const generateActualDeterministicPassword = ({
  fullName = '',
  email = '',
  dob = '',
  temporaryPassword = '',
  length,
  charset
}) => {
  const normalized = {
    fullName: normalizeImapInputValue('fullName', fullName),
    email: normalizeImapInputValue('email', email),
    dob: canonicalDobForYahooActual(dob),
    temporaryPassword: String(temporaryPassword ?? '').trim()
  };

  const enabledDefs = YAHOO_CHARSET_ORDER.filter((def) => charset[def.key]);
  if (enabledDefs.length === 0) {
    throw new Error('At least one character class must be enabled');
  }

  if (length < enabledDefs.length) {
    throw new Error('Length must be at least the number of enabled character classes');
  }

  const charsetFlags = {
    digit: Boolean(charset.digit),
    lowercase: Boolean(charset.lowercase),
    special: Boolean(charset.special),
    uppercase: Boolean(charset.uppercase)
  };

  const deterministicSeed = stableStringify({
    mode: YAHOO_ACTUAL_MODE,
    algorithmVersion: YAHOO_ACTUAL_ALGORITHM_VERSION,
    inputs: normalized,
    length,
    charset: charsetFlags
  });

  const allowedPool = enabledDefs.map((d) => d.pool).join('');
  const mandatory = enabledDefs.map((def) =>
    deriveDeterministicFromPool(`${deterministicSeed}:mandatory:${def.key}`, 1, def.pool)
  );
  const restLen = length - mandatory.length;
  const tail = restLen > 0
    ? deriveDeterministicFromPool(`${deterministicSeed}:tail`, restLen, allowedPool)
    : '';

  const password = mandatory.join('') + tail;

  return {
    password,
    metadata: {
      mode: YAHOO_ACTUAL_MODE,
      algorithmVersion: YAHOO_ACTUAL_ALGORITHM_VERSION,
      length,
      charset: charsetFlags
    }
  };
};

/**
 * Generate credentials for a single system
 * @param {Object} system - System configuration from template
 * @param {Object} template - Active credential template
 * @param {Object} user - User record with LDAP attributes
 * @param {Object} systemConfig - Optional system configuration from database (Story 2.7)
 * @returns {Object} - Generated credentials for the system
 */
const generateSystemCredentials = (system, template, user, systemConfig = null) => {
  const { structure } = template;
  const ldapAttributes = user.ldapAttributes || {};

  // Map LDAP fields to credential fields
  const fieldValues = mapLdapFields(ldapAttributes, structure.fields);

  // Validate required fields
  const validation = validateRequiredFields(fieldValues, structure.fields);
  if (!validation.isValid) {
    throw new MissingLdapFieldsError(validation.missing, user.id);
  }

  // Normalize field values
  const normalizedValues = normalizeFieldValues(
    fieldValues,
    structure.fields,
    structure.normalizationRules
  );

  // Find username field mapping
  const usernameField = structure.fields.find(f => f.name === 'username');
  let username;
  let usernameFieldUsed;
  let isFallback = false;
  const ldapSources = {};

  // Determine username
  // 1. Check for per-system pre-normalized username (Story 2.8) - target specific system or map
  const systemIdKey = system.name || system;
  const perSystemConfig = user._systemConfigs?.[systemIdKey] || (user._systemConfig?.systemId === systemIdKey ? user._systemConfig : null);

  if (perSystemConfig?.normalizedUsername) {
    username = perSystemConfig.normalizedUsername;
    usernameFieldUsed = perSystemConfig.usernameLdapField;
    isFallback = perSystemConfig.fallback;
  } else if (systemConfig && systemConfig.usernameLdapField) {
    // Fallback to extraction from LDAP using system config (Story 2.7)
    username = ldapAttributes[systemConfig.usernameLdapField];
    usernameFieldUsed = systemConfig.usernameLdapField;

    // If configured field not available, fallback to mail
    if (!username) {
      console.warn(`[Generator] Configured field '${systemConfig.usernameLdapField}' not found in LDAP data. Falling back to 'mail' field.`);
      username = ldapAttributes.mail;
      usernameFieldUsed = 'mail';
      isFallback = true;
    }
  } else if (usernameField && usernameField.ldapSource) {
    // Use template's username field mapping
    username = normalizedValues[usernameField.name] || ldapAttributes[usernameField.ldapSource];
    usernameFieldUsed = usernameField.ldapSource;
  } else {
    // Default to email or generate from first/last name
    username = ldapAttributes.mail ||
      `${ldapAttributes.givenName?.toLowerCase()}.${ldapAttributes.sn?.toLowerCase()}`;
    usernameFieldUsed = ldapAttributes.mail ? 'mail' : 'givenName+sn';
  }

  ldapSources.username = usernameFieldUsed;

  // Find password field and track LDAP sources used in pattern
  const passwordField = structure.fields.find(f => f.name === 'password');
  const deterministicSeed = stableStringify({
    userId: user.id,
    system: systemIdKey,
    templateVersion: template.version,
    ldapAttributes,
    normalizedValues,
    passwordPattern: passwordField?.pattern || null
  });
  const password = generatePassword(passwordField?.pattern, normalizedValues, deterministicSeed);

  // Track LDAP sources used in password generation
  if (passwordField?.pattern) {
    const tokens = parsePattern(passwordField.pattern);
    tokens.forEach(token => {
      if (token.type === 'field' && token.field) {
        const fieldDef = structure.fields.find(f => f.name === token.field);
        if (fieldDef?.ldapSource) {
          ldapSources[token.field] = fieldDef.ldapSource;
        }
      }
    });
  }

  return {
    system: system.name || system,
    username,
    password,
    templateVersion: template.version,
    ldapSources,
    generationMetadata: (perSystemConfig || systemConfig) ? {
      systemId: perSystemConfig?.systemId || systemConfig?.systemId,
      usernameFieldUsed,
      isFallback,
      normalizationRulesApplied: perSystemConfig?.normalizationRulesApplied || systemConfig?.normalizationRules || []
    } : null
  };
};

/**
 * Generate deterministic credentials for a user
 * @param {Object} template - Active credential template
 * @param {Object} user - User record with LDAP attributes
 * @param {Object} systemConfig - Optional system configuration for system-specific generation (Story 2.7)
 * @returns {Array} - Array of generated credentials for each system
 */
export const generateCredentials = (template, user, systemConfig = null) => {
  if (!template) {
    throw new NoActiveTemplateError();
  }

  if (!template.structure || !template.structure.systems) {
    throw new Error('Invalid template: missing systems configuration');
  }

  const credentials = [];

  // If systemConfig is provided, only generate for that specific system
  if (systemConfig && systemConfig.systemId) {
    const targetSystem = template.structure.systems.find(s =>
      (s.name || s) === systemConfig.systemId
    );

    if (!targetSystem) {
      throw new Error(`System '${systemConfig.systemId}' not found in template`);
    }

    try {
      const credential = generateSystemCredentials(targetSystem, template, user, systemConfig);
      credentials.push(credential);
    } catch (error) {
      // Re-throw missing fields error with system context
      if (error instanceof MissingLdapFieldsError) {
        error.system = systemConfig.systemId;
      }
      throw error;
    }
  } else {
    // Generate for all systems in template
    for (const system of template.structure.systems) {
      try {
        const credential = generateSystemCredentials(system, template, user);
        credentials.push(credential);
      } catch (error) {
        // Re-throw missing fields error with system context
        if (error instanceof MissingLdapFieldsError) {
          error.system = system.name || system;
        }
        throw error;
      }
    }
  }

  return credentials;
};

/**
 * Preview credentials without storing them
 * @param {Object} template - Active credential template
 * @param {Object} user - User record with LDAP attributes
 * @param {Object} systemConfig - Optional system configuration for system-specific generation (Story 2.7)
 * @returns {Object} - Preview result with credentials or errors
 */
export const previewCredentials = (template, user, systemConfig = null) => {
  try {
    const credentials = generateCredentials(template, user, systemConfig);
    return {
      success: true,
      credentials,
      userId: user.id,
      templateVersion: template.version
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: error.code || 'GENERATION_FAILED',
        message: error.message,
        missingFields: error.missingFields || null,
        system: error.system || null,
        userId: user.id
      }
    };
  }
};

export default {
  generateCredentials,
  previewCredentials,
  generateImapDeterministicPassword,
  generateActualDeterministicPassword,
  MissingLdapFieldsError,
  NoActiveTemplateError
};
