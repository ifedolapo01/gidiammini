/**
 * The request schema for `orderChangeRequestSchema` — split out of
 * public-orders.ts once that file passed the 200-line cap.
 *
 * `details` used to be inserted into a jsonb column exactly as the caller
 * sent it — a hand-rolled check confirmed one or two expected keys were
 * present and then passed the whole object through, so anything else riding
 * along was stored too, and `deliveryAddress`/`city` reached an order update
 * unbounded. Modelling it as a discriminated union means each request type
 * accepts precisely its own fields and nothing more.
 */
import { z } from 'zod';
import { MAX_LENGTHS, contactField, optionalText, orderNumberField, requiredText } from './common';

/** A free-text size/colour, or a product/order-item id. None of these are
 *  validated against the catalogue here — like reschedule's preferredDate,
 *  the real check (does this variant exist, is there stock) happens when the
 *  request is approved, against the live product, not at submission time. */
const idField = requiredText('That', 100);
const freeTextOption = optionalText('That', 60);

const rescheduleDetails = z.object({
  preferredDate: requiredText('A preferred date', MAX_LENGTHS.date),
});

/** Address and city are required for a switch to delivery and meaningless for a
 * switch to pickup, so each branch names only what it needs. */
const deliveryMethodChangeDetails = z.discriminatedUnion(
  'newDeliveryOption',
  [
    z.object({ newDeliveryOption: z.literal('pickup') }),
    z.object({
      newDeliveryOption: z.literal('delivery'),
      deliveryAddress: requiredText('A delivery address', MAX_LENGTHS.address),
      city: requiredText('City', MAX_LENGTHS.city),
    }),
  ],
  { error: 'Choose either pickup or delivery.' }
);

const addressCorrectionDetails = z.object({
  newAddress: requiredText('A corrected address', MAX_LENGTHS.address),
  city: optionalText('City', MAX_LENGTHS.city),
});

const itemSwapDetails = z.object({
  productId: idField,
  newSize: freeTextOption,
  newColor: freeTextOption,
});

const addItemDetails = z.object({
  productId: idField,
  size: freeTextOption,
  color: freeTextOption,
  // A quantity nobody is going to type 500 of by mistake and mean it — capped
  // the same way cart-input.ts caps a line, without importing it for one number.
  quantity: z.coerce.number().int().min(1).max(20),
});

const holdUntilDetails = z.object({
  holdUntilDate: requiredText('A date', MAX_LENGTHS.date),
});

const changeRequestBase = {
  orderNumber: orderNumberField,
  contact: contactField,
  customerNote: optionalText('Note', MAX_LENGTHS.note),
};

export const orderChangeRequestSchema = z.discriminatedUnion(
  'requestType',
  [
    z.object({
      ...changeRequestBase,
      requestType: z.literal('reschedule'),
      details: rescheduleDetails,
    }),
    z.object({
      ...changeRequestBase,
      requestType: z.literal('delivery_method_change'),
      details: deliveryMethodChangeDetails,
    }),
    z.object({
      ...changeRequestBase,
      requestType: z.literal('cancel'),
      // The customer's reason goes in customerNote; there is nothing else to
      // send, so whatever arrives — including nothing at all — becomes an
      // empty object rather than being stored.
      details: z.unknown().optional().transform(() => ({})),
    }),
    z.object({
      ...changeRequestBase,
      requestType: z.literal('address_correction'),
      details: addressCorrectionDetails,
    }),
    z.object({
      ...changeRequestBase,
      requestType: z.literal('item_swap'),
      details: itemSwapDetails,
    }),
    z.object({
      ...changeRequestBase,
      requestType: z.literal('add_item'),
      details: addItemDetails,
    }),
    z.object({
      ...changeRequestBase,
      requestType: z.literal('hold_until'),
      details: holdUntilDetails,
    }),
  ],
  { error: 'Choose a valid request type.' }
);

export type OrderChangeRequestBody = z.infer<typeof orderChangeRequestSchema>;
