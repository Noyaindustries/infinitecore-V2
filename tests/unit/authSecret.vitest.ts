import { describe, expect, it } from 'vitest';
import { NEXTAUTH_SECRET_MIN_LENGTH, validateAuthSecret } from '../../src/config/authSecret';

describe('validateAuthSecret', () => {
  it('accepte un secret aléatoire de 32+ caractères', () => {
    const secret = 'a'.repeat(NEXTAUTH_SECRET_MIN_LENGTH);
    const result = validateAuthSecret(secret);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejette les placeholders et les secrets trop courts', () => {
    expect(validateAuthSecret('change-me-in-production').ok).toBe(false);
    expect(validateAuthSecret('short').ok).toBe(false);
    expect(validateAuthSecret('').ok).toBe(false);
  });
});
