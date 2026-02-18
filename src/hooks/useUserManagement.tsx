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
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

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
          last_sign_in_at: null,
        };
      });

      return usersWithRoles;
    },
  });
};

// Convidar usuário via edge function
export const useInviteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, fullName, role }: { email: string; fullName: string; role: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const { data, error } = await supabase.functions.invoke("admin-invite-user", {
        body: { action: "invite", email, fullName, role },
      });

      if (error) throw new Error(error.message || "Erro ao convidar usuário");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-list"] });
      toast({ title: "Usuário convidado", description: "O convite foi enviado com sucesso." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao convidar", description: error.message, variant: "destructive" });
    },
  });
};

// Excluir usuário via edge function
export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const { data, error } = await supabase.functions.invoke("admin-invite-user", {
        body: { action: "delete", userId },
      });

      if (error) throw new Error(error.message || "Erro ao excluir usuário");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-list"] });
      toast({ title: "Usuário excluído", description: "O usuário foi removido do sistema." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });
};

// Atualizar perfil do usuário (admin pode editar via RLS)
export const useUpdateUserProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, fullName, email }: { userId: string; fullName: string; email: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, email })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-list"] });
      toast({ title: "Perfil atualizado", description: "As informações foram salvas." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });
};

// Atribuir role admin
export const useGrantAdminRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-list"] });
      toast({ title: "Permissão concedida", description: "O usuário agora tem permissões de administrador." });
    },
    onError: (error: any) => {
      const isRLSError = error.code === "42501" || error.message?.includes("row-level security");
      toast({
        title: "Erro ao conceder permissão",
        description: isRLSError ? "Você não tem permissão para esta ação." : error.message,
        variant: "destructive",
      });
    },
  });
};

// Remover role admin
export const useRevokeAdminRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-list"] });
      toast({ title: "Permissão removida", description: "O usuário não é mais administrador." });
    },
    onError: (error: any) => {
      const isRLSError = error.code === "42501" || error.message?.includes("row-level security");
      toast({
        title: "Erro ao remover permissão",
        description: isRLSError ? "Você não tem permissão para esta ação." : error.message,
        variant: "destructive",
      });
    },
  });
};

// Resetar senha
export const useResetUserPassword = () => {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Email enviado", description: "O usuário receberá um link para redefinir a senha." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao enviar email", description: error.message, variant: "destructive" });
    },
  });
};
