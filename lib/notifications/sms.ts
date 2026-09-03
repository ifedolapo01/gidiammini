/**
 * SMS delivery via Termii.
 *
 * This file used to be a stub that logged the message and returned
 * `{ success: true }`. That result flowed into the delivered-channels list, so
 * the admin was told the customer had been texted when nothing was sent. In a
 * market where SMS is often the channel that actually gets read, an operator
 * trusting that skips the follow-up call.
 *
 * It is now the real integration. With TERMII_API_KEY and TERMII_SENDER_ID set
 * it sends; without them it returns `not_configured` and the UI says so. A stub
 * never reports success.
 */
import type { DeliveryFailureReason } from './delivery';
import { normalisePhone } from './phone';

const TERMII_ENDPOINT = 'https://api.ng.termii.com/api/sms/send';
/** Termii can be slow; a hung request must not hold an admin action open. */
const REQUEST_TIMEOUT_MS = 10_000;

export type SmsResult =
  | { success: true; messageId?: string }
  | { success: false; reason: DeliveryFailureReason; detail?: string };

interface TermiiConfig {
  apiKey: string;
  senderId: string;
}

function readConfig(): TermiiConfig | null {
  const apiKey = process.env.TERMII_API_KEY?.trim();
  const senderId = process.env.TERMII_SENDER_ID?.trim();
  return apiKey && senderId ? { apiKey, senderId } : null;
}

/** True when SMS can actually be sent. Used to report the channel honestly
 * before an attempt is made. */
export function isSmsConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * Sends one message. Every failure path is named, so the caller can tell the
 * operator whether the problem is configuration, the customer's number, or the
 * provider.
 */
async function sendSms(phone: string, message: string): Promise<SmsResult> {
  const config = readConfig();
  if (!config) {
    return {
      success: false,
      reason: 'not_configured',
      detail: 'TERMII_API_KEY and TERMII_SENDER_ID are not set.',
    };
  }

  const normalised = normalisePhone(phone);
  if (!normalised.ok) {
    return { success: false, reason: normalised.reason === 'empty' ? 'no_recipient' : 'invalid_recipient' };
  }

  try {
    const response = await fetch(TERMII_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: normalised.msisdn,
        from: config.senderId,
        sms: message,
        type: 'plain',
        channel: 'generic',
        api_key: config.apiKey,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const body = await response.json().catch(() => null);

    // Termii answers 200 with a body that says whether it accepted the message,
    // so the status code alone is not enough to call this a success.
    if (!response.ok || body?.code !== 'ok') {
      const detail = body?.message ?? `HTTP ${response.status}`;
      console.error(`Termii refused the message: ${detail}`);
      return { success: false, reason: 'provider_error', detail: String(detail) };
    }

    return { success: true, messageId: body?.message_id };
  } catch (error: any) {
    const detail = error?.name === 'TimeoutError' ? 'provider timed out' : error?.message ?? 'unknown error';
    console.error(`Termii request failed: ${detail}`);
    return { success: false, reason: 'provider_error', detail };
  }
}

const STATUS_TEXTS: Record<string, (orderNumber: string) => string> = {
  confirmed: (n) => `Your order #${n} has been confirmed! We're processing it now.`,
  shipped: (n) => `Great news! Your order #${n} has been shipped. Track your package for updates.`,
  ready_for_pickup: (n) => `Your order #${n} is ready for pickup.`,
  picked_up: (n) => `Your order #${n} has been picked up. Thank you for shopping with GidiamMini.`,
  delivered: (n) => `Your order #${n} has been delivered! Thank you for shopping with GidiamMini.`,
  cancelled: (n) => `Your order #${n} has been cancelled. Contact us at 0809 653 9067 if you have questions.`,
  rescheduled: (n) => `Your order #${n} has been rescheduled. We'll be in touch with the new timing.`,
};

export async function sendStatusSMS(params: {
  customerPhone: string;
  orderNumber: string;
  newStatus: string;
  customMessage?: string;
}): Promise<SmsResult> {
  const { customerPhone, orderNumber, newStatus, customMessage } = params;

  const base = STATUS_TEXTS[newStatus]?.(orderNumber) ?? `Your order #${orderNumber} status: ${newStatus}`;
  const message = customMessage ? `${base}\n\n${customMessage}` : base;

  return sendSms(customerPhone, message);
}

export async function sendCustomSMS(params: {
  customerPhone: string;
  orderNumber: string;
  message: string;
}): Promise<SmsResult> {
  const { customerPhone, orderNumber, message } = params;
  return sendSms(customerPhone, `GidiamMini Order #${orderNumber}: ${message}`);
}
