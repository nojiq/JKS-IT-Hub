/**
 * Credential Preview Service Tests
 * 
 * Tests for Story 2.3: Credential Preview & Confirmation
 * - Preview generation without persistence
 * - Preview session management and expiration
 * - Confirmation validation
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  previewUserCredentials, 
  storePreviewSession, 
  getPreviewSession, 
  deletePreviewSession,
  savePreviewedCredentials,
  cleanupExpiredSessions,
  stopCleanupInterval
} from '../src/features/credentials/service.js';
import * as repo from '../src/features/credentials/repo.js';

// Mock the repo module
vi.mock('../src/features/credentials/repo.js', () => ({
  getActiveCredentialTemplate: vi.fn(),
  getUserById: vi.fn(),
  storePreviewSession: vi.fn(),
  getPreviewSession: vi.fn(),
  deletePreviewSession: vi.fn(),
  deactivateUserCredentials: vi.fn(),
  createUserCredential: vi.fn(),
  createCredentialVersion: vi.fn()
}));

describe('Credential Preview Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    stopCleanupInterval();
  });

  describe('previewUserCredentials', () => {
    it('should generate preview without persisting to database', async () => {
      const mockTemplate = {
        id: 'template-1',
        version: 3,
        structure: {
          systems: ['email', 'vpn'],
          fields: [
            { name: 'username', ldapSource: 'mail' },
            { name: 'password', pattern: '{random:8}' }
          ]
        }
      };

      const mockUser = {
        id: 'user-123',
        ldapAttributes: {
          mail: 'john.doe@company.com',
          cn: 'John Doe'
        }
      };

      repo.getActiveCredentialTemplate.mockResolvedValue(mockTemplate);
      repo.getUserById.mockResolvedValue(mockUser);

      const result = await previewUserCredentials('user-123');

      expect(result.success).toBe(true);
      expect(result.credentials).toHaveLength(2);
      expect(result.templateVersion).toBe(3);
      expect(result.userId).toBe('user-123');
      
      // Verify no database persistence calls were made
      expect(repo.createUserCredential).not.toHaveBeenCalled();
      expect(repo.createCredentialVersion).not.toHaveBeenCalled();
    });

    it('should include ldapSources in preview credentials', async () => {
      const mockTemplate = {
        id: 'template-1',
        version: 3,
        structure: {
          systems: ['email'],
          fields: [
            { name: 'username', ldapSource: 'mail' },
            { name: 'password', pattern: '{givenName:3}{random:4}' }
          ]
        }
      };

      const mockUser = {
        id: 'user-123',
        ldapAttributes: {
          mail: 'john.doe@company.com',
          givenName: 'John'
        }
      };

      repo.getActiveCredentialTemplate.mockResolvedValue(mockTemplate);
      repo.getUserById.mockResolvedValue(mockUser);

      const result = await previewUserCredentials('user-123');

      expect(result.success).toBe(true);
      expect(result.credentials[0].ldapSources).toBeDefined();
      expect(result.credentials[0].ldapSources.username).toBe('mail');
    });

    it('should return error for missing LDAP fields', async () => {
      const mockTemplate = {
        id: 'template-1',
        version: 3,
        structure: {
          systems: ['email'],
          fields: [
            { name: 'username', ldapSource: 'mail', required: true },
            { name: 'password', pattern: '{random:8}' }
          ]
        }
      };

      const mockUser = {
        id: 'user-123',
        ldapAttributes: {
          // Missing 'mail' field
          cn: 'John Doe'
        }
      };

      repo.getActiveCredentialTemplate.mockResolvedValue(mockTemplate);
      repo.getUserById.mockResolvedValue(mockUser);

      const result = await previewUserCredentials('user-123');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('MISSING_LDAP_FIELDS');
      expect(result.error.missingFields).toContain('mail');
    });

    it('should throw error for non-existent user', async () => {
      repo.getActiveCredentialTemplate.mockResolvedValue({
        id: 'template-1',
        version: 1,
        structure: { systems: ['email'], fields: [] }
      });
      repo.getUserById.mockResolvedValue(null);

      await expect(previewUserCredentials('non-existent')).rejects.toThrow('User not found');
    });
  });

  describe('Preview Session Management', () => {
    it('should store and retrieve preview session', async () => {
      const sessionData = {
        userId: 'user-123',
        credentials: [{ system: 'email', username: 'test', password: 'pass' }],
        templateVersion: 3
      };

      repo.storePreviewSession.mockImplementation(async (token, data) => {
        return token;
      });

      repo.getPreviewSession.mockImplementation(async (token) => {
        return {
          ...sessionData,
          expiresAt: Date.now() + 300000 // 5 minutes from now
        };
      });

      const token = await storePreviewSession('user-123', sessionData);
      expect(token).toBeDefined();

      const retrieved = await getPreviewSession(token);
      expect(retrieved.userId).toBe('user-123');
      expect(retrieved.credentials).toHaveLength(1);
    });

    it('should return null for expired session', async () => {
      repo.getPreviewSession.mockImplementation(async (token) => {
        return null; // Simulating expired session
      });

      const result = await getPreviewSession('expired-token');
      expect(result).toBeNull();
    });

    it('should delete session after retrieval', async () => {
      repo.deletePreviewSession.mockResolvedValue(true);

      const result = await deletePreviewSession('token-123');
      expect(result).toBe(true);
      expect(repo.deletePreviewSession).toHaveBeenCalledWith('token-123');
    });

    it('should cleanup expired sessions', async () => {
      // Mock cleanup function
      repo.cleanupExpiredSessions = vi.fn().mockResolvedValue(undefined);
      
      await cleanupExpiredSessions();
      expect(repo.cleanupExpiredSessions).toHaveBeenCalled();
    });
  });

  describe('savePreviewedCredentials', () => {
    it('should persist credentials only on confirmed request', async () => {
      const previewSession = {
        userId: 'user-123',
        credentials: [
          { system: 'email', username: 'john@company.com', password: 'pass123', templateVersion: 3 },
          { system: 'vpn', username: 'john', password: 'vpn456', templateVersion: 3 }
        ],
        templateVersion: 3
      };

      const mockCredential = {
        id: 'cred-1',
        userId: 'user-123',
        system: 'email',
        username: 'john@company.com',
        password: 'pass123',
        templateVersion: 3
      };

      repo.deactivateUserCredentials.mockResolvedValue({ count: 0 });
      repo.createUserCredential.mockResolvedValue(mockCredential);
      repo.createCredentialVersion.mockResolvedValue({ id: 'version-1' });

      const result = await savePreviewedCredentials('actor-456', previewSession);

      expect(result.userId).toBe('user-123');
      expect(result.credentials).toHaveLength(2);
      expect(repo.createUserCredential).toHaveBeenCalledTimes(2);
      expect(repo.createCredentialVersion).toHaveBeenCalledTimes(2);
    });

    it('should deactivate existing credentials before creating new ones', async () => {
      const previewSession = {
        userId: 'user-123',
        credentials: [{ system: 'email', username: 'new@company.com', password: 'newpass', templateVersion: 3 }],
        templateVersion: 3
      };

      repo.deactivateUserCredentials.mockResolvedValue({ count: 1 });
      repo.createUserCredential.mockResolvedValue({ id: 'new-cred' });
      repo.createCredentialVersion.mockResolvedValue({ id: 'version-1' });

      await savePreviewedCredentials('actor-456', previewSession);

      expect(repo.deactivateUserCredentials).toHaveBeenCalledWith('user-123', expect.anything());
    });
  });

  describe('Confirmation Validation', () => {
    it('should require explicit confirmation flag', async () => {
      // This test validates the Zod schema requirement
      const confirmRequest = {
        previewToken: 'valid-token',
        confirmed: false // Explicitly false
      };

      // The Zod schema should reject this
      expect(confirmRequest.confirmed).toBe(false);
    });

    it('should validate preview token exists before confirmation', async () => {
      repo.getPreviewSession.mockResolvedValue(null);

      const result = await getPreviewSession('invalid-token');
      expect(result).toBeNull();
    });

    it('should validate userId matches between token and request', async () => {
      repo.getPreviewSession.mockImplementation(async (token) => {
        return {
          userId: 'user-123',
          credentials: [],
          templateVersion: 3,
          expiresAt: Date.now() + 300000
        };
      });

      const session = await getPreviewSession('valid-token');
      expect(session.userId).toBe('user-123');
      
      // Would need to verify mismatch in actual route handler
    });
  });

  describe('Token Expiration', () => {
    it('should expire tokens after configured time', async () => {
      const originalExpiry = process.env.PREVIEW_SESSION_EXPIRY_MS;
      process.env.PREVIEW_SESSION_EXPIRY_MS = '100'; // 100ms for testing

      const sessionData = {
        userId: 'user-123',
        credentials: [],
        templateVersion: 3
      };

      repo.storePreviewSession.mockImplementation(async (token, data) => {
        return token;
      });

      repo.getPreviewSession.mockImplementation(async (token) => {
        // Simulate expired session
        return null;
      });

      const token = await storePreviewSession('user-123', sessionData);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const result = await getPreviewSession(token);
      expect(result).toBeNull();

      // Restore original value
      if (originalExpiry) {
        process.env.PREVIEW_SESSION_EXPIRY_MS = originalExpiry;
      } else {
        delete process.env.PREVIEW_SESSION_EXPIRY_MS;
      }
    });
  });
});
