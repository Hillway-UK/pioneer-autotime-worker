import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import FirstLoginPasswordDialog from '@/components/FirstLoginPasswordDialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    let stabilizeTimer: NodeJS.Timeout;
    
    // Set up auth state listener with stabilization delay
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        
        if (mounted) {
          // Clear any existing timer
          if (stabilizeTimer) {
            clearTimeout(stabilizeTimer);
          }
          
          // For sign out events, update immediately
          if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setMustChangePassword(false);
            setLoading(false);
            return;
          }
          
          // For sign in events, add small delay to let session stabilize
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            stabilizeTimer = setTimeout(() => {
              if (mounted) {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
                
                if (session?.user) {
                  setTimeout(() => {
                    checkPasswordChangeRequired(session.user.email!);
                  }, 0);
                }
              }
            }, 200);
          } else {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
            
            if (session?.user) {
              setTimeout(() => {
                checkPasswordChangeRequired(session.user.email!);
              }, 0);
            }
          }
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (session?.user) {
          setTimeout(() => {
            checkPasswordChangeRequired(session.user.email!);
          }, 0);
        }
      }
    });

    return () => {
      mounted = false;
      if (stabilizeTimer) {
        clearTimeout(stabilizeTimer);
      }
      subscription.unsubscribe();
    };
  }, []);

  const checkPasswordChangeRequired = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('must_change_password')
        .eq('email', email)
        .maybeSingle();

      if (!error && data) {
        setMustChangePassword(data.must_change_password || false);
      }
    } catch (error) {
      console.error('Error checking password change requirement:', error);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      localStorage.removeItem('worker');
      navigate('/login', { replace: true });
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner type="verification" message="Loading your dashboard..." />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <>
      {mustChangePassword && <FirstLoginPasswordDialog open={mustChangePassword} />}
      {children}
    </>
  );
}