import React, { useState } from 'react';
import { LogIn, Mail, Lock, AlertCircle, Compass, ArrowRight } from 'lucide-react';
import { useAuth } from '../../domain/auth/auth.context';
import { ForgotPasswordModal } from './ForgotPasswordModal';

interface LoginViewProps {
  onSuccess: () => void;
  onNavigateToSignup: () => void;
  onExploreDemo: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onSuccess,
  onNavigateToSignup,
  onExploreDemo,
}) => {
  const { login, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    if (!email.trim() || !email.includes('@')) {
      setValidationError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setValidationError('Please enter your password.');
      return;
    }

    try {
      await login({ email: email.trim(), password, rememberMe });
      onSuccess();
    } catch {
      // Error is stored in auth context
    }
  };

  const displayError = validationError || error;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 mb-2">
            <Compass className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Welcome back to TripSync
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to access your custom group trips and smart expense ledger.
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border/80 rounded-2xl shadow-xl p-6 sm:p-8 space-y-5">
          {displayError && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-xs font-medium text-primary hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                />
                Remember me for 30 days
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              {isLoading ? 'Authenticating...' : 'Sign In'}
            </button>
            {isLoading && (
              <p className="text-[11px] text-center text-muted-foreground animate-pulse">
                Connecting to cloud server... If waking from sleep, please allow a moment.
              </p>
            )}
          </form>

          <div className="pt-2 border-t border-border/60 text-center space-y-3">
            <p className="text-xs text-muted-foreground">
              Don&apos;t have an account yet?{' '}
              <button
                type="button"
                onClick={onNavigateToSignup}
                className="font-bold text-primary hover:underline cursor-pointer"
              >
                Create one now
              </button>
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={onExploreDemo}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 py-1 px-3 rounded-lg bg-secondary/60 hover:bg-secondary transition-colors cursor-pointer"
              >
                <span>Or explore simulated Goa demonstration</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        defaultEmail={email}
      />
    </div>
  );
};
