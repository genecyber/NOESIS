'use client';

import { useEffect, useMemo, ReactNode } from 'react';
import { useEmblemAuth } from '@emblemvault/emblem-auth-react';
import { setAuthToken, clearAuth, getAuthToken } from '@/lib/auth';
import LoginScreen from './LoginScreen';
import { Loader2 } from 'lucide-react';

interface AuthGateProps {
  children: ReactNode;
}

/**
 * AuthGate syncs Emblem auth state to localStorage and shows login screen when not authenticated.
 * IMPORTANT: Stores token SYNCHRONOUSLY during render (via useMemo) to prevent race conditions.
 */
export function AuthGate({ children }: AuthGateProps) {
  const { isAuthenticated, isLoading, session } = useEmblemAuth();

  // Store token SYNCHRONOUSLY during render to prevent race conditions
  // useMemo runs during render, before any useEffects or child components mount
  const tokenReady = useMemo(() => {
    if (isAuthenticated && session?.authToken) {
      const currentToken = getAuthToken();
      if (currentToken !== session.authToken) {
        setAuthToken(session.authToken);
        console.log('[AuthGate] Token stored in localStorage (sync)');
      }
      return true;
    }
    return !!getAuthToken(); // Check if token exists from previous session
  }, [isAuthenticated, session]);

  // Clear auth when logged out
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      clearAuth();
    }
  }, [isAuthenticated, isLoading]);

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

  // Wait for token to be ready before rendering app
  if (!tokenReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <p className="text-gray-400">Initializing session...</p>
        </div>
      </div>
    );
  }

  // User is authenticated and token is ready - render the app
  return <>{children}</>;
}

export default AuthGate;
