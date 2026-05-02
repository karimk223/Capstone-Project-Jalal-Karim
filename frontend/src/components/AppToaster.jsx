// src/components/AppToaster.jsx
// Centralizes react-hot-toast configuration. Mount once in App.jsx;
// any component can call toast.success() / toast.error() from anywhere.

import { Toaster } from 'react-hot-toast';

export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      gutter={8}
      toastOptions={{
        duration: 4000,
        className: 'rounded-md shadow-md text-sm',
        success: {
          duration: 3000,
          iconTheme: { primary: '#16a34a', secondary: '#ffffff' },
          className: 'border border-green-200 bg-green-50 text-green-900',
        },
        error: {
          duration: 5000,
          iconTheme: { primary: '#dc2626', secondary: '#ffffff' },
          className: 'border border-red-200 bg-red-50 text-red-900',
        },
      }}
    />
  );
}
