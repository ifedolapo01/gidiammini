/** ADMIN layer — the role dropdown, with what each role actually grants.
 *
 * The description below the field is the point of the component: "Fulfilment"
 * tells an owner nothing on its own, and a role picked from a name alone is
 * how somebody ends up with more access than anyone intended.
 */
'use client';

import { Select } from '@/components/ui';
import { ADMIN_ROLE_INFO, type AdminRole } from '@/lib/api/admin-roles';

interface RoleSelectProps {
  id: string;
  value: AdminRole;
  onChange: (role: AdminRole) => void;
  disabled?: boolean;
  /** Hidden in a table row, where there is no space for two lines. */
  showDescription?: boolean;
  'aria-label'?: string;
}

export default function RoleSelect({
  id,
  value,
  onChange,
  disabled,
  showDescription = true,
  'aria-label': ariaLabel,
}: RoleSelectProps) {
  const info = ADMIN_ROLE_INFO.find((role) => role.value === value);
  const describedBy = showDescription ? `${id}-description` : undefined;

  return (
    <>
      <Select
        id={id}
        value={value}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as AdminRole)}
      >
        {ADMIN_ROLE_INFO.map((role) => (
          <option key={role.value} value={role.value}>
            {role.label}
          </option>
        ))}
      </Select>

      {showDescription && (
        <p id={describedBy} className="mt-1 text-caption-md text-text-secondary">
          {info?.description}
        </p>
      )}
    </>
  );
}
