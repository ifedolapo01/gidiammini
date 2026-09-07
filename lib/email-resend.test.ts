/**
 * Resend reports a refusal in the response body rather than throwing, and the
 * distinction an operator needs is the same one SMTP needed: fix the setup,
 * fix the address, or wait. These pin that mapping — particularly
 * `invalid_from_address`, which is the likeliest error on a first deploy and
 * would be useless reported as "failed to send, try again".
 */
import { describe, it, expect } from 'vitest';
import type { ErrorResponse } from 'resend';
import { classifyResendError, isResendConfigured } from './email-resend';

const error = (name: ErrorResponse['name'], message = 'something went wrong'): ErrorResponse => ({
  name,
  message,
  statusCode: 400,
});

describe('isResendConfigured', () => {
  const ORIGINAL = process.env.RESEND_API_KEY;

  const restore = () => {
    if (ORIGINAL === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = ORIGINAL;
  };

  it('is true when a key is present', () => {
    process.env.RESEND_API_KEY = 're_test_key';
    expect(isResendConfigured()).toBe(true);
    restore();
  });

  it('treats a whitespace-only key as unset', () => {
    process.env.RESEND_API_KEY = '   ';
    expect(isResendConfigured()).toBe(false);
    restore();
  });

  it('is false when the key is missing', () => {
    delete process.env.RESEND_API_KEY;
    expect(isResendConfigured()).toBe(false);
    restore();
  });
});

describe('classifyResendError', () => {
  it('calls an unverified sending domain a configuration problem', () => {
    // The first-deploy error. Retrying it forever would never work; the
    // operator has to add DNS records.
    expect(classifyResendError(error('invalid_from_address')).reason).toBe('not_configured');
  });

  it('calls a bad or restricted key a configuration problem', () => {
    for (const name of ['missing_api_key', 'invalid_api_key', 'restricted_api_key'] as const) {
      expect(classifyResendError(error(name)).reason).toBe('not_configured');
    }
  });

  it('blames the address when Resend rejects the payload', () => {
    // Subject and HTML come from our own templates; the recipient is the only
    // part that comes from data, so a rejected payload is almost always it.
    expect(classifyResendError(error('validation_error')).reason).toBe('invalid_recipient');
    expect(classifyResendError(error('missing_required_field')).reason).toBe('invalid_recipient');
  });

  it('treats quotas, rate limits and Resend 5xx as retryable', () => {
    for (const name of [
      'daily_quota_exceeded',
      'monthly_quota_exceeded',
      'rate_limit_exceeded',
      'internal_server_error',
      'application_error',
    ] as const) {
      expect(classifyResendError(error(name)).reason).toBe('provider_error');
    }
  });

  it('carries the provider sentence through as the detail', () => {
    expect(classifyResendError(error('validation_error', 'to must be a valid email')).detail).toBe(
      'to must be a valid email'
    );
  });

  it('falls back to the error name when there is no message', () => {
    // `??` would let an empty message through as an empty detail, which reads
    // as "no explanation" in a log line.
    expect(classifyResendError(error('internal_server_error', '   ')).detail).toBe(
      'internal_server_error'
    );
  });
});
