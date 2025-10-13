import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Lock, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import AutoTimeLogo from '@/components/AutoTimeLogo';

const passwordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const verifyResetLink = async () => {
      try {
        // Parse URL hash parameters (access_token, refresh_token, type)
        const hash = window.location.hash.slice(1);
        const hashParams = new URLSearchParams(hash);
        const hashAccessToken = hashParams.get('access_token');
        const hashRefreshToken = hashParams.get('refresh_token');
        const hashType = hashParams.get('type');
        
        // Also check query parameters (some environments deliver tokens in query)
        const queryAccessToken = searchParams.get('access_token');
        const queryRefreshToken = searchParams.get('refresh_token');
        const queryType = searchParams.get('type');
        const code = searchParams.get('code');

        // Supabase may return error details in either hash or query
        const errorDescription =
          searchParams.get('error_description') ||
          searchParams.get('error') ||
          searchParams.get('error_code') ||
          hashParams.get('error_description') ||
          hashParams.get('error') ||
          hashParams.get('error_code');

        if (errorDescription) {
          throw new Error(errorDescription);
        }

        const accessToken = hashAccessToken || queryAccessToken;
        const refreshToken = hashRefreshToken || queryRefreshToken;
        const type = hashType || queryType;

        if (type === 'recovery' && accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          // Clear URL params for security
          window.history.replaceState(null, '', window.location.pathname);
          setCanReset(true);
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          window.history.replaceState(null, '', window.location.pathname);
          setCanReset(true);
        } else {
          throw new Error('Invalid or expired reset link');
        }
      } catch (error) {
        console.error('❌ Reset link verification failed:', error);
        const description =
          error instanceof Error ? error.message : 'This password reset link is invalid or has expired.';
        toast.error('Invalid Reset Link', {
          description,
          className: 'bg-error text-error-foreground border-error',
        });
        setError(description);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyResetLink();
  }, [searchParams]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Ensure we have an active session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session found. Please click the reset link again.');
      }

      // Validate passwords
      const validation = passwordSchema.safeParse({ password, confirmPassword });
      if (!validation.success) {
        setError(validation.error.issues[0].message);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error('❌ Password update error:', error.message);
        setError(error.message);
        toast.error('Reset Failed', {
          description: error.message,
          className: 'bg-error text-error-foreground border-error'
        });
        return;
      }

      toast.success('Password Updated', {
        description: 'Your password has been successfully updated.',
        className: 'bg-success text-success-foreground border-l-4 border-black'
      });

      // Sign out to force fresh login with new password
      await supabase.auth.signOut();
      window.location.href = 'https://autotimeworkers.hillwayco.uk/login';
    } catch (error) {
      console.error('💥 Unexpected password reset error:', error);
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
      setError(errorMsg);
      toast.error('Error', {
        description: errorMsg,
        className: 'bg-error text-error-foreground border-error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <AutoTimeLogo size="large" className="justify-center mb-2" />
          <p className="mt-2 text-gray-600">Reset Your Password</p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm p-8">
          {isVerifying ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-500" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Verifying Reset Link</h3>
              <p className="text-gray-600">Please wait while we verify your password reset link...</p>
            </div>
          ) : !canReset ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-900 mb-2">Invalid Reset Link</h3>
              <p className="text-red-700 mb-6">{error}</p>
              <Button
                onClick={() => navigate('/login')}
                className="w-full"
              >
                Request New Reset Link
              </Button>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 mb-6">
                  <p className="text-red-700 text-sm font-body">{error}</p>
                </div>
              )}
              
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:border-black text-lg"
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:border-black text-lg"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Password requirements:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>At least 8 characters long</li>
                    <li>Contains uppercase and lowercase letters</li>
                    <li>Contains at least one number</li>
                  </ul>
                </div>
                
                <button
                  type="submit"
                  className="w-full py-4 bg-black hover:bg-gray-800 text-white rounded-xl font-semibold text-lg transform transition-all active:scale-95 flex items-center justify-center gap-2"
                  disabled={loading || !canReset}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      Update Password
                    </>
                  )}
                </button>
              </form>
              
              <div className="mt-6 text-center">
                <button
                  type="button"
                  className="text-sm text-gray-600 hover:text-black transition-colors"
                  onClick={() => navigate('/login')}
                >
                  Back to Login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}