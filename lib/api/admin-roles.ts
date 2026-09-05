/**
 * CORE layer — what each kind of admin is allowed to do.
 *
 * The single definition of the role vocabulary and of what every role may
 * touch. Nothing else in the codebase may hardcode a role name in a condition:
 * ask `can(role, permission)` instead, so widening or narrowing a role is one
 * edit here rather than a search across routes and components.
 *
 * WHY PERMISSIONS AND NOT A RANK
 *
 * Roles are not a ladder. Fulfilment can move an order to shipped, which a
 * read-only manager's deputy cannot, yet fulfilment must not read the customer
 * database — so "fulfilment > read_only" is not a relation that holds. A set
 * per role says exactly what is meant and survives the next role being added.
 */

export const ADMIN_ROLES = ['owner', 'manager', 'fulfilment', 'read_only'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const DEFAULT_ADMIN_ROLE: AdminRole = 'read_only';

export type AdminPermission =
  /** The shop as it stands: dashboard, catalogue, categories, prices. */
  | 'store:read'
  /** Products, categories, subcategories, discounts, shipping zones. */
  | 'catalog:write'
  /** Stock levels only — a warehouse assistant's job, without the ability to
   * delete the product or change its price. */
  | 'stock:write'
  | 'orders:read'
  | 'orders:write'
  /** The customer database: every address, every order anyone ever placed.
   * Deliberately separate from orders:read, which exposes only the addresses
   * on the orders being worked. */
  | 'customers:read'
  | 'customers:write'
  /** Approving, rejecting and answering reviews and questions. */
  | 'moderation:write'
  /** The activity feed. Audit entries hold before/after snapshots of orders
   * and customers, so reading them is at least as sensitive as reading those. */
  | 'audit:read'
  /** Downloading a dataset as a file. */
  | 'export:read'
  /** Seeing who the admins are — needed to filter the activity feed by person. */
  | 'team:read'
  /** Inviting, re-roling and revoking admins. */
  | 'team:manage';

const OWNER: AdminPermission[] = [
  'store:read', 'catalog:write', 'stock:write',
  'orders:read', 'orders:write',
  'customers:read', 'customers:write',
  'moderation:write', 'audit:read', 'export:read',
  'team:read', 'team:manage',
];

/** Everything an owner can do except change who the admins are. */
const MANAGER: AdminPermission[] = OWNER.filter((p) => p !== 'team:manage');

export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  owner: OWNER,
  manager: MANAGER,
  // Packs and ships. Sees the orders and the stock, and nothing that would let
  // them change a price, delete a product, or read the customer list.
  fulfilment: ['store:read', 'orders:read', 'orders:write', 'stock:write'],
  // Looks, never touches. No customers and no audit trail, both of which carry
  // more personal data than a viewer needs.
  read_only: ['store:read', 'orders:read'],
};

export interface AdminRoleInfo {
  value: AdminRole;
  label: string;
  /** Shown beside the option when assigning a role, so the choice is made on
   * what it grants rather than on what the name suggests. */
  description: string;
}

export const ADMIN_ROLE_INFO: readonly AdminRoleInfo[] = [
  {
    value: 'owner',
    label: 'Owner',
    description: 'Full access, including inviting and removing admins.',
  },
  {
    value: 'manager',
    label: 'Manager',
    description: 'Runs the shop: products, orders, customers, discounts, activity. Cannot manage admins.',
  },
  {
    value: 'fulfilment',
    label: 'Fulfilment',
    description: 'Works orders and stock. No pricing, no deletions, no customer database.',
  },
  {
    value: 'read_only',
    label: 'Read only',
    description: 'Can view the shop and its orders. Changes nothing.',
  },
];

/** True when `value` is one of the roles this deployment knows. */
export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}

/**
 * Whether a role grants a permission.
 *
 * Fails closed on a role the code does not recognise — a row holding a role
 * from a newer deployment, or from a migration that has not run here yet, is
 * granted nothing rather than everything.
 */
export function can(role: string | null | undefined, permission: AdminPermission): boolean {
  if (!isAdminRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** The human label for a role, for the team list and the activity feed. */
export function roleLabel(role: string | null | undefined): string {
  return ADMIN_ROLE_INFO.find((info) => info.value === role)?.label ?? (role || 'Unknown');
}
