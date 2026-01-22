import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  sessionExpired: boolean;
  handleSessionExpired: () => void;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const handleSessionExpired = useCallback(() => {
    localStorage.clear();
    setSession(null);
    setUser(null);
    setIsAdmin(false);
    setSessionExpired(true);
  }, []);

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Auto-recovery: detectar sessão inválida e limpar
        if (event === 'SIGNED_OUT' && !session) {
          localStorage.clear();
          setIsAdmin(false);
        }
        
        // Token refresh failed - limpar e redirecionar
        if (event === 'TOKEN_REFRESHED' && !session) {
          localStorage.clear();
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          setLoading(false);
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Check if user is admin using secure user_roles table
          setTimeout(async () => {
            try {
              const { data: userRole } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .eq('role', 'admin')
                .maybeSingle();
              
              setIsAdmin(!!userRole);
            } catch (error) {
              console.error('Error checking user role:', error);
              setIsAdmin(false);
            }
          }, 0);
        } else {
          setIsAdmin(false);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      // Se houver erro ao buscar sessão, limpar tudo
      if (error) {
        console.error('Error getting session:', error);
        localStorage.clear();
        setSession(null);
        setUser(null);
        setIsAdmin(false);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    // Avoid trailing slash to match Supabase redirect allowlist more reliably
    const redirectUrl = `${window.location.origin}`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        isAdmin,
        sessionExpired,
        handleSessionExpired,
        clearSessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};