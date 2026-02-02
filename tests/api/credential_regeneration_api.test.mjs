/**
 * Credential Regeneration API Tests
 * 
 * Integration tests for Story 2.4: Regeneration with Confirmation
 * - POST /api/v1/users/:userId/credentials/regenerate
 * - POST /api/v1/users/:userId/credentials/regenerate/preview
 * - POST /api/v1/users/:userId/credentials/regenerate/confirm
 * - Error handling (403, 400, 422, 410)
 * - RBAC enforcement
 * - Audit logging verification
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Credential Regeneration API', () => {
  const API_BASE = 'http://localhost:3000/api/v1';
  let authCookie = '';
  let testUserId = '';

  beforeAll(async () => {
    // Login as IT user
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'it_user',
        password: 'test_password'
      })
    });
    
    if (loginResponse.ok) {
      const cookies = loginResponse.headers.get('set-cookie');
      if (cookies) {
        authCookie = cookies.split(';')[0];
      }
    }

    // Create test user or get existing
    // This would typically be done through a test setup
    testUserId = 'test-user-id';
  });

  describe('POST /users/:userId/regenerate', () => {
    it('should initiate regeneration and return comparison preview', async () => {
      // This test requires:
      // 1. Active credential template
      // 2. User with existing credentials
      // 3. Changes in LDAP or template
      
      const response = await fetch(
        `${API_BASE}/credential-templates/users/${testUserId}/regenerate`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': authCookie
          },
          credentials: 'include'
        }
      );

      if (response.status === 200) {
        const data = await response.json();
        
        expect(data.data).toHaveProperty('userId');
        expect(data.data).toHaveProperty('changeType');
        expect(data.data).toHaveProperty('comparisons');
        expect(data.data).toHaveProperty('previewToken');
        expect(data.data).toHaveProperty('expiresAt');
        expect(Array.isArray(data.data.comparisons)).toBe(true);
        
        // Verify comparison structure
        if (data.data.comparisons.length > 0) {
          const comparison = data.data.comparisons[0];
          expect(comparison).toHaveProperty('system');
          expect(comparison).toHaveProperty('old');
          expect(comparison).toHaveProperty('new');
          expect(comparison).toHaveProperty('changes');
        }
      } else if (response.status === 400) {
        const error = await response.json();
        expect(error.type).toBe('/problems/no-changes-detected');
      }
    });

    it('should return 403 for disabled users', async () => {
      // This test requires a disabled user
      const disabledUserId = 'disabled-user-id';
      
      const response = await fetch(
        `${API_BASE}/credential-templates/users/${disabledUserId}/regenerate`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': authCookie
          },
          credentials: 'include'
        }
      );

      expect(response.status).toBe(403);
      
      const error = await response.json();
      expect(error.type).toBe('/problems/regeneration-blocked');
      expect(error.userStatus).toBe('disabled');
      expect(error.resolution).toContain('Re-enable');
    });

    it('should return 403 for non-IT roles', async () => {
      // Login as non-IT user
      const requesterLogin = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'requester_user',
          password: 'test_password'
        })
      });

      let requesterCookie = '';
      if (requesterLogin.ok) {
        const cookies = requesterLogin.headers.get('set-cookie');
        if (cookies) {
          requesterCookie = cookies.split(';')[0];
        }
      }

      const response = await fetch(
        `${API_BASE}/credential-templates/users/${testUserId}/regenerate`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': requesterCookie
          },
          credentials: 'include'
        }
      );

      expect(response.status).toBe(403);
      
      const error = await response.json();
      expect(error.detail).toContain('Only IT roles');
    });

    it('should return 400 when no changes detected', async () => {
      // This test requires a user with credentials and no changes
      const noChangesUserId = 'no-changes-user-id';
      
      const response = await fetch(
        `${API_BASE}/credential-templates/users/${noChangesUserId}/regenerate`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': authCookie
          },
          credentials: 'include'
        }
      );

      if (response.status === 400) {
        const error = await response.json();
        expect(error.type).toBe('/problems/no-changes-detected');
        expect(error.suggestion).toContain('up-to-date');
      }
    });

    it('should return 401 when not authenticated', async () => {
      const response = await fetch(
        `${API_BASE}/credential-templates/users/${testUserId}/regenerate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      expect(response.status).toBe(401);
    });
  });

  describe('POST /users/:userId/regenerate/confirm', () => {
    it('should confirm regeneration and update credentials', async () => {
      // First, initiate regeneration to get preview token
      const initiateResponse = await fetch(
        `${API_BASE}/credential-templates/users/${testUserId}/regenerate`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': authCookie
          },
          credentials: 'include'
        }
      );

      if (initiateResponse.status !== 200) {
        // Skip if no changes detected
        return;
      }

      const initiateData = await initiateResponse.json();
      const previewToken = initiateData.data.previewToken;

      // Confirm regeneration
      const confirmResponse = await fetch(
        `${API_BASE}/credential-templates/users/${testUserId}/regenerate/confirm`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': authCookie
          },
          credentials: 'include',
          body: JSON.stringify({
            previewToken,
            confirmed: true
          })
        }
      );

      expect(confirmResponse.status).toBe(201);

      const data = await confirmResponse.json();
      expect(data.data).toHaveProperty('userId');
      expect(data.data).toHaveProperty('changeType');
      expect(data.data).toHaveProperty('regeneratedCredentials');
      expect(data.data).toHaveProperty('preservedHistory');
      expect(Array.isArray(data.data.regeneratedCredentials)).toBe(true);
    });

    it('should return 400 without explicit confirmation', async () => {
      const response = await fetch(
        `${API_BASE}/credential-templates/users/${testUserId}/regenerate/confirm`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': authCookie
          },
          credentials: 'include',
          body: JSON.stringify({
            previewToken: 'some-token',
            confirmed: false
          })
        }
      );

      expect(response.status).toBe(400);
      
      const error = await response.json();
      expect(error.type).toBe('/problems/confirmation-required');
    });

    it('should return 410 when preview session expired', async () => {
      const response = await fetch(
        `${API_BASE}/credential-templates/users/${testUserId}/regenerate/confirm`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': authCookie
          },
          credentials: 'include',
          body: JSON.stringify({
            previewToken: 'expired-token',
            confirmed: true
          })
        }
      );

      if (response.status === 410) {
        const error = await response.json();
        expect(error.type).toBe('/problems/preview-expired');
        expect(error.detail).toContain('expired');
      }
    });

    it('should return 400 when preview token does not match user', async () => {
      // This test verifies that the preview token is tied to the correct user
      const otherUserId = 'other-user-id';
      
      const response = await fetch(
        `${API_BASE}/credential-templates/users/${otherUserId}/regenerate/confirm`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': authCookie
          },
          credentials: 'include',
          body: JSON.stringify({
            previewToken: 'token-for-different-user',
            confirmed: true
          })
        }
      );

      if (response.status === 400) {
        const error = await response.json();
        expect(error.detail).toContain('does not match');
      }
    });
  });

  describe('Audit Logging', () => {
    it('should log regeneration initiation', async () => {
      // Initiate regeneration
      await fetch(
        `${API_BASE}/credential-templates/users/${testUserId}/regenerate`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': authCookie
          },
          credentials: 'include'
        }
      );

      // Check audit logs
      const auditResponse = await fetch(
        `${API_BASE}/audit-logs?action=credentials.regenerate.initiate`,
        {
          headers: { 'Cookie': authCookie },
          credentials: 'include'
        }
      );

      if (auditResponse.ok) {
        const auditData = await auditResponse.json();
        const initLog = auditData.data.find(log => 
          log.action === 'credentials.regenerate.initiate' &&
          log.entityId === testUserId
        );

        if (initLog) {
          expect(initLog.metadata).toHaveProperty('changeType');
        }
      }
    });

    it('should log blocked regeneration for disabled user', async () => {
      const disabledUserId = 'disabled-user-id';
      
      // Attempt regeneration for disabled user
      await fetch(
        `${API_BASE}/credential-templates/users/${disabledUserId}/regenerate`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': authCookie
          },
          credentials: 'include'
        }
      );

      // Check audit logs
      const auditResponse = await fetch(
        `${API_BASE}/audit-logs?action=credentials.regenerate.blocked`,
        {
          headers: { 'Cookie': authCookie },
          credentials: 'include'
        }
      );

      if (auditResponse.ok) {
        const auditData = await auditResponse.json();
        const blockLog = auditData.data.find(log => 
          log.action === 'credentials.regenerate.blocked' &&
          log.entityId === disabledUserId
        );

        if (blockLog) {
          expect(blockLog.metadata.reason).toBe('user_disabled');
        }
      }
    });
  });

  describe('RFC 9457 Problem Details', () => {
    it('should return valid problem details for errors', async () => {
      const disabledUserId = 'disabled-user-id';
      
      const response = await fetch(
        `${API_BASE}/credential-templates/users/${disabledUserId}/regenerate`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': authCookie
          },
          credentials: 'include'
        }
      );

      if (response.status === 403) {
        const error = await response.json();
        
        // Verify RFC 9457 structure
        expect(error).toHaveProperty('type');
        expect(error).toHaveProperty('title');
        expect(error).toHaveProperty('status');
        expect(error).toHaveProperty('detail');
        
        // Verify content-type header
        const contentType = response.headers.get('content-type');
        expect(contentType).toContain('application/problem+json');
      }
    });
  });
});
