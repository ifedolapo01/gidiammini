'use client';

import { useCart } from '@/components/CartProvider';
import { Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, getTotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center overflow-x-hidden">
        <div className="max-w-md mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold mb-4">Your cart is empty</h1>
          <p className="text-gray-600 text-sm sm:text-base mb-8">
            Add some products to your cart to see them here.
          </p>
          <Link
            href="/products"
            className="inline-block bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base hover:bg-blue-700"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 overflow-x-hidden">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6 md:mb-8">Shopping Cart</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center border-b p-3 sm:p-4 md:p-6 last:border-b-0 text-black">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-cover rounded-lg flex-shrink-0"
                />
                
                <div className="flex-1 ml-3 sm:ml-4 md:ml-6 min-w-0"> {/* Added min-w-0 */}
                  <h3 className="font-semibold text-sm sm:text-base md:text-lg truncate">{item.name}</h3>
                  <p className="text-gray-600 text-xs sm:text-sm mt-1 truncate">
                    {item.color && `Color: ${item.color}`}
                    {item.size && ` • Size/Age: ${item.size}`}
                  </p>
                  <div className="flex items-center justify-between mt-2 sm:mt-3 md:mt-4 flex-wrap sm:flex-nowrap gap-2">
                    <div className="flex items-center order-1 sm:order-none">
                      <button
                        onClick={() => updateQuantity(item.productId, item.size, item.color, item.quantity - 1)}
                        className="w-7 h-7 sm:w-8 sm:h-8 border rounded-l text-sm flex items-center justify-center hover:bg-gray-50"
                      >
                        -
                      </button>
                      <span className="w-8 sm:w-10 text-center text-sm sm:text-base">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.size, item.color, item.quantity + 1)}
                        className="w-7 h-7 sm:w-8 sm:h-8 border rounded-r text-sm flex items-center justify-center hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>
                    
                    <div className="flex items-center order-2 sm:order-none ml-auto sm:ml-0">
                      <span className="text-sm sm:text-base md:text-lg font-semibold whitespace-nowrap">
                        ₦{(item.price * item.quantity).toLocaleString()}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.productId, item.size, item.color)}
                        className="text-red-500 hover:text-red-700 ml-3 sm:ml-4 md:ml-6"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div>
          <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 sticky top-20 sm:top-24 text-black">
            <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">Order Summary</h2>
            
            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              <div className="flex justify-between text-sm sm:text-base">
                <span>Subtotal ({items.length} items)</span>
                <span>₦{getTotal().toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm sm:text-base">
                <span>Shipping</span>
                <span className="text-gray-600">Calculated at checkout</span>
              </div>
              <div className="flex justify-between text-sm sm:text-base">
                <span>Tax (7.5%)</span>
                <span>₦{(getTotal() * 0.075).toLocaleString()}</span>
              </div>
            </div>
            
            <div className="border-t pt-3 sm:pt-4 mb-4 sm:mb-6">
              <div className="flex justify-between text-base sm:text-lg font-bold">
                <span>Estimated Total</span>
                <span className='text-blue-600'>
                  ₦{(getTotal() + (getTotal() * 0.075)).toLocaleString()}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">
                Shipping fee will be added based on location
              </p>
            </div>
            
            <Link
              href="/checkout"
              className="block w-full bg-blue-600 text-white text-center py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base hover:bg-blue-700 mb-3 sm:mb-4"
            >
              Proceed to Checkout
            </Link>
            
            <Link
              href="/products"
              className="block w-full border text-center py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base hover:bg-gray-50"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}