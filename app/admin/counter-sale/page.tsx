/** ADMIN layer — the counter-sale screen: a cashier's whole job in one page. */
import CounterSaleForm from './components/CounterSaleForm';

export default function CounterSalePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-h3 font-bold text-text-primary">Counter sale</h1>
        <p className="text-body-sm text-text-secondary">
          Ring up a walk-in customer and take payment on the spot.
        </p>
      </div>

      <div className="rounded-surface border border-border bg-surface p-4 sm:p-6">
        <CounterSaleForm />
      </div>
    </div>
  );
}
