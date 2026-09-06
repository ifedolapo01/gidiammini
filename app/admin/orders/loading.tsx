/**
 * ADMIN layer — what /admin/orders shows while the route is being fetched.
 *
 * The same skeleton the page renders while its own first request is in
 * flight, so the two loading states are one shape rather than two: the layout
 * appears at navigation and simply fills in, with no spinner and no jump.
 *
 * Deliberately a re-export and not a second skeleton — one definition per
 * page, or they drift the moment the page's columns change.
 */
export { OrdersSkeleton as default } from './components/OrdersSkeleton';
