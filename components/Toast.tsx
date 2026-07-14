/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// components/Toast.tsx
'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  duration?: number;
  onClose?: () => void;
}

export default function Toast({ 
  message, 
  type, 
  duration = 3000,
  onClose 
}: ToastProps) {
  const [visible, setVisible] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, duration);
    
    return () => clearTimeout(timer);
  }, [duration, onClose]);
  
  if (!visible) return null;
  
  const bgColor = type === 'success' ? 'bg-success' : 'bg-destructive';

  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-overlay shadow-elevation-3 ${bgColor} text-text-inverse animate-fadeIn`}>
      {message}
    </div>
  );
}