import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export function SessionExpiredHandler() {
  const { sessionExpired, clearSessionExpired } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (sessionExpired) {
      toast({
        title: "Sessão expirada",
        description: "Sua sessão expirou. Por favor, faça login novamente.",
        variant: "destructive"
      });
      clearSessionExpired();
      navigate('/auth', { replace: true });
    }
  }, [sessionExpired, clearSessionExpired, navigate, toast]);

  return null;
}
