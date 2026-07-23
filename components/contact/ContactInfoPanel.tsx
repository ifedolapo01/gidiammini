/** STOREFRONT layer — store contact details shown alongside the Contact Us form. */
import { Mail, Phone, MapPin, Clock } from 'lucide-react';

const CONTACT_DETAILS = [
  { icon: Mail, label: 'support@gidiammini.com', href: 'mailto:support@gidiammini.com' },
  { icon: Phone, label: '0809 653 9067', href: 'tel:+2348096539067' },
  { icon: MapPin, label: 'Abuja, Nigeria', href: undefined },
  { icon: Clock, label: 'Mon - Sat, 9am - 6pm WAT', href: undefined },
];

export default function ContactInfoPanel() {
  return (
    <div className="bg-surface border border-border rounded-surface p-4 md:p-6 space-y-4">
      <div>
        <p className="font-bold text-body-md text-text-primary mb-1">GidiamMini Clothing Store</p>
        <p className="text-body-sm text-text-secondary">
          Have a question about an order, a product, or anything else? Reach out — we typically respond within one business day.
        </p>
      </div>
      <ul className="space-y-3">
        {CONTACT_DETAILS.map(({ icon: Icon, label, href }) => (
          <li key={label} className="flex items-center gap-2.5 text-body-sm text-text-primary">
            <Icon className="w-4 h-4 text-info shrink-0" />
            {href ? (
              <a href={href} className="hover:text-primary transition-colors">{label}</a>
            ) : (
              <span>{label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
