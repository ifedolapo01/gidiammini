/**
 * WhatsApp delivery via the Meta WhatsApp Cloud API.
 *
 * Modelled on sms.ts: a real integration with an honest not-configured
 * fallback, never a stub that claims success.
 *
 * The one real difference from SMS is templates. Outside a 24-hour customer
 * service window, WhatsApp Business only allows *pre-approved* message
 * templates — Meta reviews the wording before it can be sent, so this module
 * cannot accept free text the way sendSms() does. WHATSAPP_TEMPLATES names
 * the templates this store is expected to have approved in Meta Business
 * Manager, and the params builders below supply the {{1}}, {{2}}… body
 * variables each one expects, in order. Adding a status here without first
 * approving the matching template in Meta will not silently work — it will
 * report `provider_error` the moment Meta refuses the unknown template name,
 * which is the correct thing for it to do.
 */
import type { DeliveryFailureReason } from './delivery';
import type { OrderTracking } from '@/lib/commerce/order-tracking';
import { trackingSmsLine } from './templates/tracking-block';
import { normalisePhone } from './phone';

const GRAPH_API_VERSION = 'v18.0';
/** Same budget as Termii — a hung request must not hold an admin action open. */
const REQUEST_TIMEOUT_MS = 10_000;

export type WhatsAppResult =
  | { success: true; messageId?: string }
  | { success: false; reason: DeliveryFailureReason; detail?: string };

interface WhatsAppConfig {
  apiToken: string;
  phoneNumberId: string;
}

function readConfig(): WhatsAppConfig | null {
  const apiToken = process.env.WHATSAPP_API_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  return apiToken && phoneNumberId ? { apiToken, phoneNumberId } : null;
}

/** True when WhatsApp can actually be sent. Used to report the channel
 * honestly before an attempt is made. */
export function isWhatsAppConfigured(): boolean {
  return readConfig() !== null;
}

/** One approved Meta template. `variables` documents what each {{n}} body
 * placeholder holds — not sent to Meta, just what a reviewer checks the
 * approved copy against when this list changes. */
interface WhatsAppTemplate {
  name: string;
  language: string;
  variables: string[];
}

type WhatsAppTemplateKey =
  | 'order_received'
  | 'confirmed'
  | 'shipped'
  | 'ready_for_pickup'
  | 'delivered'
  | 'cancelled'
  | 'custom_update';

export const WHATSAPP_TEMPLATES: Record<WhatsAppTemplateKey, WhatsAppTemplate> = {
  order_received: { name: 'order_received', language: 'en', variables: ['orderNumber'] },
  confirmed: { name: 'order_confirmed', language: 'en', variables: ['orderNumber'] },
  shipped: { name: 'order_shipped', language: 'en', variables: ['orderNumber', 'trackingLine'] },
  ready_for_pickup: { name: 'order_ready_for_pickup', language: 'en', variables: ['orderNumber'] },
  delivered: { name: 'order_delivered', language: 'en', variables: ['orderNumber'] },
  cancelled: { name: 'order_cancelled', language: 'en', variables: ['orderNumber'] },
  // The one template a free-text admin message maps onto: WhatsApp has no
  // equivalent of sendCustomSMS's arbitrary body, so an admin note becomes the
  // second variable of a generic "here's an update" template instead.
  custom_update: { name: 'custom_update', language: 'en', variables: ['orderNumber', 'message'] },
};

/** Body-variable values for each template, in declaration order. Mirrors
 * STATUS_TEXTS in sms.ts, but returns values to substitute rather than
 * finished sentences — the sentence itself lives in the approved template. */
const TEMPLATE_PARAMS: Record<WhatsAppTemplateKey, (orderNumber: string, extra?: string) => string[]> = {
  order_received: (n) => [n],
  confirmed: (n) => [n],
  shipped: (n, tracking) => [n, tracking || 'Courier details to follow'],
  ready_for_pickup: (n) => [n],
  delivered: (n) => [n],
  cancelled: (n) => [n],
  custom_update: (n, message) => [n, message ?? ''],
};

/** A status with no entry above has no approved template to send it with —
 * reported the same way missing credentials are, since either way nothing
 * can go out. */
function statusTemplateKey(status: string): WhatsAppTemplateKey | null {
  return status in WHATSAPP_TEMPLATES && status !== 'custom_update' ? (status as WhatsAppTemplateKey) : null;
}

async function sendTemplate(
  phone: string,
  template: WhatsAppTemplate,
  params: string[]
): Promise<WhatsAppResult> {
  const config = readConfig();
  if (!config) {
    return {
      success: false,
      reason: 'not_configured',
      detail: 'WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID are not set.',
    };
  }

  const normalised = normalisePhone(phone);
  if (!normalised.ok) {
    return { success: false, reason: normalised.reason === 'empty' ? 'no_recipient' : 'invalid_recipient' };
  }

  const endpoint = `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.phoneNumberId}/messages`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalised.msisdn,
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.language },
          components: [
            { type: 'body', parameters: params.map((text) => ({ type: 'text', text })) },
          ],
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = body?.error?.message ?? `HTTP ${response.status}`;
      console.error(`WhatsApp Cloud API refused the message: ${detail}`);
      return { success: false, reason: 'provider_error', detail: String(detail) };
    }

    return { success: true, messageId: body?.messages?.[0]?.id };
  } catch (error: any) {
    const detail = error?.name === 'TimeoutError' ? 'provider timed out' : error?.message ?? 'unknown error';
    console.error(`WhatsApp request failed: ${detail}`);
    return { success: false, reason: 'provider_error', detail };
  }
}

export async function sendStatusWhatsApp(params: {
  customerPhone: string;
  orderNumber: string;
  newStatus: string;
  /** Courier and waybill, for a shipment — same shape as the SMS/email send. */
  tracking?: Partial<OrderTracking> | null;
}): Promise<WhatsAppResult> {
  const { customerPhone, orderNumber, newStatus, tracking } = params;

  const key = statusTemplateKey(newStatus);
  if (!key) {
    return {
      success: false,
      reason: 'not_configured',
      detail: `No approved WhatsApp template for status "${newStatus}".`,
    };
  }

  const template = WHATSAPP_TEMPLATES[key];
  const waybill = newStatus === 'shipped' ? trackingSmsLine(tracking) : undefined;
  const values = TEMPLATE_PARAMS[key](orderNumber, waybill);

  return sendTemplate(customerPhone, template, values);
}

export async function sendCustomWhatsApp(params: {
  customerPhone: string;
  orderNumber: string;
  message: string;
}): Promise<WhatsAppResult> {
  const { customerPhone, orderNumber, message } = params;
  const template = WHATSAPP_TEMPLATES.custom_update;
  return sendTemplate(customerPhone, template, TEMPLATE_PARAMS.custom_update(orderNumber, message));
}

export async function sendOrderReceivedWhatsApp(params: {
  customerPhone: string;
  orderNumber: string;
}): Promise<WhatsAppResult> {
  const { customerPhone, orderNumber } = params;
  const template = WHATSAPP_TEMPLATES.order_received;
  return sendTemplate(customerPhone, template, TEMPLATE_PARAMS.order_received(orderNumber));
}
