# Backlog

Work the owner has expressly said to keep for later. Each entry says what is
missing, why it was left, and what "done" means — a backlog line that only
names a feature is one nobody can act on later.

Anything else found along the way is raised in conversation, not filed here.

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

## CI repository variables, so the build step actually runs

**Status:** not started. Two entries in a GitHub settings page — no code.

`.github/workflows/ci.yml` runs typecheck, lint and tests on every push, and
*skips* the build step because `next build` needs the two public Supabase env
vars to prerender and they are not configured on the repository. The workflow
prints a warning in the Actions log rather than failing, so the tick stays
green and the missing check stays visible.

**Left because** it needs somebody with repository admin to click through
Settings, and a red CI tick that nobody can fix is worse than a green one with
a stated gap — a permanently failing gate is a gate people learn to ignore.

**Done means:**
- At `github.com/ifedolapo01/urbanthreads` → Settings → Secrets and variables →
  Actions → the **Variables** tab → New repository variable, twice:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Values are the ones already in `.env.local`. Both are safe as *variables*
  rather than secrets: every browser that loads the site receives them, which
  is what the `NEXT_PUBLIC_` prefix means.
- `SUPABASE_SERVICE_ROLE_KEY` is **not** added. The build never reads it, and a
  repository variable is readable by anyone who can open a pull request.
- Nothing to change in the workflow afterwards — the build step's `if:` guard
  is keyed on the variable being present, so it starts running by itself.

---

## An error tracker behind `reportError`

**Status:** not started. The seam exists and is wired; the tracker is not
chosen.

`lib/report-error.ts` is the single point every error boundary funnels through,
and it now logs through `lib/logger.ts` — structured, levelled, with the Next
`digest` preserved. What it does not do is send anything anywhere, so an error
a customer hit is only findable if somebody goes looking in the platform's
function logs at the right time.

**Left because** choosing a tracker is not a code decision. It is a dependency,
an account, a data-processing relationship, and a monthly bill — and error
payloads from this app can carry order numbers and customer email addresses, so
where they are stored and for how long is a privacy question as much as a
tooling one.

**Done means:**
- A tracker picked and its DSN in the environment (Sentry is the obvious
  default; GlitchTip is the self-hosted, Sentry-compatible option if the data
  should not leave).
- The call added under the marked line in `reportError`, forwarding `digest` as
  a tag — that hash is the only thing linking the opaque message a visitor was
  shown to the real stack trace.
- The server side covered too, not just boundaries. The `catch` blocks in
  `app/api/**` still call `console.error` directly — 104 of them, against two
  files that import `lib/logger.ts` — so a 500 is an unstructured string with
  no level and no request id. Moving those onto the logger is the prerequisite,
  and worth doing whether or not a tracker is ever bought: the request id from
  `lib/api/request-id.ts` is what lets a customer quoting a reference be
  matched to the trace.
- Scrubbing configured before it is switched on, so order numbers and email
  addresses are not shipped to a third party by default.
- An alert on the payment and order endpoints specifically. Notification
  failures are swallowed on purpose so a bad email never blocks an order (see
  `lib/notifications/send.ts`), which also means a broken mail transport is
  silent — `/api/health` catches that one, an alert catches the rest.

---

## Resend webhook endpoint, so bounces and complaints get recorded

**Status:** not started. Two clicks in the Resend dashboard — no code.

`app/api/webhooks/resend/route.ts` verifies signed delivery events and, once
they arrive, writes `notifications.status` to `'delivered'`, `'bounced'` or
`'complained'` and unsubscribes a hard-bounced address (added 2026-09-07, see
`lib/notifications/resend-webhook.ts` and
`lib/notifications/subscriber-suppress.ts`). Nothing is pointed at it yet:
Resend does not know the endpoint exists, so every send still logs as
`'sent'` regardless of whether it ever reached an inbox.

**Left because** it needs someone with access to the Resend account to click
through its dashboard, and the signing secret it hands back on creation exists
nowhere until then — there is nothing in the repository that can stand in for
it.

**Done means:**
- In the Resend dashboard -> Webhooks -> add an endpoint at
  `https://<your-domain>/api/webhooks/resend`, subscribed to at least
  `email.delivered`, `email.bounced` and `email.complained`.
- The signing secret Resend shows on creation copied into
  `RESEND_WEBHOOK_SECRET` (`.env.example` has the shape: `whsec_...`) — it is
  shown once, so this is a "copy it before leaving the page" step, not a
  "come back for it later" one.
- Confirmed by sending anything through the shop and checking Resend's own
  webhook delivery log shows a `200` — the endpoint answers `503` and does
  nothing until the secret is set, so a failed delivery there means the
  variable is still missing, not a bug in the route.

---

## A real domain, verified in Resend

**Status:** not started. Gmail SMTP is standing in for now
(`20260907213000`).

`RESEND_FROM_EMAIL` was still the unedited `.env.example` placeholder,
`noreply@yourstore.com`, in both the local environment and (almost certainly)
on Vercel — confirmed by a direct test send to Resend's own test address,
which came back `403 The yourstore.com domain is not verified`. Every
transactional email the app sends (order received, sign-in link, status
updates) was failing silently at that point, because a bad mail transport is
deliberately never allowed to fail an order or a sign-in. The store currently
has no domain of its own, only `gidiammini.vercel.app`, and Vercel's own
subdomain can never be verified in Resend — that DNS is Vercel's to control,
not the store owner's.

**Left because** it needs a domain purchased and DNS records added at
whatever registrar holds it, which is an account/money step nobody else can
take. Gmail SMTP (`EMAIL_HOST`/`EMAIL_USER`/`EMAIL_PASS`/`EMAIL_FROM`,
`RESEND_API_KEY` unset) is filling the gap in the meantime — nodemailer's
Gmail transport needs no domain of its own, so it unblocks sending today, at
the cost of a low daily cap and mail that goes out over Gmail's reputation
rather than the shop's.

**Done means:**
- A domain purchased and added in Resend -> Domains, with its SPF, DKIM and
  DMARC records published at the registrar and showing **Verified**.
- `RESEND_FROM_EMAIL` pointed at an address on that domain, in both
  `.env.local` and Vercel's Environment Variables for the deployed project.
- `RESEND_API_KEY` set again (it never needed to be removed, only stopped
  being the transport that runs — `lib/email.ts` prefers Resend automatically
  the moment it is configured), so mail moves back off the Gmail cap.
- Confirmed the same way the break was found: a direct test send to Resend's
  own test address (`delivered@resend.dev`) returns success rather than a
  domain-verification `403`.

---

## Session-expiry feedback for signed-in customers

**Status:** not started. Found while fixing the equivalent admin-side gap (a
"session expired" message with no accompanying logout) on 2026-09-10.

The admin section has `adminFetch`/`useAdminSessionGuard`
(`app/admin/lib/admin-fetch.ts`, `app/admin/hooks/useAdminSessionGuard.ts`):
any 401 from an admin API triggers a toast, clears the cookie, and redirects
to login, all together. Customers have no equivalent. `app/account/page.tsx`
is the only place that reacts to an expired `customer-session` cookie, and it
does so silently and server-side only — `readSession()` fails,
`redirect('/account/login')` fires, with no message shown at all. Every
client-side hook that calls a customer API (`useCheckoutIdentity`,
`useCheckoutPrefill`, `useCartSync`, `useWishlistSync`) treats a 401 as the
ordinary "guest" case by design, since a customer who has never signed in
looks identical over the wire to one whose session just expired. A customer
sitting on `/account`, checkout, or anywhere client-heavy when their session
dies sees nothing: no toast, no redirect, no explanation — they just keep
clicking as a guest until something finally notices.

**Left because** building this properly needs to distinguish "never signed
in" from "was signed in, now expired" at the point a 401 arrives, which the
current customer API responses don't mark either way — and blindly toasting
"session expired" on every 401 would turn checkout, cart sync and wishlist
sync (all designed to fail quietly for guests) into a page full of false
alarms for every anonymous shopper. That is a response-shape decision worth
making deliberately, not a copy-paste of the admin mechanism.

**Done means:**
- Customer API routes distinguish "no session" from "session expired" in
  their 401 response (e.g. a `reason` field), so a client can tell a guest
  from a customer who was logged out by expiry.
- A customer-side fetch wrapper (mirroring `app/admin/lib/admin-fetch.ts`)
  that reacts only to the "expired" case — clearing any local cart/wishlist
  state that assumed a signed-in identity, telling the person their session
  ended, and sending them to `/account/login` — while a genuine guest 401
  stays silent exactly as today.
- Covers the pages where staying signed in for a while is normal: `/account`,
  checkout, cart.

---
