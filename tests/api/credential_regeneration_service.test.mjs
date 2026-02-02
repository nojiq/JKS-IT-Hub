/**
 * Credential Regeneration Service Tests
 * 
 * Tests for Story 2.4: Regeneration with Confirmation
 * - Change detection (LDAP and template changes)
 * - Credential comparison building
 * - Regeneration preview with comparison
 * - Confirmation and atomic updates
 * - Error handling (disabled users, no changes)
 * - History preservation
 * - Locked credential handling (preparation for Story 2.9)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  detectChanges,
  buildCredentialComparison,
  previewCredentialRegeneration,
  storeRegenerationPreview,
  confirmRegeneration,
  DisabledUserError,
  NoChangesDetectedError
} from '../src/features/credentials/service.js';
import * as repo from '../src/features/credentials/repo.js';
import { prisma } from '../src/shared/db/prisma.js';

// Mock the repo module
vi.mock('../src/features/credentials/repo.js', () => ({
  getActiveCredentialTemplate: vi.fn(),
  getUserById: vi.fn(),
  getUserCredentials: vi.fn(),
  getUserCredentialBySystem: vi.fn(),
  deactivateUserCredential: vi.fn(),
  createUserCredential: vi.fn(),
  createCredentialVersion: vi.fn(),
  storePreviewSession: vi.fn(),
  getPreviewSession: vi.fn(),
  deletePreviewSession: vi.fn()
}));

vi.mock('../src/shared/db/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn((callback) => callback({}))
  }
}));

describe('Credential Regeneration Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectChanges', () => {
    it('should detect template version change', () => {
      const user = {
        id: 'user-123',
        ldapAttributes: { mail: 'john@company.com' }
      };
      
      const existingCredentials = [
        { system: 'email', templateVersion: 2, ldapSources: { username: 'mail' } }
      ];
      
      const template = { version: 3 };

      const result = detectChanges(user, existingCredentials, template);

      expect(result.templateChanged).toBe(true);
      expect(result.ldapChanged).toBe(false);
      expect(result.oldTemplateVersion).toBe(2);
      expect(result.newTemplateVersion).toBe(3);
    });

    it('should detect LDAP field changes', () => {
      const user = {
        id: 'user-123',
        ldapAttributes: { mail: 'john.new@company.com', cn: 'John Doe' }
      };
      
      const existingCredentials = [
        { 
          system: 'email', 
          templateVersion: 2, 
          ldapSources: { username: 'mail' },
          username: 'john.old@company.com'
        }
      ];
      
      const template = { version: 2 };

      const result = detectChanges(user, existingCredentials, template);

      expect(result.ldapChanged).toBe(true);
      expect(result.templateChanged).toBe(false);
      expect(result.changedLdapFields).toContain('mail');
    });

    it('should detect both LDAP and template changes', () => {
      const user = {
        id: 'user-123',
        ldapAttributes: { mail: 'john.new@company.com' }
      };
      
      const existingCredentials = [
        { 
          system: 'email', 
          templateVersion: 2, 
          ldapSources: { username: 'mail' },
          username: 'john.old@company.com'
        }
      ];
      
      const template = { version: 3 };

      const result = detectChanges(user, existingCredentials, template);

      expect(result.ldapChanged).toBe(true);
      expect(result.templateChanged).toBe(true);
      expect(result.oldTemplateVersion).toBe(2);
      expect(result.newTemplateVersion).toBe(3);
    });

    it('should treat as new if no existing credentials', () => {
      const user = {
        id: 'user-123',
        ldapAttributes: { mail: 'john@company.com' }
      };
      
      const existingCredentials = [];
      const template = { version: 1 };

      const result = detectChanges(user, existingCredentials, template);

      expect(result.ldapChanged).toBe(true);
      expect(result.templateChanged).toBe(false);
    });
  });

  describe('buildCredentialComparison', () => {
    it('should build comparison for changed credentials', () => {
      const oldCredentials = [
        { system: 'email', username: 'old@company.com', password: 'oldpass123' }
      ];
      
      const newCredentials = [
        { system: 'email', username: 'new@company.com', password: 'newpass456' }
      ];
      
      const changes = { ldapChanged: true, changedLdapFields: ['mail'] };

      const result = buildCredentialComparison(oldCredentials, newCredentials, changes);

      expect(result).toHaveLength(1);
      expect(result[0].system).toBe('email');
      expect(result[0].old.username).toBe('old@company.com');
      expect(result[0].new.username).toBe('new@company.com');
      expect(result[0].changes).toContain('username');
      expect(result[0].changes).toContain('password');
    });

    it('should handle new systems', () => {
      const oldCredentials = [
        { system: 'email', username: 'user@company.com', password: 'pass123' }
      ];
      
      const newCredentials = [
        { system: 'email', username: 'user@company.com', password: 'pass123' },
        { system: 'vpn', username: 'user', password: 'vpn456' }
      ];
      
      const changes = { templateChanged: true };

      const result = buildCredentialComparison(oldCredentials, newCredentials, changes);

      expect(result).toHaveLength(2);
      const vpnComparison = result.find(c => c.system === 'vpn');
      expect(vpnComparison.changes).toContain('new_system');
    });

    it('should handle removed systems', () => {
      const oldCredentials = [
        { system: 'email', username: 'user@company.com', password: 'pass123' },
        { system: 'vpn', username: 'user', password: 'vpn456' }
      ];
      
      const newCredentials = [
        { system: 'email', username: 'user@company.com', password: 'pass123' }
      ];
      
      const changes = { templateChanged: true };

      const result = buildCredentialComparison(oldCredentials, newCredentials, changes);

      expect(result).toHaveLength(2);
      const vpnComparison = result.find(c => c.system === 'vpn');
      expect(vpnComparison.changes).toContain('removed_system');
    });

    it('should handle locked credentials (preparation for Story 2.9)', () => {
      const oldCredentials = [
        { system: 'email', username: 'user@company.com', password: 'pass123', isLocked: false },
        { system: 'vpn', username: 'user', password: 'vpn456', isLocked: true }
      ];
      
      const newCredentials = [
        { system: 'email', username: 'user@company.com', password: 'newpass789', isLocked: false }
      ];
      
      const changes = { ldapChanged: true };

      const result = buildCredentialComparison(oldCredentials, newCredentials, changes);

      const vpnComparison = result.find(c => c.system === 'vpn');
      expect(vpnComparison.skipped).toBe(true);
      expect(vpnComparison.skipReason).toBe('credential_locked');
    });
  });

  describe('previewCredentialRegeneration', () => {
    it('should throw DisabledUserError for disabled users', async () => {
      const mockUser = {
        id: 'user-123',
        status: 'disabled',
        ldapAttributes: {}
      };

      repo.getUserById.mockResolvedValue(mockUser);
      repo.getActiveCredentialTemplate.mockResolvedValue({ version: 1 });

      await expect(previewCredentialRegeneration('user-123'))
        .rejects
        .toThrow(DisabledUserError);
    });

    it('should throw NoChangesDetectedError when no changes exist', async () => {
      const mockUser = {
        id: 'user-123',
        status: 'active',
        ldapAttributes: { mail: 'john@company.com' }
      };

      const mockTemplate = {
        version: 2,
        structure: {
          systems: ['email'],
          fields: [
            { name: 'username', ldapSource: 'mail' },
            { name: 'password', pattern: '{random:8}' }
          ]
        }
      };

      const existingCredentials = [
        { 
          system: 'email', 
          templateVersion: 2, 
          ldapSources: { username: 'mail' },
          username: 'john@company.com',
          generatedAt: new Date('2026-01-01')
        }
      ];

      repo.getUserById.mockResolvedValue(mockUser);
      repo.getActiveCredentialTemplate.mockResolvedValue(mockTemplate);
      repo.getUserCredentials.mockResolvedValue(existingCredentials);

      await expect(previewCredentialRegeneration('user-123'))
        .rejects
        .toThrow(NoChangesDetectedError);
    });

    it('should generate preview with comparison when changes detected', async () => {
      const mockUser = {
        id: 'user-123',
        status: 'active',
        ldapAttributes: { mail: 'john.new@company.com' }
      };

      const mockTemplate = {
        version: 3,
        structure: {
          systems: ['email'],
          fields: [
            { name: 'username', ldapSource: 'mail' },
            { name: 'password', pattern: '{random:8}' }
          ]
        }
      };

      const existingCredentials = [
        { 
          system: 'email', 
          templateVersion: 2, 
          ldapSources: { username: 'mail' },
          username: 'john.old@company.com'
        }
      ];

      repo.getUserById.mockResolvedValue(mockUser);
      repo.getActiveCredentialTemplate.mockResolvedValue(mockTemplate);
      repo.getUserCredentials.mockResolvedValue(existingCredentials);

      const result = await previewCredentialRegeneration('user-123');

      expect(result.success).toBe(true);
      expect(result.changeType).toBe('both');
      expect(result.comparisons).toHaveLength(1);
      expect(result.oldTemplateVersion).toBe(2);
      expect(result.newTemplateVersion).toBe(3);
    });
  });

  describe('confirmRegeneration', () => {
    it('should execute atomic regeneration with history preservation', async () => {
      const mockUser = {
        id: 'user-123',
        status: 'active'
      };

      const mockOldCredential = {
        id: 'cred-1',
        system: 'email',
        username: 'old@company.com',
        password: 'oldpass'
      };

      const mockNewCredential = {
        id: 'cred-2',
        system: 'email',
        username: 'new@company.com',
        password: 'newpass'
      };

      const previewSession = {
        type: 'regeneration',
        userId: 'user-123',
        changeType: 'ldap_update',
        newTemplateVersion: 3,
        comparisons: [
          {
            system: 'email',
            old: { username: 'old@company.com', password: 'oldpass' },
            new: { username: 'new@company.com', password: 'newpass' },
            changes: ['username', 'password'],
            skipped: false
          }
        ],
        newCredentials: [
          { system: 'email', username: 'new@company.com', password: 'newpass' }
        ],
        existingCredentialIds: ['cred-1']
      };

      repo.getUserById.mockResolvedValue(mockUser);
      repo.getUserCredentialBySystem.mockResolvedValue(mockOldCredential);
      repo.deactivateUserCredential.mockResolvedValue({});
      repo.createUserCredential.mockResolvedValue(mockNewCredential);
      repo.createCredentialVersion.mockResolvedValue({});

      const result = await confirmRegeneration('admin-123', previewSession);

      expect(result.userId).toBe('user-123');
      expect(result.changeType).toBe('ldap_update');
      expect(result.regeneratedCredentials).toHaveLength(1);
      expect(result.preservedHistory).toHaveLength(1);
      
      // Verify history was created before deactivation
      expect(repo.createCredentialVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          credentialId: 'cred-1',
          reason: 'regeneration',
          createdBy: 'admin-123'
        }),
        expect.anything()
      );
    });

    it('should throw DisabledUserError if user disabled during confirmation', async () => {
      const mockUser = {
        id: 'user-123',
        status: 'disabled'
      };

      const previewSession = {
        type: 'regeneration',
        userId: 'user-123',
        comparisons: []
      };

      repo.getUserById.mockResolvedValue(mockUser);

      await expect(confirmRegeneration('admin-123', previewSession))
        .rejects
        .toThrow(DisabledUserError);
    });

    it('should skip locked credentials during regeneration', async () => {
      const mockUser = {
        id: 'user-123',
        status: 'active'
      };

      const previewSession = {
        type: 'regeneration',
        userId: 'user-123',
        changeType: 'ldap_update',
        newTemplateVersion: 3,
        comparisons: [
          {
            system: 'email',
            old: { username: 'user@company.com', password: 'pass123', isLocked: false },
            new: { username: 'user@company.com', password: 'newpass456', isLocked: false },
            changes: ['password'],
            skipped: false
          },
          {
            system: 'vpn',
            old: { username: 'user', password: 'vpn789', isLocked: true },
            new: null,
            changes: [],
            skipped: true,
            skipReason: 'credential_locked'
          }
        ],
        newCredentials: [
          { system: 'email', username: 'user@company.com', password: 'newpass456' }
        ],
        existingCredentialIds: ['cred-1', 'cred-2']
      };

      repo.getUserById.mockResolvedValue(mockUser);
      repo.getUserCredentialBySystem.mockResolvedValue({ id: 'cred-1' });
      repo.createUserCredential.mockResolvedValue({ id: 'cred-3' });

      const result = await confirmRegeneration('admin-123', previewSession);

      expect(result.regeneratedCredentials).toHaveLength(1);
      expect(result.skippedCredentials).toHaveLength(1);
      expect(result.skippedCredentials[0].system).toBe('vpn');
    });
  });

  describe('storeRegenerationPreview', () => {
    it('should store regeneration preview with correct structure', async () => {
      const preview = {
        changeType: 'ldap_update',
        changedLdapFields: ['mail'],
        oldTemplateVersion: 2,
        newTemplateVersion: 3,
        comparisons: [],
        newCredentials: [],
        existingCredentials: [{ id: 'cred-1' }]
      };

      repo.storePreviewSession.mockResolvedValue('regen_token_123');

      const result = await storeRegenerationPreview('user-123', preview);

      expect(result).toMatch(/^regen_/);
      expect(repo.storePreviewSession).toHaveBeenCalledWith(
        expect.stringMatching(/^regen_/),
        expect.objectContaining({
          type: 'regeneration',
          userId: 'user-123',
          changeType: 'ldap_update'
        })
      );
    });
  });
});
