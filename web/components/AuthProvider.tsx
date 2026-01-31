'use client';

import { ReactNode } from 'react';
import { EmblemAuthProvider } from '@emblemvault/emblem-auth-react';

interface AuthProviderProps {
  children: ReactNode;
}

// App ID for Metamorph - register at auth.emblemvault.ai
const EMBLEM_APP_ID = process.env.NEXT_PUBLIC_EMBLEM_APP_ID || 'metamorph';

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <EmblemAuthProvider
      appId={EMBLEM_APP_ID}
      debug={process.env.NODE_ENV === 'development'}
    >
      {children}
    </EmblemAuthProvider>
  );
}

export default AuthProvider;
