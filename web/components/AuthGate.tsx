'use client';

import { useEffect, ReactNode } from 'react';
import { useEmblemAuth } from '@emblemvault/emblem-auth-react';
import { setAuthToken, setVaultId, clearAuth } from '@/lib/auth';
import LoginScreen from './LoginScreen';
import { Loader2 } from 'lucide-react';

interface AuthGateProps {
  children: ReactNode;
}

/**
 * AuthGate syncs Emblem auth state to localStorage and shows login screen when not authenticated
 */
export function AuthGate({ children }: AuthGateProps) {
  const { isAuthenticated, isLoading, session, vaultId } = useEmblemAuth();

  // Sync auth state to localStorage for API requests
  useEffect(() => {
    if (isAuthenticated && session) {
      // Get JWT token from session (authToken per the SDK types)
      if (session.authToken) {
        setAuthToken(session.authToken);
      }
      if (vaultId) {
        setVaultId(vaultId);
      }
    } else if (!isAuthenticated && !isLoading) {
      clearAuth();
    }
  }, [isAuthenticated, isLoading, session, vaultId]);

  // Show loading spinner during initial auth check
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen when not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // User is authenticated - render the app
  return <>{children}</>;
}

export default AuthGate;
