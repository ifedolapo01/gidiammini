/**
 * COMMERCE layer — the credential behind "verified purchase".
 *
 * A review invite link is a bearer token: whoever holds it can write a review
 * attributed to that order. The generation and hashing are shared with the
 * customer sign-in link — see bearer-token.ts for why they are CSPRNG-derived,
 * stored only as a hash, and hashed in Node rather than in SQL.
 *
 * Named re-exports rather than a barrel: a caller reading review-invite.ts
 * should see that the token it mints is a review token, not a generic one.
 */
export {
  newBearerToken as newReviewToken,
  hashBearerToken as hashReviewToken,
  isBearerTokenShape as isReviewTokenShape,
} from './bearer-token';
