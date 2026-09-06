# Backlog

Work that was deliberately deferred, with enough context to pick it up cold.
Each entry says what is missing, why it was left, and what "done" means — a
backlog line that only names a feature is one nobody can act on later.

---

## Editable notification templates, with preview

**Status:** not started. Part 5 of the notifications work (`20260906140000`).

Every email template is a TypeScript module under
`lib/notifications/templates/`, so changing a line of store copy is a code
change and a deploy. The owner cannot fix a typo, adjust a tone, or add a line
about holiday delivery without an engineer.

**Left because** it is a feature in its own right rather than a finishing
touch: it needs a `notification_templates` table, a variable-interpolation
scheme with escaping that cannot be turned into an HTML injection by whoever is
editing, a fallback to the code template when no record exists, and an editor
with a live preview rendered from sample data. Shipping half of that is worse
than shipping none — a template system that silently falls back leaves the
owner unsure whether their edit took effect.

**Done means:**
- A `notification_templates` row per kind (`lib/notifications/kinds.ts`), holding
  subject and body, with the code template as the fallback when no row exists.
- Interpolation over a declared set of variables per kind, escaped by default,
  with an explicit opt-out for the blocks that are already HTML.
- An admin editor with a preview rendered against sample data, so the owner sees
  the result before it reaches a customer.
- A way back to the shipped default, because the first thing anybody does with
  an editor is break the layout.

---

## Unsubscribe for segment campaigns to customers

**Status:** not started. The gap left by the unsubscribe work
(`20260906140000`).

`app/api/admin/customers/campaign/route.ts` BCCs a segment of *customers* and
carries no unsubscribe link. The one-click opt-out built for the newsletter
does not reach it: the token is derived from a `subscribers.id`, and a customer
who has never signed up for the newsletter has no row there.

**Left because** the missing piece is not the plumbing but a decision nobody
has made: does having bought something count as consent to marketing? Under the
NDPR a soft opt-in for an existing customer buying similar goods is generally
defensible, but it still requires a working way out — and where that opt-out
lives (a flag on `customers`, or auto-enrolling buyers into `subscribers`)
changes what the segment query means and who is in it.

**Done means:**
- A customer-level marketing opt-out that the segment query filters on, however
  it is modelled.
- The campaign switched to one message per recipient, as the newsletter sends
  already are — a single BCC cannot carry a link that identifies who clicked it
  (see `lib/notifications/marketing.ts`).
- Sends recorded in `notifications` with `kind = 'segment'`, as the newsletter
  ones are.
- Honest reporting of what went out, rather than the size of the list.

---

## Delivery and bounce feedback

**Status:** blocked on a provider change, not on code.

`notifications.status` carries `'delivered'` and `'complained'`, and
`markNotificationStatus()` is ready to receive them. Nothing sets them, because
the transport is SMTP through nodemailer and SMTP has no callback: it reports
that a mail server accepted a message and nothing after that.

Hard rejections at handshake *are* captured (nodemailer's `rejected`), and land
as `'bounced'`.

**Done means:** a provider with webhooks (Resend, Postmark, SES via SNS) or an
IMAP reader watching the sending mailbox, plus one route that calls
`markNotificationStatus`. Until then the Admin says "Accepted by mail server"
rather than "Delivered", which is the true statement.
