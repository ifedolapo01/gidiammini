/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
import { CheckCircle } from 'lucide-react';

interface CheckoutStepsProps {
  step: 'form' | 'payment' | 'confirmation';
}

export default function CheckoutSteps({ step }: CheckoutStepsProps) {
  return (
    <div className="mb-6 md:mb-8">
      <div className="flex items-center justify-center">
        <StepItem step={step} currentStep="form" label="Your Details" />
        <StepDivider />
        <StepItem step={step} currentStep="payment" label="Make Payment" />
        <StepDivider />
        <StepItem step={step} currentStep="confirmation" label="Confirmation" />
      </div>
    </div>
  );
}

function StepItem({ step, currentStep, label }: { step: string, currentStep: string, label: string }) {
  const isActive = step === currentStep;
  const isCompleted = step === 'confirmation' ||
    (currentStep === 'payment' && step === 'form') ||
    (currentStep === 'confirmation');

  return (
    <div className={`flex items-center ${isCompleted ? 'text-text-primary' : isActive ? 'text-primary' : 'text-text-muted'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
        isCompleted ? 'bg-primary/10' : isActive ? 'bg-primary/10' : 'bg-background-tertiary'
      }`}>
        {isCompleted ? <CheckCircle className="w-5 h-5" /> :
          currentStep === 'form' ? '1' :
          currentStep === 'payment' ? '2' : '3'}
      </div>
      <span className="font-medium text-body-sm md:text-body-md">{label}</span>
    </div>
  );
}

function StepDivider() {
  return <div className="w-12 md:w-24 h-0.5 mx-2 md:mx-4 bg-text-primary"></div>;
}
