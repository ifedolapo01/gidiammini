/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Upload } from 'lucide-react';
import { Button } from '@/components/ui';

interface ReceiptUploadProps {
  uploadedReceipt: string | null;
  setUploadedReceipt: (receipt: string | null) => void;
  handleReceiptUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ReceiptUpload({ uploadedReceipt, setUploadedReceipt, handleReceiptUpload }: ReceiptUploadProps) {
  return (
    <div className="border-2 border-dashed border-border-strong rounded-surface p-4 md:p-8 text-center mb-6 md:mb-8">
      {!uploadedReceipt ? (
        <>
          <Upload className="w-10 h-10 md:w-12 md:h-12 text-text-muted mx-auto mb-3 md:mb-4" />
          <h3 className="text-body-md md:text-body-lg font-medium text-text-primary mb-2">Upload Payment Receipt</h3>
          <p className="text-text-secondary text-body-sm md:text-body-md mb-4 md:mb-6">
            Upload a screenshot of your bank transfer confirmation
          </p>
          <input
            type="file"
            id="receipt-upload"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleReceiptUpload}
            className="hidden"
          />
          <label
            htmlFor="receipt-upload"
            className="inline-block bg-primary text-primary-foreground px-4 py-2 md:px-6 md:py-3 rounded-control font-medium hover:bg-primary-hover cursor-pointer text-body-sm md:text-body-md"
          >
            Choose File
          </label>
          <p className="text-caption-md md:text-body-sm text-text-muted mt-3 md:mt-4">
            Accepted: JPG, PNG or WebP (max 5MB)
          </p>
        </>
      ) : (
        <>
          <div className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-3 md:mb-4 border border-border rounded-control overflow-hidden">
            <img
              src={uploadedReceipt}
              alt="Payment receipt"
              className="w-full h-full object-cover"
            />
          </div>
          <h3 className="text-body-md md:text-body-lg font-medium text-text-primary mb-2">Receipt Uploaded!</h3>
          <p className="text-text-secondary text-body-sm md:text-body-md mb-4 md:mb-6">
            Your payment receipt is ready to be sent
          </p>
          <Button variant="link" onClick={() => setUploadedReceipt(null)} className="text-body-sm md:text-body-md">
            Upload different file
          </Button>
        </>
      )}
    </div>
  );
}
