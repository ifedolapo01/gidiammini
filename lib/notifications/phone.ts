/**
 * Nigerian phone number normalisation for SMS delivery.
 *
 * Customers type their number however they like at checkout — "0809 653 9067",
 * "+234 809 653 9067", "809-653-9067" — and the column stores exactly what they
 * typed. SMS providers want one canonical form: country code, no plus, no
 * separators (2348096539067).
 *
 * Pure and dependency-free, so the parsing rules can be tested without a
 * provider or a network.
 */

/** Nigeria. The store ships domestically only (see the shipping zones). */
const COUNTRY_CODE = '234';

/**
 * Valid Nigerian mobile network codes, as the three digits after the country
 * code. Checked so an obviously-wrong number is rejected before it costs a
 * provider call and a "sent" claim.
 */
const MOBILE_PREFIXES = new Set([
  '701', '702', '703', '704', '705', '706', '707', '708', '709',
  '801', '802', '803', '804', '805', '806', '807', '808', '809',
  '810', '811', '812', '813', '814', '815', '816', '817', '818', '819',
  '901', '902', '903', '904', '905', '906', '907', '908', '909',
  '911', '912', '913', '915', '916', '917', '918',
]);

export type PhoneNormalisation =
  | { ok: true; msisdn: string }
  | { ok: false; reason: 'empty' | 'not_a_number' | 'unrecognised_format' | 'not_a_mobile' };

/**
 * Converts a customer-entered number into `2348096539067` form.
 *
 * Accepts the shapes people actually type: local (0809…), international with or
 * without a plus (+234809… / 234809…), the 00 international prefix
 * (00234809…), and a bare subscriber number (809…).
 */
export function normalisePhone(input: unknown): PhoneNormalisation {
  if (typeof input !== 'string' || input.trim() === '') {
    return { ok: false, reason: 'empty' };
  }

  // Keep digits only. A leading '+' carries no information once the country
  // code is explicit, and letters mean this was never a phone number.
  const digits = input.replace(/[\s\-().+]/g, '');
  if (!/^\d+$/.test(digits)) {
    return { ok: false, reason: 'not_a_number' };
  }

  let national: string | null = null;

  if (digits.startsWith('00' + COUNTRY_CODE)) {
    national = digits.slice(2 + COUNTRY_CODE.length);
  } else if (digits.startsWith(COUNTRY_CODE)) {
    national = digits.slice(COUNTRY_CODE.length);
  } else if (digits.startsWith('0')) {
    national = digits.slice(1);
  } else {
    national = digits;
  }

  // A Nigerian subscriber number is 10 digits after the country code.
  if (national.length !== 10) {
    return { ok: false, reason: 'unrecognised_format' };
  }

  if (!MOBILE_PREFIXES.has(national.slice(0, 3))) {
    return { ok: false, reason: 'not_a_mobile' };
  }

  return { ok: true, msisdn: COUNTRY_CODE + national };
}

/** Human-readable form for logs and admin messages: `0809 653 9067`. */
export function formatPhoneForDisplay(msisdn: string): string {
  const national = msisdn.startsWith(COUNTRY_CODE) ? msisdn.slice(COUNTRY_CODE.length) : msisdn;
  if (national.length !== 10) return msisdn;
  return `0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}
