/** ADMIN layer — the figures block at the foot of a printed invoice.
 *
 * Split out of OrderPrintDocument, which is the document; this is the part a
 * customer's accounts person reads first. It is deliberately plain black on
 * white for the same reason the rest of the document is: paper has one theme,
 * and a semantic token that resolves dark in the operator's browser would
 * print as a black rectangle.
 *
 * The charge lines come from orderChargeLines(), the same function the admin
 * panel and the amendment email use, so an invoice can never disagree with the
 * screen it was printed from.
 */
import { formatCurrency } from '@/lib/commerce/pricing';
import { orderChargeLines, orderSettlement, type OrderMoney } from '@/lib/commerce/order-money';

const CELL = 'border-t border-black/20 px-2 py-1';

export default function InvoiceTotals({ order }: { order: OrderMoney }) {
  const settlement = orderSettlement(order);

  return (
    <table className="w-72 border-collapse text-[10.5pt]">
      <caption className="sr-only">Invoice totals</caption>
      <tbody>
        {orderChargeLines(order).map((line) => (
          <tr key={line.label} className={line.kind === 'total' ? 'font-bold' : ''}>
            <td className={CELL}>{line.label}</td>
            <td className={`${CELL} text-right`}>
              {line.amount < 0
                ? `-${formatCurrency(Math.abs(line.amount))}`
                : formatCurrency(line.amount)}
            </td>
          </tr>
        ))}

        {/* Only once money has moved. An invoice for an unpaid order should say
            what is owed once, at the bottom, not twice with a zero in between. */}
        {settlement.paid > 0 && (
          <>
            <tr>
              <td className={CELL}>Paid</td>
              <td className={`${CELL} text-right`}>{formatCurrency(settlement.paid)}</td>
            </tr>
            {settlement.refunded > 0 && (
              <tr>
                <td className="px-2 py-1">Refunded</td>
                <td className="px-2 py-1 text-right">-{formatCurrency(settlement.refunded)}</td>
              </tr>
            )}
            <tr className="font-bold">
              <td className="border-t-2 border-black px-2 py-1">
                {settlement.overpaid ? 'Owed back' : 'Balance due'}
              </td>
              <td className="border-t-2 border-black px-2 py-1 text-right">
                {formatCurrency(Math.abs(settlement.balance))}
              </td>
            </tr>
          </>
        )}
      </tbody>
    </table>
  );
}
