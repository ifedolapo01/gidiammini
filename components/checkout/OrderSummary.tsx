'use client';

import { Banknote } from 'lucide-react';
import { CartItem } from '@/types/product';

interface OrderSummaryProps {
  items: CartItem[];
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
}

export default function OrderSummary({
  items,
  subtotal,
  tax,
  shippingCost,
  total,
  deliveryOption,
  selectedState
}: OrderSummaryProps) {
  
  const isPickupAvailable = selectedState === 'Abuja';

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 md:p-6">
      <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6 text-gray-800">Order Summary</h2>
      
      <div className="space-y-3 md:space-y-4 mb-4 md:mb-6 max-h-64 md:max-h-96 overflow-y-auto pr-2">
        {items.map(item => (
          <div key={item.productId} className="flex items-start justify-between pb-3 md:pb-4 border-b border-gray-100">
            <div className="flex items-start space-x-2 md:space-x-3">
              <img
                src={item.image}
                alt={item.name}
                className="w-12 h-12 md:w-16 md:h-16 object-cover rounded-lg"
              />
              <div>
                <span className="font-medium text-gray-800 text-sm md:text-base">{item.name}</span>
                <div className="text-xs md:text-sm text-gray-600 mt-1">
                  {item.color && <span>Color: {item.color}</span>}
                  {item.size && <span> • Size: {item.size}</span>}
                  <span> • Qty: {item.quantity}</span>
                </div>
              </div>
            </div>
            <span className="font-semibold text-gray-900 text-sm md:text-base">
              ₦{(item.price * item.quantity).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      
      <div className="space-y-2 md:space-y-3 border-t border-gray-200 pt-3 md:pt-4 mb-4 md:mb-6">
        <div className="flex justify-between">
          <span className="text-gray-600 text-sm md:text-base">Subtotal ({items.length} items)</span>
          <span className="font-medium text-gray-900 text-sm md:text-base">₦{subtotal.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600 text-sm md:text-base">
            {deliveryOption === 'pickup' ? 'Pickup Fee' : 'Delivery Fee'}
            <span className="text-xs md:text-sm block text-gray-500">
              {selectedState} {deliveryOption === 'pickup' ? 'pickup' : 'delivery'}
            </span>
          </span>
          <span className="font-medium text-gray-900 text-sm md:text-base">
            ₦{shippingCost.toLocaleString()}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600 text-sm md:text-base">Tax (7.5%)</span>
          <span className="font-medium text-gray-900 text-sm md:text-base">₦{tax.toLocaleString()}</span>
        </div>
      </div>
      
      <div className="border-t border-gray-200 pt-3 md:pt-4">
        <div className="flex justify-between text-lg md:text-xl font-bold">
          <span className="text-gray-900">Total Amount</span>
          <div className="text-right">
            <div className="text-blue-600">₦{total.toLocaleString()}</div>
          </div>
        </div>
        
        <div className="mt-3 md:mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-xs md:text-sm">
            <span className="text-gray-700">Delivery Method:</span>
            <span className="font-medium capitalize text-gray-900">
              {deliveryOption === 'pickup' && isPickupAvailable 
                ? 'Pickup (Abuja Only)' 
                : selectedState === 'Abuja' 
                ? 'Delivery (Abuja)' 
                : 'Park Drop-off'
              }
            </span>
          </div>
          <div className="flex items-center justify-between text-xs md:text-sm mt-1 md:mt-2">
            <span className="text-gray-700">Location:</span>
            <span className="font-medium text-gray-900">{selectedState}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-gray-200">
        <div className="flex items-center text-xs md:text-sm text-gray-600 mb-3 md:mb-4">
          <Banknote className="w-4 h-4 md:w-5 md:h-5 mr-2 text-green-600" />
          <span className="font-medium">Bank Transfer Only</span>
        </div>
        <p className="text-xs md:text-sm text-gray-600">
          Pay via bank transfer and upload your receipt. We'll verify and process your order.
        </p>
      </div>
    </div>
  );
}