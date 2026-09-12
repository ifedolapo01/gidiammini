/** ADMIN layer — the walk-in customer's details, entirely optional.
 *
 * Unlike the online checkout, a counter sale is paid in hand before any of
 * this is asked — nothing here gates the sale. It exists only so the shop can
 * reach this customer again if it ever wants to (a receipt emailed later, a
 * name on a loyalty list), and a cashier who does not have time to ask stays
 * able to ring the sale up with every field left blank.
 */
'use client';

import { Input } from '@/components/ui';

interface WalkInCustomerFieldsProps {
  name: string;
  onNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
}

export default function WalkInCustomerFields({
  name, onNameChange, email, onEmailChange, phone, onPhoneChange,
}: WalkInCustomerFieldsProps) {
  return (
    <div className="space-y-3">
      <p className="text-body-sm font-medium text-text-primary">
        Customer <span className="font-normal text-text-secondary">(optional)</span>
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="counter-sale-name" className="mb-1 block text-caption-md text-text-secondary">
            Name
          </label>
          <Input
            id="counter-sale-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Walk-in customer"
          />
        </div>
        <div>
          <label htmlFor="counter-sale-email" className="mb-1 block text-caption-md text-text-secondary">
            Email
          </label>
          <Input
            id="counter-sale-email"
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="For a receipt"
          />
        </div>
        <div>
          <label htmlFor="counter-sale-phone" className="mb-1 block text-caption-md text-text-secondary">
            Phone
          </label>
          <Input
            id="counter-sale-phone"
            type="tel"
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>
    </div>
  );
}
