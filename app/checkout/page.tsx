// app/checkout/page.tsx
'use client';

import { useState } from 'react';
import { useCart } from '@/components/CartProvider';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/client';

import CheckoutSteps from '@/components/checkout/CheckoutSteps';
import EmptyCart from '@/components/checkout/EmptyCart';
import StateDeliveryForm from '@/components/checkout/StateDeliveryForm';
import OrderSummary from '@/components/checkout/OrderSummary';
import PaymentStep from '@/components/checkout/PaymentStep';
import ConfirmationStep from '@/components/checkout/ConfirmationStep';
import { OrderData, CartItem } from '@/types/product';

export default function CheckoutPage() {
  const { items, getTotal, clearCart } = useCart();
  const [step, setStep] = useState<'form' | 'payment' | 'confirmation'>('form');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedReceipt, setUploadedReceipt] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [deliveryOption, setDeliveryOption] = useState<'pickup' | 'delivery'>('pickup');
  const [selectedState, setSelectedState] = useState<string>('Abuja');
  const [orderTotal, setOrderTotal] = useState<number>(0);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    note: '',
    subscribeToNewsletter: false
  });

  const pickupAddress = "Suite 5, XYZ Plaza, Central Business District, Abuja";
  
  const getDeliveryFee = (state: string): number => {
    return state === 'Abuja' ? 3000 : 5000;
  };

  const isPickupAvailable = selectedState === 'Abuja';
  const shippingCost = deliveryOption === 'pickup' ? 0 : getDeliveryFee(selectedState);
  const subtotal = getTotal();
  const tax = subtotal * 0.075;
  const total = subtotal + tax + shippingCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (deliveryOption === 'delivery' && !formData.address.trim()) {
      alert('Please enter your delivery address');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const supabase = createClient();
      const productIds = items.map((i: CartItem) => i.productId);
      
      const { data: products, error } = await supabase
        .from('products')
        .select('id, stock, pricing_config')
        .in('id', productIds);
        
      if (error) throw error;
      
      for (const item of items) {
        const product = products?.find(p => p.id === item.productId);
        if (!product) {
          alert(`Product ${item.name} is no longer available.`);
          setIsProcessing(false);
          return;
        }
        
        let currentStock = product.stock;
        if (product.pricing_config) {
          const config = product.pricing_config as any;
          if (config.mode === 'single') {
            currentStock = config.singleStock !== undefined ? config.singleStock : product.stock;
          } else if (config.mode === 'size' && item.size) {
            currentStock = config.sizeStock?.[item.size] ?? product.stock;
          } else if (config.mode === 'color' && item.color) {
            currentStock = config.colorStock?.[item.color] ?? product.stock;
          } else if (config.mode === 'combination' && item.size && item.color) {
            currentStock = config.combinationStock?.[`${item.size}|${item.color}`] ?? product.stock;
          }
        }
        
        if (currentStock < item.quantity) {
          alert(`Insufficient stock for ${item.name} ${item.size ? `(${item.size})` : ''} ${item.color ? `(${item.color})` : ''}. Only ${currentStock} available.`);
          setIsProcessing(false);
          return;
        }
      }
    } catch (err) {
      console.error('Error validating stock:', err);
      alert('Failed to validate stock. Please try again.');
      setIsProcessing(false);
      return;
    }
    
    setIsProcessing(false);
    
    const newOrderNumber = `UT${Date.now().toString().slice(-8)}`;
    setOrderNumber(newOrderNumber);
    setOrderTotal(total);
    setStep('payment');
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedReceipt(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendReceipt = async () => {
    if (!uploadedReceipt) {
      alert('Please upload your payment receipt first.');
      return;
    }

    setIsProcessing(true);

    try {
      // Upload receipt to Supabase Storage
      const supabase = createClient();
      const fileName = `${orderNumber}-${Date.now()}.jpg`;
      
      // Convert base64 to blob
      const base64Response = await fetch(uploadedReceipt);
      const blob = await base64Response.blob();
      
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      // Create order in database
      const orderData: OrderData = {
        order_number: orderNumber,
        customer_name: `${formData.firstName} ${formData.lastName}`,
        customer_email: formData.email,
        customer_phone: formData.phone,
        total_amount: total,
        delivery_option: deliveryOption,
        selected_state: selectedState,
        delivery_address: deliveryOption === 'delivery' ? formData.address : undefined,
        city: formData.city,
        note: formData.note,
        receipt_url: publicUrl,
        items: items.map((item: CartItem) => ({
          product_id: item.productId,
          product_name: item.name,
          price: item.price,
          quantity: item.quantity,
          size: item.size || null,
          color: item.color || null,
        }))
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      // Check if response is OK
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      // Parse the response
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        throw new Error('Invalid response from server');
      }

      if (result.success) {
        // Handle Newsletter Subscription
        if (formData.subscribeToNewsletter) {
          try {
            await fetch('/api/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: formData.email,
                name: `${formData.firstName} ${formData.lastName}`
              }),
            });
          } catch (e) {
            console.error('Subscription failed but order succeeded', e);
          }
        }

        clearCart();
        setStep('confirmation');
      } else {
        throw new Error(result.error || 'Order submission failed');
      }

    } catch (error: any) {
      console.error('Order submission error:', error);
      alert('Failed to submit order. Please try again or contact support.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (items.length === 0 && step !== 'confirmation') {
    return <EmptyCart />;
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Return to Cart Header - Mobile optimized */}
        {step === 'form' && (
          <div className="mb-3">
            <Link
              href="/cart"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium py-1 px-1"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
              <span className="text-xs sm:text-sm">Return to Cart</span>
            </Link>
          </div>
        )}

        {/* Checkout Steps - Mobile optimized */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <CheckoutSteps step={step} />
        </div>

        {/* Page Title - Mobile responsive */}
        <div className="mb-3 sm:mb-4 md:mb-6">
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-1 text-gray-900">
            {step === 'form' && 'Checkout'}
            {step === 'payment' && 'Make Payment'}
            {step === 'confirmation' && 'Order Submitted!'}
          </h1>
          
          <p className="text-xs sm:text-sm text-gray-600">
            {step === 'form' && 'Complete your purchase'}
            {step === 'payment' && 'Transfer funds and upload receipt'}
            {step === 'confirmation' && 'Your order has been submitted'}
          </p>
        </div>

        {/* STEP 1: Customer Details Form */}
        {step === 'form' && (
          <div className="md:grid md:grid-cols-3 md:gap-6 lg:gap-8">
            {/* Mobile: Single column, Desktop: Two-thirds for form */}
            <div className="md:col-span-2">
              <form onSubmit={handleSubmit} id="checkout-form" className="space-y-4 sm:space-y-6 md:space-y-8">
                <StateDeliveryForm
                  selectedState={selectedState}
                  deliveryOption={deliveryOption}
                  setSelectedState={setSelectedState}
                  setDeliveryOption={setDeliveryOption}
                  pickupAddress={pickupAddress}
                />

                <CustomerInformation
                  deliveryOption={deliveryOption}
                  isPickupAvailable={isPickupAvailable}
                  selectedState={selectedState}
                  formData={formData}
                  setFormData={setFormData}
                />

                {/* Submit Button - Desktop */}
                <button
                  type="submit"
                  className="hidden md:block w-full bg-blue-600 text-white py-3 md:py-4 rounded-lg md:rounded-xl font-semibold text-base md:text-lg hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Proceed to Payment
                </button>
              </form>
            </div>

            {/* Order Summary - Mobile: Bottom sticky, Desktop: Sidebar */}
            <div className="mt-4 sm:mt-6 md:mt-0">
              {/* Desktop Order Summary */}
              <div className="hidden md:block sticky top-24">
                <OrderSummary
                  items={items}
                  subtotal={subtotal}
                  tax={tax}
                  shippingCost={shippingCost}
                  total={total}
                  deliveryOption={deliveryOption}
                  selectedState={selectedState}
                />
              </div>

              {/* Mobile Bottom Bar */}
              <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50 p-3 sm:p-4">
                <div className="flex justify-between items-center mb-3 sm:mb-4">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">Total Amount</p>
                    <p className="font-bold text-lg sm:text-xl text-blue-600">₦{total.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Includes tax & shipping</p>
                    <button
                      type="button"
                      onClick={() => {
                        // Show order summary modal
                        const modal = document.getElementById('mobile-order-summary');
                        if (modal) {
                          (modal as any).showModal?.();
                        }
                      }}
                      className="text-xs sm:text-sm text-blue-600 font-medium mt-1"
                    >
                      View Details
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  form="checkout-form"
                  className="w-full bg-blue-600 text-white py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg hover:bg-blue-700"
                >
                  Proceed to Payment
                </button>
              </div>

              {/* Mobile Order Summary Modal */}
              <dialog id="mobile-order-summary" className="modal modal-bottom sm:modal-middle">
                <div className="modal-box max-h-[80vh] overflow-y-auto p-0 w-full max-w-full sm:max-w-md">
                  <div className="sticky top-0 bg-white border-b p-3 sm:p-4">
                    <h3 className="text-base sm:text-lg font-bold">Order Summary</h3>
                    <button
                      className="absolute right-3 sm:right-4 top-3 sm:top-4 text-lg"
                      onClick={() => {
                        const modal = document.getElementById('mobile-order-summary');
                        if (modal) {
                          (modal as any).close?.();
                        }
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-3 sm:p-4">
                    <OrderSummary
                      items={items}
                      subtotal={subtotal}
                      tax={tax}
                      shippingCost={shippingCost}
                      total={total}
                      deliveryOption={deliveryOption}
                      selectedState={selectedState}
                    />
                  </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                  <button>close</button>
                </form>
              </dialog>
            </div>
          </div>
        )}

        {/* STEP 2: Payment Instructions */}
        {step === 'payment' && (
          <PaymentStep
            orderNumber={orderNumber}
            deliveryOption={deliveryOption}
            selectedState={selectedState}
            isPickupAvailable={isPickupAvailable}
            total={total}
            uploadedReceipt={uploadedReceipt}
            setUploadedReceipt={setUploadedReceipt}
            handleReceiptUpload={handleReceiptUpload}
            isProcessing={isProcessing}
            setStep={setStep}
            handleSendReceipt={handleSendReceipt}
          />
        )}

        {/* STEP 3: Confirmation */}
        {step === 'confirmation' && (
          <ConfirmationStep
            orderNumber={orderNumber}
            deliveryOption={deliveryOption}
            isPickupAvailable={isPickupAvailable}
            selectedState={selectedState}
            formData={formData}
            pickupAddress={pickupAddress}
            total={orderTotal || total}
          />
        )}
      </div>
    </div>
  );
}

// CustomerInformation component
function CustomerInformation({ deliveryOption, isPickupAvailable, selectedState, formData, setFormData }: any) {
  return (
    <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg sm:rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 md:mb-6 text-gray-800">
        {deliveryOption === 'pickup' && isPickupAvailable 
          ? 'Pickup Information' 
          : 'Delivery Information'
        }
      </h2>
      
      <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3 md:gap-4">
        <FormInput
          label="First Name *"
          value={formData.firstName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, firstName: e.target.value})}
          placeholder="First Name"
        />
        <FormInput
          label="Last Name *"
          value={formData.lastName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, lastName: e.target.value})}
          placeholder="Last Name"
        />
      </div>
      
      <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3 md:gap-4 mt-3 sm:mt-4">
        <FormInput
          type="email"
          label="Email *"
          value={formData.email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, email: e.target.value})}
          placeholder="your@email.com"
        />
        <FormInput
          type="tel"
          label="Phone Number *"
          value={formData.phone}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, phone: e.target.value})}
          placeholder="Phone Number"
        />
      </div>

      <div className="mt-4 flex items-start">
        <div className="flex items-center h-5">
          <input
            id="subscribe"
            name="subscribe"
            type="checkbox"
            checked={formData.subscribeToNewsletter}
            onChange={(e) => setFormData({...formData, subscribeToNewsletter: e.target.checked})}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor="subscribe" className="font-medium text-gray-700">Keep me updated</label>
          <p className="text-gray-500">Send me exclusive offers and upcoming discounts.</p>
        </div>
      </div>

      {deliveryOption === 'delivery' && (
        <AddressFields
          selectedState={selectedState}
          address={formData.address}
          city={formData.city}
          setAddress={(value: string) => setFormData({...formData, address: value})}
          setCity={(value: string) => setFormData({...formData, city: value})}
        />
      )}
      
      <div className="mt-3 sm:mt-4 md:mt-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Additional Note (Optional)
        </label>
        <textarea
          value={formData.note}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, note: e.target.value})}
          placeholder="Any special instructions or notes for your order..."
          className="w-full border border-gray-300 text-black rounded-lg px-3 sm:px-4 py-2 sm:py-3 h-24 sm:h-32 text-sm"
          rows={3}
        />
      </div>
    </div>
  );
}

function FormInput({ type = 'text', label, value, onChange, placeholder }: any) {
  return (
    <div>
      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-gray-300 text-black rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        required
      />
    </div>
  );
}

function AddressFields({ selectedState, address, city, setAddress, setCity }: any) {
  return (
    <div className="mt-3 sm:mt-4 md:mt-6">
      <div className="space-y-3">
        <FormInput
          label={selectedState === 'Abuja' ? 'Delivery Address *' : 'Park Drop-off Address *'}
          value={address}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
          placeholder={selectedState === 'Abuja' 
            ? "House number, Street, Area" 
            : "Which park should we deliver to?"
          }
        />
        <FormInput
          label="City/Town *"
          value={city}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
          placeholder="City or town in your state"
        />
      </div>
      {selectedState !== 'Abuja' && (
        <div className="mt-3 p-2 sm:p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs sm:text-sm text-yellow-700">
            <strong>Note:</strong> For {selectedState}, we deliver to designated parks only. 
            Please specify which park you prefer, and you'll need to collect your order from there.
          </p>
        </div>
      )}
    </div>
  );
}