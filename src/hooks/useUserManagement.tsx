import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface UserWithRoles {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  roles: string[];
  last_sign_in_at: string | null;
}

// Buscar todos os usuários com suas roles
export const useUsersList = () => {
  return useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      // Buscar todos os perfis
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Buscar todas as roles
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combinar dados (sem auth.admin - não funciona no client-side)
      const usersWithRoles: UserWithRoles[] = profiles.map((profile) => {
        const roles = userRoles
          .filter((ur) => ur.user_id === profile.user_id)
          .map((ur) => ur.role);

        return {
          id: profile.user_id,
          email: profile.email || "",
          full_name: profile.full_name,
          created_at: profile.created_at,
          roles: roles.length > 0 ? roles : ["student"],
          last_sign_in_at: null, // Auth admin API não disponível no client-side
        };
      });

      return usersWithRoles;
    },
  });
};

// Atribuir role admin a um usuário
export const useGrantAdminRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });

      if (error) {
        console.error("Erro ao conceder admin:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-list"] });
      toast({
        title: "Permissão concedida",
        description: "O usuário agora tem permissões de administrador.",
      });
    },
    onError: (error: any) => {
      const isRLSError = error.code === "42501" || error.message?.includes("row-level security");
      toast({
        title: "Erro ao conceder permissão",
        description: isRLSError 
          ? "Você não tem permissão para esta ação. Verifique se você é admin."
          : `${error.message}${error.hint ? ` (Dica: ${error.hint})` : ""}`,
        variant: "destructive",
      });
    },
  });
};

// Remover role admin de um usuário
export const useRevokeAdminRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");

      if (error) {
        console.error("Erro ao remover admin:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-list"] });
      toast({
        title: "Permissão removida",
        description: "O usuário não é mais administrador.",
      });
    },
    onError: (error: any) => {
      const isRLSError = error.code === "42501" || error.message?.includes("row-level security");
      toast({
        title: "Erro ao remover permissão",
        description: isRLSError 
          ? "Você não tem permissão para esta ação. Verifique se você é admin."
          : `${error.message}${error.hint ? ` (Dica: ${error.hint})` : ""}`,
        variant: "destructive",
      });
    },
  });
};

// Resetar senha de um usuário (envia email de recuperação)
export const useResetUserPassword = () => {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Email enviado",
        description: "O usuário receberá um link para redefinir a senha.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar email",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
