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
const deriveDeterministicChars = (seed, length) => {
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

const stableStringify = (value) => {
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
  MissingLdapFieldsError,
  NoActiveTemplateError
};
