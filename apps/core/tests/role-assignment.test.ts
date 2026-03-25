/**
 * Unit tests for role assignment rules.
 *
 * Tests the 6 RBAC roles from the Universal Tenant Model:
 * - platform_admin, msp_admin, msp_tech, client_admin, client_viewer, prospect
 * - Role hierarchy validation
 * - Role-tenant type compatibility
 */
import { describe, it, expect } from 'vitest';
import {
  ROLES,
  ROLE_HIERARCHY,
  hasMinimumRole,
  isPlatformRole,
  isMspRole,
  isClientRole,
  type Role,
} from '@cavaridge/auth';

describe('Role Assignment Rules', () => {
  describe('ROLES constants', () => {
    it('should define exactly 6 roles', () => {
      expect(Object.keys(ROLES)).toHaveLength(6);
    });

    it('should include all UTM standard roles', () => {
      expect(ROLES.PLATFORM_ADMIN).toBe('platform_admin');
      expect(ROLES.MSP_ADMIN).toBe('msp_admin');
      expect(ROLES.MSP_TECH).toBe('msp_tech');
      expect(ROLES.CLIENT_ADMIN).toBe('client_admin');
      expect(ROLES.CLIENT_VIEWER).toBe('client_viewer');
      expect(ROLES.PROSPECT).toBe('prospect');
    });
  });

  describe('ROLE_HIERARCHY', () => {
    it('should have platform_admin as highest privilege (index 0)', () => {
      expect(ROLE_HIERARCHY[0]).toBe('platform_admin');
    });

    it('should have prospect as lowest privilege (last index)', () => {
      expect(ROLE_HIERARCHY[ROLE_HIERARCHY.length - 1]).toBe('prospect');
    });

    it('should order roles from most to least privileged', () => {
      const expected = [
        'platform_admin',
        'msp_admin',
        'msp_tech',
        'client_admin',
        'client_viewer',
        'prospect',
      ];
      expect(ROLE_HIERARCHY).toEqual(expected);
    });

    it('should contain exactly 6 roles', () => {
      expect(ROLE_HIERARCHY).toHaveLength(6);
    });
  });

  describe('hasMinimumRole', () => {
    it('platform_admin should have minimum role for everything', () => {
      expect(hasMinimumRole('platform_admin', 'platform_admin')).toBe(true);
      expect(hasMinimumRole('platform_admin', 'msp_admin')).toBe(true);
      expect(hasMinimumRole('platform_admin', 'msp_tech')).toBe(true);
      expect(hasMinimumRole('platform_admin', 'client_admin')).toBe(true);
      expect(hasMinimumRole('platform_admin', 'client_viewer')).toBe(true);
      expect(hasMinimumRole('platform_admin', 'prospect')).toBe(true);
    });

    it('msp_admin should satisfy msp_admin and below', () => {
      expect(hasMinimumRole('msp_admin', 'platform_admin')).toBe(false);
      expect(hasMinimumRole('msp_admin', 'msp_admin')).toBe(true);
      expect(hasMinimumRole('msp_admin', 'msp_tech')).toBe(true);
      expect(hasMinimumRole('msp_admin', 'client_admin')).toBe(true);
    });

    it('msp_tech should not satisfy msp_admin', () => {
      expect(hasMinimumRole('msp_tech', 'msp_admin')).toBe(false);
      expect(hasMinimumRole('msp_tech', 'msp_tech')).toBe(true);
    });

    it('client_viewer should not satisfy client_admin', () => {
      expect(hasMinimumRole('client_viewer', 'client_admin')).toBe(false);
      expect(hasMinimumRole('client_viewer', 'client_viewer')).toBe(true);
    });

    it('prospect should only satisfy prospect', () => {
      expect(hasMinimumRole('prospect', 'prospect')).toBe(true);
      expect(hasMinimumRole('prospect', 'client_viewer')).toBe(false);
      expect(hasMinimumRole('prospect', 'platform_admin')).toBe(false);
    });

    it('same role should always satisfy itself', () => {
      for (const role of ROLE_HIERARCHY) {
        expect(hasMinimumRole(role, role)).toBe(true);
      }
    });
  });

  describe('isPlatformRole', () => {
    it('should return true for platform_admin', () => {
      expect(isPlatformRole('platform_admin')).toBe(true);
    });

    it('should return false for all other roles', () => {
      expect(isPlatformRole('msp_admin')).toBe(false);
      expect(isPlatformRole('msp_tech')).toBe(false);
      expect(isPlatformRole('client_admin')).toBe(false);
      expect(isPlatformRole('client_viewer')).toBe(false);
      expect(isPlatformRole('prospect')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isPlatformRole('')).toBe(false);
    });

    it('should return false for arbitrary string', () => {
      expect(isPlatformRole('superadmin')).toBe(false);
    });
  });

  describe('isMspRole', () => {
    it('should return true for msp_admin and msp_tech', () => {
      expect(isMspRole('msp_admin')).toBe(true);
      expect(isMspRole('msp_tech')).toBe(true);
    });

    it('should return false for non-MSP roles', () => {
      expect(isMspRole('platform_admin')).toBe(false);
      expect(isMspRole('client_admin')).toBe(false);
      expect(isMspRole('prospect')).toBe(false);
    });
  });

  describe('isClientRole', () => {
    it('should return true for client_admin and client_viewer', () => {
      expect(isClientRole('client_admin')).toBe(true);
      expect(isClientRole('client_viewer')).toBe(true);
    });

    it('should return false for non-client roles', () => {
      expect(isClientRole('platform_admin')).toBe(false);
      expect(isClientRole('msp_admin')).toBe(false);
      expect(isClientRole('prospect')).toBe(false);
    });
  });

  describe('Role-Tenant Type Compatibility', () => {
    /**
     * Validates that role assignments make sense given the tenant type.
     * These are business rules, not enforced in the auth package itself,
     * but Core API should validate them.
     */
    const ROLE_TENANT_COMPATIBILITY: Record<string, string[]> = {
      platform_admin: ['platform'],
      msp_admin: ['msp'],
      msp_tech: ['msp'],
      client_admin: ['client'],
      client_viewer: ['client', 'site'],
      prospect: ['prospect'],
    };

    it('platform_admin should only be assigned to platform tenants', () => {
      expect(ROLE_TENANT_COMPATIBILITY['platform_admin']).toEqual(['platform']);
    });

    it('msp_admin should only be assigned to MSP tenants', () => {
      expect(ROLE_TENANT_COMPATIBILITY['msp_admin']).toEqual(['msp']);
    });

    it('client_viewer can be assigned to client or site tenants', () => {
      expect(ROLE_TENANT_COMPATIBILITY['client_viewer']).toContain('client');
      expect(ROLE_TENANT_COMPATIBILITY['client_viewer']).toContain('site');
    });

    it('all 6 roles should have compatibility mappings', () => {
      expect(Object.keys(ROLE_TENANT_COMPATIBILITY)).toHaveLength(6);
    });
  });
});
