import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, AlertCircle, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import OrganizationLogo from '@/components/OrganizationLogo';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address')
});

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [organizationLogoUrl, setOrganizationLogoUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState('');

  // Check if user is already authenticated (only when component mounts)
  useEffect(() => {
    let mounted = true;

    const checkAuthStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          if (session?.user) {
            // User is already logged in, redirect to clock
            navigate('/clock', { replace: true });
          } else {
            setCheckingAuth(false);
          }
        }
      } catch (error) {
        if (mounted) {
          setCheckingAuth(false);
        }
      }
    };

    checkAuthStatus();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      console.log('🔐 Attempting login for:', email);
      
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('❌ Login error:', error.message);
        setError(error.message);
        toast.error('Login failed', {
          description: error.message,
          className: 'bg-error text-error-foreground border-error'
        });
        return;
      }

      if (user) {
        console.log('✅ Authentication successful for user:', user.email);
        
        // Add a small delay to let session fully stabilize after password reset
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify session is established
        const { data: { session } } = await supabase.auth.getSession();
        console.log('🔧 Session check:', session ? 'Active' : 'None');
        
        // Check if user exists in workers table with better error handling
        console.log('🔍 Looking up worker record...');
        const { data: worker, error: workerError } = await supabase
          .from('workers')
          .select('*')
          .eq('email', user.email)
          .maybeSingle();
          
        if (workerError) {
          console.error('❌ Worker lookup error:', workerError.message);
          const errorMsg = `Database error: ${workerError.message}`;
          setError(errorMsg);
          toast.error('Database Error', {
            description: 'Unable to verify worker status. Please contact support.',
            className: 'bg-error text-error-foreground border-error'
          });
          await supabase.auth.signOut();
          return;
        }

        if (!worker) {
          console.warn('⚠️ No worker record found for:', user.email);
          const errorMsg = 'Worker account not found. Please contact your administrator.';
          setError(errorMsg);
          toast.error('Access Denied', {
            description: errorMsg,
            className: 'bg-error text-error-foreground border-error'
          });
          await supabase.auth.signOut();
          return;
        }

        console.log('👤 Worker found:', worker.name, 'Active:', worker.is_active);

        if (!worker.is_active) {
          const errorMsg = 'Worker account is inactive. Please contact your administrator.';
          setError(errorMsg);
          toast.error('Account Inactive', {
            description: errorMsg,
            className: 'bg-error text-error-foreground border-error'
          });
          await supabase.auth.signOut();
          return;
        }
        
        localStorage.setItem('worker', JSON.stringify(worker));
        if (rememberMe) {
          localStorage.setItem('rememberLogin', 'true');
        }
        
        console.log('✅ Login complete, redirecting to clock screen');
        toast.success('Welcome to AutoTime!', {
          description: 'Login successful',
          className: 'bg-success text-success-foreground border-l-4 border-black'
        });
        navigate('/clock', { replace: true });
      }
    } catch (error) {
      console.error('💥 Unexpected login error:', error);
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setForgotPasswordError('');

    try {
      // Validate email
      const validation = emailSchema.safeParse({ email: forgotPasswordEmail });
      if (!validation.success) {
        setForgotPasswordError(validation.error.issues[0].message);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error('❌ Password reset error:', error.message);
        setForgotPasswordError(error.message);
        toast.error('Reset Failed', {
          description: error.message,
          className: 'bg-error text-error-foreground border-error'
        });
        return;
      }

      toast.success('Reset Email Sent', {
        description: 'Check your email for password reset instructions',
        className: 'bg-success text-success-foreground border-l-4 border-black'
      });
      
      setShowForgotPassword(false);
      setForgotPasswordEmail('');
    } catch (error) {
      console.error('💥 Unexpected forgot password error:', error);
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
      setForgotPasswordError(errorMsg);
      toast.error('Error', {
        description: errorMsg,
        className: 'bg-error text-error-foreground border-error'
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-6">
              <OrganizationLogo 
                organizationLogoUrl={organizationLogoUrl}
                size="large" 
                className="justify-center" 
              />
              <div className="text-left">
                <h1 className="text-2xl font-bold text-primary">AutoTime</h1>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Worker Time Management</p>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-700">Worker Portal</h2>
          </div>
          
          {/* Login Form */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 mb-6">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}
        
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={async (e) => {
                  const emailValue = e.target.value.trim();
                  if (emailValue && emailValue.includes('@')) {
                    const { data } = await supabase
                      .from('workers')
                      .select('organizations!organization_id(logo_url)')
                      .eq('email', emailValue)
                      .maybeSingle();
                    
                    setOrganizationLogoUrl(data?.organizations?.logo_url || null);
                  }
                }}
                autoComplete="email"
                autoCapitalize="none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            
            <button
              type="submit"
              className="w-full py-4 bg-primary hover:bg-primary-dark text-primary-foreground rounded-lg font-semibold text-lg transform transition-all active:scale-95"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Forgot your password?
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Reset Password
                  </DialogTitle>
                </DialogHeader>
                
                {forgotPasswordError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                    <p className="text-destructive text-sm">{forgotPasswordError}</p>
                  </div>
                )}
                
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                      placeholder="Enter your email address"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowForgotPassword(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={forgotPasswordLoading}
                    >
                      {forgotPasswordLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        'Send Reset Email'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}