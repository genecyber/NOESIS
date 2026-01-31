'use client';

import { ReactNode } from 'react';
import { AuthProvider } from './AuthProvider';
import { AuthGate } from './AuthGate';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Providers wrapper that sets up all context providers
 * - EmblemAuthProvider for wallet authentication
 * - AuthGate to require login before showing the app
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <AuthGate>
        {children}
      </AuthGate>
    </AuthProvider>
  );
}

export default Providers;
