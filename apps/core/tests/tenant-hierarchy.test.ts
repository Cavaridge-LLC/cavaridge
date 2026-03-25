/**
 * Unit tests for tenant hierarchy validation.
 *
 * Tests the UTM 4-tier hierarchy rules:
 * - Platform → MSP → Client → Site/Prospect
 * - Validates parent-child relationships
 * - Ensures illegal hierarchy paths are rejected
 */
import { describe, it, expect } from 'vitest';
import { validateHierarchy, VALID_PARENT_CHILD } from '../server/routes/tenants.js';

describe('Tenant Hierarchy Validation', () => {
  describe('validateHierarchy', () => {
    // Valid parent-child relationships
    it('should allow MSP under platform', () => {
      expect(validateHierarchy('msp', 'platform')).toBeNull();
    });

    it('should allow client under MSP', () => {
      expect(validateHierarchy('client', 'msp')).toBeNull();
    });

    it('should allow site under client', () => {
      expect(validateHierarchy('site', 'client')).toBeNull();
    });

    it('should allow prospect under MSP', () => {
      expect(validateHierarchy('prospect', 'msp')).toBeNull();
    });

    it('should allow platform with no parent', () => {
      expect(validateHierarchy('platform', null)).toBeNull();
    });

    // Invalid parent-child relationships
    it('should reject platform with a parent', () => {
      const result = validateHierarchy('platform', 'msp');
      expect(result).not.toBeNull();
      expect(result).toContain('cannot have a parent');
    });

    it('should reject MSP without a parent', () => {
      const result = validateHierarchy('msp', null);
      expect(result).not.toBeNull();
      expect(result).toContain('requires a parent');
    });

    it('should reject client without a parent', () => {
      const result = validateHierarchy('client', null);
      expect(result).not.toBeNull();
      expect(result).toContain('requires a parent');
    });

    it('should reject client under platform (must be under MSP)', () => {
      const result = validateHierarchy('client', 'platform');
      expect(result).not.toBeNull();
      expect(result).toContain('cannot be a child of');
    });

    it('should reject site under MSP (must be under client)', () => {
      const result = validateHierarchy('site', 'msp');
      expect(result).not.toBeNull();
      expect(result).toContain('cannot be a child of');
    });

    it('should reject site under platform', () => {
      const result = validateHierarchy('site', 'platform');
      expect(result).not.toBeNull();
    });

    it('should reject MSP under client', () => {
      const result = validateHierarchy('msp', 'client');
      expect(result).not.toBeNull();
      expect(result).toContain('cannot be a child of');
    });

    it('should reject MSP under MSP (no lateral nesting)', () => {
      const result = validateHierarchy('msp', 'msp');
      expect(result).not.toBeNull();
    });

    it('should reject prospect under client (must be under MSP)', () => {
      const result = validateHierarchy('prospect', 'client');
      expect(result).not.toBeNull();
    });

    it('should reject prospect under platform', () => {
      const result = validateHierarchy('prospect', 'platform');
      expect(result).not.toBeNull();
    });

    it('should reject site without a parent', () => {
      const result = validateHierarchy('site', null);
      expect(result).not.toBeNull();
    });

    it('should reject prospect without a parent', () => {
      const result = validateHierarchy('prospect', null);
      expect(result).not.toBeNull();
    });
  });

  describe('VALID_PARENT_CHILD mapping', () => {
    it('should have empty array for platform (no parents allowed)', () => {
      expect(VALID_PARENT_CHILD['platform']).toEqual([]);
    });

    it('should list platform as valid parent for MSP', () => {
      expect(VALID_PARENT_CHILD['msp']).toContain('platform');
    });

    it('should list MSP as valid parent for client', () => {
      expect(VALID_PARENT_CHILD['client']).toContain('msp');
    });

    it('should list client as valid parent for site', () => {
      expect(VALID_PARENT_CHILD['site']).toContain('client');
    });

    it('should list MSP as valid parent for prospect', () => {
      expect(VALID_PARENT_CHILD['prospect']).toContain('msp');
    });

    it('should cover all 5 tenant types', () => {
      const types = Object.keys(VALID_PARENT_CHILD);
      expect(types).toContain('platform');
      expect(types).toContain('msp');
      expect(types).toContain('client');
      expect(types).toContain('site');
      expect(types).toContain('prospect');
    });
  });
});
