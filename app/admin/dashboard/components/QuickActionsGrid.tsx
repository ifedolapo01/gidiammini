/** ADMIN layer — "Quick Actions" link grid on the dashboard. */
import Link from 'next/link';

export function QuickActionsGrid() {
  return (
    <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border">
      <h2 className="text-h5 font-bold mb-6 text-text-primary">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/admin/products"
          className="p-4 bg-primary/10 border border-primary/30 rounded-surface hover:bg-primary/20 transition-colors"
        >
          <h3 className="font-semibold text-primary mb-1">Add New Product</h3>
          <p className="text-body-sm text-primary">Upload a new item to your store</p>
        </Link>

        <Link
          href="/admin/orders"
          className="p-4 bg-success-background border border-success-border rounded-surface hover:bg-success-border transition-colors"
        >
          <h3 className="font-semibold text-success mb-1">Manage Orders</h3>
          <p className="text-body-sm text-success">View and process customer orders</p>
        </Link>

        <Link
          href="/products"
          className="p-4 bg-accent/10 border border-accent/30 rounded-surface hover:bg-accent/20 transition-colors"
        >
          <h3 className="font-semibold text-accent mb-1">View Store</h3>
          <p className="text-body-sm text-accent">See how your store looks to customers</p>
        </Link>

        <Link
          href="/admin/settings"
          className="p-4 bg-background-secondary border border-border rounded-surface hover:bg-background-tertiary transition-colors"
        >
          <h3 className="font-semibold text-text-primary mb-1">Store Settings</h3>
          <p className="text-body-sm text-text-secondary">Configure store preferences</p>
        </Link>
      </div>
    </div>
  );
}
