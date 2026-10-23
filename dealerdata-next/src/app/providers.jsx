'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { AuthProvider } from '@/lib/AuthContext';
import { DealerProvider } from '@/lib/DealerContext';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import AppLayout from '@/components/Layout';
import { Suspense } from 'react';

export function Providers({ children }) {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <DealerProvider>
          <Suspense fallback={
            <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
            </div>
          }>
            <AppLayout>
              {children}
            </AppLayout>
          </Suspense>
          <Toaster />
          <SonnerToaster richColors position="top-right" />
        </DealerProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}
