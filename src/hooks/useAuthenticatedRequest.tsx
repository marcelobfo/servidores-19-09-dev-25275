import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface RequestResult<T> {
  data: T | null;
  error: { message: string } | null;
}

export function useAuthenticatedRequest() {
  const { handleSessionExpired } = useAuth();

  const executeWithAuth = useCallback(async <T,>(
    request: () => Promise<RequestResult<T>>
  ): Promise<RequestResult<T>> => {
    try {
      // Verificar/renovar sessão antes da chamada
      const { data: { session }, error: refreshError } = 
        await supabase.auth.refreshSession();
      
      if (refreshError || !session) {
        handleSessionExpired();
        return { data: null, error: { message: 'Sessão expirada' } };
      }

      // Executar requisição
      const result = await request();
      
      // Detectar erros de auth na resposta
      if (result.error?.message?.includes('Auth session missing') ||
          result.error?.message?.includes('Invalid authentication') ||
          result.error?.message?.includes('JWT expired')) {
        handleSessionExpired();
        return { data: null, error: { message: 'Sessão expirada' } };
      }
      
      return result;
    } catch (error: any) {
      // Detectar erros de auth em exceções
      const errorMessage = error?.message || '';
      if (errorMessage.includes('Auth session missing') ||
          errorMessage.includes('Invalid authentication') ||
          errorMessage.includes('JWT expired')) {
        handleSessionExpired();
        return { data: null, error: { message: 'Sessão expirada' } };
      }
      
      return { data: null, error: { message: errorMessage || 'Erro desconhecido' } };
    }
  }, [handleSessionExpired]);

  return { executeWithAuth };
}
