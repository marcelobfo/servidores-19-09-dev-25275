import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useEffect } from "react";

interface AuthGuardProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export const AuthGuard = ({ children, adminOnly = false }: AuthGuardProps) => {
  const { user, loading, isAdmin } = useAuth();

  useEffect(() => {
    // Se terminou de carregar mas não tem usuário, limpar localStorage
    if (!loading && !user) {
      localStorage.clear();
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/student" replace />;
  }

  return <>{children}</>;
};