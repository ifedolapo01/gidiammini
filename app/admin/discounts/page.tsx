/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
'use client';
import { DiscountsSkeleton } from './components/DiscountsSkeleton';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui';
import { Discount, formatDiscountValue } from '@/lib/commerce/discounts';
import { parseVariantTargets } from '@/lib/commerce/discount-target';
import { useDiscounts } from './hooks/useDiscounts';
import { useDiscountPerformance } from './hooks/useDiscountPerformance';
import { useDiscountVariantTargeting } from './hooks/useDiscountVariantTargeting';
import { DiscountTable } from './components/DiscountTable';
import { DiscountFormModal } from './components/DiscountFormModal';
import { NotifySubscribersModal } from './components/NotifySubscribersModal';

export default function DiscountsPage() {
  const {
    discounts, categories, products,
    loading, error,
    isModalOpen, editingId, isSubmitting, pendingId,
    formData, setFormData,
    openModal: openDiscountModal, closeModal,
    handleSubmit, handleDelete, toggleStatus,
  } = useDiscounts();
  // What each of these earned. A second request, so the tables render the
  // moment the discounts do.
  const { performance, unavailable: performanceUnavailable } = useDiscountPerformance();

  const variantTargeting = useDiscountVariantTargeting(formData.scope, setFormData, products);

  const [notifyModalDiscount, setNotifyModalDiscount] = useState<Discount | null>(null);
  const [notifySubject, setNotifySubject] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [isNotifying, setIsNotifying] = useState(false);

  const openModal = (discount?: Discount, isReuse: boolean = false) => {
    openDiscountModal(discount, isReuse);
    if (discount && discount.scope === 'VARIANT' && discount.target_id) {
      variantTargeting.seedVariants(parseVariantTargets(discount.target_id));
    } else {
      variantTargeting.resetVariants();
    }
  };

  const openNotifyModal = (discount: Discount) => {
    setNotifyModalDiscount(discount);
    const discountVal = formatDiscountValue(discount);
    setNotifySubject(`Exciting News: ${discount.name} - ${discountVal}!`);
    setNotifyMessage(`Our ${discount.name} is starting! Get ready to save.`);
  };

  const handleNotifySubmit = async () => {
    if (!notifyModalDiscount) return;
    setIsNotifying(true);
    try {
      const res = await fetch('/api/admin/discounts/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountId: notifyModalDiscount.id,
          customSubject: notifySubject,
          customMessage: notifyMessage
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setNotifyModalDiscount(null);
      } else {
        toast.error('Failed to send notification: ' + data.error);
      }
    } catch (err) {
      toast.error('Error sending notification');
    } finally {
      setIsNotifying(false);
    }
  };

  if (loading && discounts.length === 0) return <DiscountsSkeleton />;

  const now = new Date();
  const activeDiscounts = discounts.filter(d => d.is_active && (!d.end_date || new Date(d.end_date) > now));
  const historyDiscounts = discounts.filter(d => !d.is_active || (d.end_date && new Date(d.end_date) <= now));

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-h4 font-bold text-text-primary">Manage Discounts</h1>
          <p className="text-text-secondary">Create rules for sales, coupons, and markdowns.</p>
        </div>
        <Button onClick={() => openModal()} className="shadow-elevation-1">
          <Plus size={18} />
          Create Discount
        </Button>
      </div>

      <DiscountTable
        discounts={activeDiscounts}
        isHistory={false}
        categories={categories}
        products={products}
        pendingId={pendingId}
        performance={performance}
        performanceUnavailable={performanceUnavailable}
        onToggleStatus={toggleStatus}
        onReuse={(discount) => openModal(discount, true)}
        onEdit={(discount) => openModal(discount)}
        onDelete={handleDelete}
        onNotify={openNotifyModal}
      />
      <DiscountTable
        discounts={historyDiscounts}
        isHistory={true}
        categories={categories}
        products={products}
        pendingId={pendingId}
        performance={performance}
        performanceUnavailable={performanceUnavailable}
        onToggleStatus={toggleStatus}
        onReuse={(discount) => openModal(discount, true)}
        onEdit={(discount) => openModal(discount)}
        onDelete={handleDelete}
        onNotify={openNotifyModal}
      />

      <DiscountFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        editingId={editingId}
        formData={formData}
        setFormData={setFormData}
        categories={categories}
        products={products}
        error={error}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        variantTargeting={variantTargeting}
      />

      <NotifySubscribersModal
        discount={notifyModalDiscount}
        subject={notifySubject}
        message={notifyMessage}
        isSending={isNotifying}
        onSubjectChange={setNotifySubject}
        onMessageChange={setNotifyMessage}
        onClose={() => setNotifyModalDiscount(null)}
        onSubmit={handleNotifySubmit}
      />
    </div>
  );
}
