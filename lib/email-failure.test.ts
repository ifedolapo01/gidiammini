/**
 * Email failures used to all collapse into one generic "Failed to send email".
 * These tests pin the distinctions an operator actually needs: fix the config,
 * fix the customer's address, or wait and retry.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { classifyEmailError, isEmailConfigured } from './email-failure';

const ORIGINAL = { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS };

const configure = () => {
  process.env.EMAIL_USER = 'store@example.com';
  process.env.EMAIL_PASS = 'app password here';
};

beforeEach(configure);

afterEach(() => {
  // Restore rather than delete, so the suite leaves the env as it found it.
  if (ORIGINAL.user === undefined) delete process.env.EMAIL_USER;
  else process.env.EMAIL_USER = ORIGINAL.user;
  if (ORIGINAL.pass === undefined) delete process.env.EMAIL_PASS;
  else process.env.EMAIL_PASS = ORIGINAL.pass;
});

describe('isEmailConfigured', () => {
  it('is true when both credentials are present', () => {
    expect(isEmailConfigured()).toBe(true);
  });

  it('is false when either is missing', () => {
    delete process.env.EMAIL_PASS;
    expect(isEmailConfigured()).toBe(false);
    configure();
    delete process.env.EMAIL_USER;
    expect(isEmailConfigured()).toBe(false);
  });

  it('treats whitespace-only values as unset', () => {
    process.env.EMAIL_PASS = '   ';
    expect(isEmailConfigured()).toBe(false);
  });
});

describe('classifyEmailError', () => {
  it('reports missing credentials as configuration, whatever the error was', () => {
    delete process.env.EMAIL_USER;
    expect(classifyEmailError(new Error('anything'))).toEqual({
      reason: 'not_configured',
      detail: 'EMAIL_USER and EMAIL_PASS are not set.',
    });
  });

  it('treats rejected credentials as configuration, not a transient failure', () => {
    // The operator has to go change something; retrying will never help.
    const result = classifyEmailError({ code: 'EAUTH', message: 'Username and Password not accepted' });
    expect(result.reason).toBe('not_configured');
    expect(result.detail).toContain('Username and Password not accepted');
  });

  it('blames the address for an envelope error', () => {
    expect(classifyEmailError({ code: 'EENVELOPE', message: 'no recipients defined' }).reason)
      .toBe('invalid_recipient');
  });

  it('blames the address for a 550-class SMTP reply', () => {
    for (const responseCode of [550, 553, 510, 511, 513]) {
      expect(classifyEmailError({ responseCode, message: 'mailbox unavailable' }).reason)
        .toBe('invalid_recipient');
    }
  });

  it('does not blame the address for a 4xx reply', () => {
    // 421/450 are the server asking us to come back later.
    expect(classifyEmailError({ responseCode: 421, message: 'try again later' }).reason)
      .toBe('provider_error');
  });

  it('reports an unreachable mail server as a provider problem', () => {
    // This is the real local case: outbound port 587 blocked by the network.
    const result = classifyEmailError({ code: 'ESOCKET', message: 'connect ETIMEDOUT 192.0.2.1:587' });
    expect(result.reason).toBe('provider_error');
    expect(result.detail).toContain('could not reach the mail server');
  });

  it('handles a connection timeout and a refused connection the same way', () => {
    expect(classifyEmailError({ code: 'ETIMEDOUT', message: 'timed out' }).reason).toBe('provider_error');
    expect(classifyEmailError({ code: 'ECONNECTION', message: 'refused' }).reason).toBe('provider_error');
  });

  it('falls back to provider_error without throwing on junk input', () => {
    expect(classifyEmailError(null)).toEqual({ reason: 'provider_error', detail: 'unknown error' });
    expect(classifyEmailError(undefined).reason).toBe('provider_error');
    expect(classifyEmailError('a string').reason).toBe('provider_error');
  });

  it('always returns a non-empty detail', () => {
    for (const input of [null, {}, new Error(''), { code: 'EAUTH' }]) {
      expect(classifyEmailError(input).detail.length).toBeGreaterThan(0);
    }
  });
});
