'use client';

import { useEmblemAuth } from '@emblemvault/emblem-auth-react';
import { motion } from 'framer-motion';
import { Loader2, Wallet, Zap } from 'lucide-react';

export function LoginScreen() {
  const { isLoading, error, openAuthModal } = useEmblemAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 mb-4"
          >
            <Zap className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-4xl font-display font-bold text-white mb-2">
            METAMORPH
          </h1>
          <p className="text-gray-400">
            Transformation-maximizing AI system
          </p>
        </div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-8"
        >
          <h2 className="text-xl font-semibold text-white mb-2 text-center">
            Connect to Continue
          </h2>
          <p className="text-gray-400 text-sm text-center mb-6">
            Connect your Emblem wallet to access your personalized AI experience
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
              {error.message || 'Authentication failed'}
            </div>
          )}

          <button
            onClick={() => openAuthModal()}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="w-5 h-5" />
                Connect Wallet
              </>
            )}
          </button>

          <div className="mt-6 pt-6 border-t border-gray-800">
            <p className="text-gray-500 text-xs text-center">
              Your data is isolated in your personal vault. No one else can access your sessions, memories, or AI identity.
            </p>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 grid grid-cols-3 gap-4 text-center"
        >
          <div className="text-gray-400">
            <div className="text-2xl mb-1">🔒</div>
            <div className="text-xs">Vault Isolated</div>
          </div>
          <div className="text-gray-400">
            <div className="text-2xl mb-1">🧠</div>
            <div className="text-xs">Personal AI</div>
          </div>
          <div className="text-gray-400">
            <div className="text-2xl mb-1">⚡</div>
            <div className="text-xs">Evolving</div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default LoginScreen;
