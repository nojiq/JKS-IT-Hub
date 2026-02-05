/**
 * Credential Export Service Tests
 * 
 * Tests for Story 3.1: Single-User Credential Export
 * - Format export with title line and per-system entries
 * - Proper error handling (disabled users, not found, no credentials)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatCredentialExport, DisabledUserError } from '../../apps/api/src/features/exports/service.js';

describe('Credential Export Service', () => {
  describe('formatCredentialExport', () => {
    it('should format export with title line and entries', () => {
      const user = {
        id: 'user-123',
        username: 'john.doe',
        email: 'john.doe@company.com',
        displayName: 'John Doe'
      };

      const credentials = [
        {
          username: 'jdoe',
          password: 'AbCdEfGh12#!',
          systemConfig: {
            systemId: 'active-directory',
            description: 'Active Directory'
          }
        },
        {
          username: 'jdoe',
          password: 'XyZ987$%^&',
          systemConfig: {
            systemId: 'vpn',
            description: 'VPN'
          }
        }
      ];

      const result = formatCredentialExport(user, credentials);

      assert.ok(result.includes('IT-HUB CREDENTIAL EXPORT'));
      assert.ok(result.includes('Generated:'));
      assert.ok(result.includes('User: John Doe'));
      assert.ok(result.includes('Systems: 2'));
      assert.ok(result.includes('Active Directory'));
      assert.ok(result.includes('Username: jdoe'));
      assert.ok(result.includes('Password: AbCdEfGh12#!'));
      assert.ok(result.includes('VPN'));
      assert.ok(result.includes('Password: XyZ987$%^&'));
      assert.ok(result.includes('End of export'));
    });

    it('should handle empty credentials list', () => {
      const user = {
        id: 'user-123',
        username: 'john.doe'
      };

      const credentials = [];

      const result = formatCredentialExport(user, credentials);

      assert.ok(result.includes('IT-HUB CREDENTIAL EXPORT'));
      assert.ok(result.includes('Systems: 0'));
      assert.ok(result.includes('End of export'));
    });

    it('should use systemId as fallback when description not available', () => {
      const user = {
        id: 'user-123',
        username: 'john.doe'
      };

      const credentials = [
        {
          username: 'jdoe',
          password: 'AbCdEfGh12#!',
          systemConfig: {
            systemId: 'file-server',
            description: null
          }
        }
      ];

      const result = formatCredentialExport(user, credentials);

      assert.ok(result.includes('file-server'));
    });

    it('should use username as fallback for displayName', () => {
      const user = {
        id: 'user-123',
        username: 'john.doe',
        email: 'john.doe@company.com'
      };

      const credentials = [];

      const result = formatCredentialExport(user, credentials);

      assert.ok(result.includes('User: john.doe'));
    });

    it('should use email as fallback when no displayName', () => {
      const user = {
        id: 'user-123',
        email: 'john.doe@company.com'
      };

      const credentials = [];

      const result = formatCredentialExport(user, credentials);

      assert.ok(result.includes('User: john.doe@company.com'));
    });

    it('should handle credentials with legacy systemId field', () => {
      const user = {
        id: 'user-123',
        username: 'john.doe'
      };

      const credentials = [
        {
          username: 'jdoe',
          password: 'AbCdEfGh12#!',
          system: 'legacy-system'
        }
      ];

      const result = formatCredentialExport(user, credentials);

      assert.ok(result.includes('legacy-system'));
    });
  });

  describe('DisabledUserError', () => {
    it('should create error with proper structure', () => {
      const error = new DisabledUserError('user-123');

      assert.strictEqual(error.message, 'Cannot export credentials for disabled users');
      assert.strictEqual(error.name, 'DisabledUserError');
      assert.strictEqual(error.code, 'DISABLED_USER');
      assert.strictEqual(error.userId, 'user-123');
    });
  });
});
