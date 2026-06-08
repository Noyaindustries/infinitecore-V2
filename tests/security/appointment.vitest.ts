import { describe, expect, it } from 'vitest';
import { parseAppointmentBody } from '../../src/lib/appAppointment';

describe('sécurité — rendez-vous application', () => {
  it('rejette un payload incomplet', () => {
    const result = parseAppointmentBody({ appId: 'erp-multi-ecole' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/requis/i);
    }
  });

  it('normalise e-mail et conserve les champs obligatoires', () => {
    const result = parseAppointmentBody({
      appId: 'erp-multi-ecole',
      appTitle: 'ERP Multi-École',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+22501020304',
      email: '  Test@Example.COM ',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.email).toBe('test@example.com');
      expect(result.data.appId).toBe('erp-multi-ecole');
    }
  });

  it('ignore les scripts dans les champs texte (stockage brut, rendu côté React)', () => {
    const result = parseAppointmentBody({
      appId: 'erp-multi-ecole',
      firstName: '<script>alert(1)</script>',
      lastName: 'Test',
      phone: '0700000000',
      message: '<img onerror=alert(1)>',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.firstName).toContain('<script>');
      expect(result.data.message).toContain('onerror');
    }
  });
});
