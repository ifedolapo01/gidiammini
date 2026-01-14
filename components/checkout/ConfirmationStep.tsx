'use client';

import { CheckCircle, Truck } from 'lucide-react';
import Link from 'next/link';

interface ConfirmationStepProps {
  orderNumber: string;
  deliveryOption: 'pickup' | 'delivery';
  isPickupAvailable: boolean;
  selectedState: string;
  formData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    note: string;
  };
  pickupAddress: string;
  total: number;
}

export default function ConfirmationStep({
  orderNumber,
  deliveryOption,
  isPickupAvailable,
  selectedState,
  formData,
  pickupAddress,
  total = 0
}: ConfirmationStepProps) {
  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-green-200 p-4 md:p-8 text-center">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
          <CheckCircle className="w-10 h-10 md:w-12 md:h-12 text-blue-600" />
        </div>
        
        <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-3 md:mb-4">Order Submitted Successfully!</h2>
        <p className="text-gray-600 text-base md:text-lg mb-6 md:mb-8">
          Order #{orderNumber} has been sent to store owner
        </p>

        <NextSteps 
          deliveryOption={deliveryOption}
          isPickupAvailable={isPickupAvailable}
          selectedState={selectedState}
          formData={formData}
          pickupAddress={pickupAddress}
        />

        <OrderDetailsCard
          orderNumber={orderNumber}
          formData={formData}
          deliveryOption={deliveryOption}
          isPickupAvailable={isPickupAvailable}
          selectedState={selectedState}
          pickupAddress={pickupAddress}
          total={total}
        />

        <EstimatedTimeline 
          deliveryOption={deliveryOption}
          isPickupAvailable={isPickupAvailable}
          selectedState={selectedState}
        />

        <div className="space-y-4">
          <Link
            href="/products"
            className="inline-block w-full bg-blue-600 text-white py-3 md:py-4 rounded-lg md:rounded-xl font-semibold md:font-bold text-base md:text-lg hover:bg-blue-700 transition-all"
          >
            Continue Shopping
          </Link>
          
          <p className="text-xs md:text-sm text-gray-500 mt-3 md:mt-4">
            Store owner will contact you via email/SMS for updates.<br />
            For urgent inquiries, you can call: <strong>0809 653 9067</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

function NextSteps({ deliveryOption, isPickupAvailable, selectedState, formData, pickupAddress }: any) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 md:p-6 mb-6 md:mb-8 text-left">
      <h3 className="font-bold text-base md:text-lg text-gray-800 mb-3 md:mb-4">What Happens Next:</h3>
      <div className="space-y-3 md:space-y-4">
        <StepItem number={1} color="blue">
          <p className="font-medium text-gray-900 text-sm md:text-base">Payment Verification</p>
          <p className="text-xs md:text-sm text-gray-600">
            Store owner has received your receipt via email and will verify your bank transfer
          </p>
        </StepItem>
        
        <StepItem number={2} color="yellow">
          <p className="font-medium text-gray-900 text-sm md:text-base">Order Confirmation</p>
          <p className="text-xs md:text-sm text-gray-600">
            You'll receive an email/SMS when your order is confirmed
          </p>
        </StepItem>
        
        <StepItem number={3} color="green">
          <p className="font-medium text-gray-900 text-sm md:text-base">
            {deliveryOption === 'pickup' && isPickupAvailable 
              ? 'Pickup Arrangement' 
              : selectedState === 'Abuja' 
              ? 'Delivery Arrangement' 
              : 'Park Drop-off Arrangement'
            }
          </p>
          <p className="text-xs md:text-sm text-gray-600">
            {deliveryOption === 'pickup' && isPickupAvailable 
              ? `You'll be contacted to arrange pickup from ${pickupAddress}`
              : selectedState === 'Abuja'
              ? `Your items will be delivered to ${formData.address}, ${formData.city}, ${selectedState}`
              : `Your items will be delivered to the specified park in ${selectedState}. We'll contact you with exact park details.`
            }
          </p>
        </StepItem>
      </div>
    </div>
  );
}

type StepColor = 'blue' | 'yellow' | 'green';

function StepItem({ number, color, children }: { 
  number: number; 
  color: StepColor; 
  children: React.ReactNode 
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    green: 'bg-green-100 text-green-600'
  };

  return (
    <div className="flex items-start">
      <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center mr-2 md:mr-3 flex-shrink-0 ${colorClasses[color]}`}>
        {number}
      </div>
      <div>
        {children}
      </div>
    </div>
  );
}

interface OrderDetailsCardProps {
  orderNumber: string;
  formData: ConfirmationStepProps['formData'];
  deliveryOption: 'pickup' | 'delivery';
  isPickupAvailable: boolean;
  selectedState: string;
  pickupAddress: string;
  total: number;
}

function OrderDetailsCard({
  orderNumber,
  formData,
  deliveryOption,
  isPickupAvailable,
  selectedState,
  pickupAddress,
  total
}: OrderDetailsCardProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 md:p-6 mb-6 md:mb-8">
      <h3 className="font-bold text-base md:text-lg text-gray-800 mb-3 md:mb-4">Your Order Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-gray-900">
        <DetailItem label="Order Number" value={orderNumber} />
        <DetailItem label="Customer Name" value={`${formData.firstName} ${formData.lastName}`} />
        <DetailItem
          label={deliveryOption === 'pickup' && isPickupAvailable 
            ? 'Pickup Location' 
            : selectedState === 'Abuja' 
            ? 'Delivery Address' 
            : 'Park Drop-off Location'
          }
          value={deliveryOption === 'pickup' && isPickupAvailable 
            ? pickupAddress 
            : `${formData.address}, ${formData.city}, ${selectedState}`
          }
        />
        <DetailItem label="Contact" value={formData.phone} subValue={formData.email} />
      </div>
      
      <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-blue-200">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <div>
            <p className="text-sm text-gray-600">Payment Amount</p>
            <p className="font-bold text-lg md:text-xl text-blue-600">
              ₦{total ? total.toLocaleString() : '0.00'}
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <div className="bg-yellow-100 text-yellow-700 px-3 py-1 md:px-4 md:py-2 rounded-full font-medium text-xs md:text-sm">
              Awaiting Verification
            </div>
            <div className={`px-3 py-1 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium ${
              deliveryOption === 'pickup' && isPickupAvailable 
                ? 'bg-blue-100 text-blue-700' 
                : selectedState === 'Abuja' 
                ? 'bg-gray-900 text-white' 
                : 'bg-purple-100 text-purple-700'
            }`}>
              {deliveryOption === 'pickup' && isPickupAvailable 
                ? 'Pickup (Abuja Only)' 
                : selectedState === 'Abuja' 
                ? 'Delivery (Abuja)' 
                : 'Park Drop-off'
              } • {selectedState}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, subValue }: any) {
  return (
    <div>
      <p className="text-xs md:text-sm text-gray-600">{label}</p>
      <p className="font-bold text-sm md:text-base">{value}</p>
      {subValue && <p className="text-xs md:text-sm text-gray-700">{subValue}</p>}
    </div>
  );
}

function EstimatedTimeline({ deliveryOption, isPickupAvailable, selectedState }: any) {
  return (
    <div className="flex items-center bg-gray-50 p-3 md:p-4 rounded-lg mb-6 md:mb-8">
      <Truck className="w-5 h-5 md:w-6 md:h-6 text-blue-600 mr-2 md:mr-3" />
      <div>
        <p className="font-medium text-gray-900 text-sm md:text-base">Expected Timeline</p>
        <p className="text-xs md:text-sm text-gray-600">
          Payment verification: Within 24 hours<br />
          {deliveryOption === 'pickup' && isPickupAvailable 
            ? 'Pickup arrangement' 
            : selectedState === 'Abuja' 
            ? 'Delivery arrangement' 
            : 'Park drop-off arrangement'
          }: 1-2 days after verification
        </p>
      </div>
    </div>
  );
}